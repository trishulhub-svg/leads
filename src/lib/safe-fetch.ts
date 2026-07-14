import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

/** Validate a user-controlled URL and reject local/private network destinations. */
export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
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
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local network addresses are not allowed.");
  }

  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error("Private network addresses are not allowed.");
    return url;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error("The website resolves to a private or unavailable network address.");
  }
  return url;
}

/**
 * Fetch public HTML while validating every redirect target. This prevents the
 * URL scraper from being used to access cloud metadata or internal services.
 */
export async function fetchPublicHtml(
  rawUrl: string,
  options: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<{ html: string; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  let current = await assertSafePublicUrl(rawUrl);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "TrishulhubLeads/1.0 (+https://trishulhub.com)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-IN,en;q=0.9",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Website returned an invalid redirect.");
      current = await assertSafePublicUrl(new URL(location, current).toString());
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
    return { html, finalUrl: current.toString() };
  }

  throw new Error("The website redirected too many times.");
}
