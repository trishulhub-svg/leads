import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { Agent } from "undici";

const MAX_REDIRECTS = 4;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  return version === 4 ? isPrivateIpv4(address) : version === 6 ? isPrivateIpv6(address) : true;
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local");
}

export type SafeUrl = { url: URL; addresses: Array<{ address: string; family: number }> };

/**
 * Validate a user-controlled URL and reject local/private network destinations.
 * Returns the parsed URL plus the vetted resolved addresses so the caller can
 * PIN the connection to those exact IPs (defeats DNS-rebinding / TOCTOU).
 */
export async function assertSafePublicUrl(rawUrl: string): Promise<SafeUrl> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid website URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed.");

  const hostname = url.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    throw new Error("Local network addresses are not allowed.");
  }

  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error("Private network addresses are not allowed.");
    return { url, addresses: [{ address: hostname, family: isIP(hostname) }] };
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  if (resolved.length === 0 || resolved.some(({ address }) => isBlockedAddress(address))) {
    throw new Error("The website resolves to a private or unavailable network address.");
  }
  return { url, addresses: resolved.map((r) => ({ address: r.address, family: r.family })) };
}

/**
 * Assert a bare hostname/IP (e.g. an SMTP host) does not point at a private or
 * local network. Throws on any violation. Used to stop internal port scanning.
 */
export async function assertSafeHost(host: string): Promise<void> {
  const hostname = String(host || "").trim().toLowerCase();
  if (!hostname) throw new Error("Host is required.");
  if (isBlockedHostname(hostname)) throw new Error("Local network addresses are not allowed.");
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error("Private network addresses are not allowed.");
    return;
  }
  const resolved = await lookup(hostname, { all: true, verbatim: true });
  if (resolved.length === 0 || resolved.some(({ address }) => isBlockedAddress(address))) {
    throw new Error("Host resolves to a private or unavailable network address.");
  }
}

/**
 * Build an undici dispatcher that PINS DNS to pre-vetted addresses and
 * re-validates at connect time, so a domain can't resolve to a public IP during
 * validation and a private IP at connection time (DNS rebinding).
 */
export function pinnedDispatcher(addresses: Array<{ address: string; family: number }>): Agent {
  const safe = addresses.filter((a) => !isBlockedAddress(a.address));
  const pinnedLookup = ((
    _hostname: string,
    options: { all?: boolean } | undefined,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | Array<{ address: string; family: number }>,
      family?: number
    ) => void
  ) => {
    if (safe.length === 0) {
      callback(new Error("No safe address available for host."), "", 0);
      return;
    }
    if (options && options.all) {
      callback(null, safe.map((a) => ({ address: a.address, family: a.family })));
    } else {
      callback(null, safe[0].address, safe[0].family);
    }
  }) as unknown as LookupFunction;

  return new Agent({ connect: { lookup: pinnedLookup } });
}

/**
 * Fetch public HTML while validating every redirect target and pinning the
 * connection to the vetted IP. Prevents the URL scraper from reaching cloud
 * metadata or internal services.
 */
export async function fetchPublicHtml(
  rawUrl: string,
  options: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<{ html: string; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  let safe = await assertSafePublicUrl(rawUrl);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const dispatcher = pinnedDispatcher(safe.addresses);
    let response: Response;
    try {
      response = await fetch(safe.url, {
        signal: controller.signal,
        redirect: "manual",
        // @ts-expect-error dispatcher is a valid undici RequestInit option
        dispatcher,
        headers: {
          "User-Agent": "TrishulhubLeads/1.0 (+https://trishulhub.com)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-IN,en;q=0.9",
        },
      });
    } finally {
      clearTimeout(timeout);
      dispatcher.close().catch(() => {});
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Website returned an invalid redirect.");
      safe = await assertSafePublicUrl(new URL(location, safe.url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error("The URL did not return an HTML page.");
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > maxBytes) throw new Error("The page is too large to scan safely.");

    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > maxBytes) {
      throw new Error("The page is too large to scan safely.");
    }
    return { html, finalUrl: safe.url.toString() };
  }

  throw new Error("The website redirected too many times.");
}
