// src/lib/scraper.ts
// v1 "AI scraping" = URL-based email extraction.
// Fetches the page HTML, strips obvious junk (images of the app, common false-positives),
// and extracts all emails + mailto: links. Full crawl / search-engine harvesting is a
// future enhancement behind a clearly-marked seam (scrapeBySearch).
import { extractEmails, normalizeEmail } from "./normalize";
import { fetchPublicHtml } from "./safe-fetch";

// Domains that produce false-positive "emails" (image filenames, etc.)
const JUNK_SUFFIX = /\.(png|jpe?g|gif|webp|svg|css|js|ico|woff2?|ttf)$/i;

export type ScrapedEmail = {
  email: string;
  // Best-effort name/company guess from the page (heuristic, not required).
  guessName?: string;
  guessCompany?: string;
};

export type ScrapeResult = {
  ok: boolean;
  emails: ScrapedEmail[];
  error?: string;
  fetchedAt: string;
};

/** Fetch a single URL and extract emails from its HTML. */
export async function scrapeUrl(url: string, _niche?: string): Promise<ScrapeResult> {
  let target = url.trim();
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;
  try {
    const { html, finalUrl } = await fetchPublicHtml(target, { timeoutMs: 15_000 });
    const company = guessCompany(html, finalUrl);
    const raw = extractEmails(html).filter((e) => !JUNK_SUFFIX.test(e));
    const seen = new Set<string>();
    const emails: ScrapedEmail[] = [];
    for (const e of raw) {
      const norm = normalizeEmail(e);
      if (seen.has(norm)) continue;
      seen.add(norm);
      // Drop role addresses that aren't real prospects.
      if (/^(info|support|admin|webmaster|noreply|no-reply|contact|sales|hello|help|abuse|postmaster)@/i.test(norm)) {
        // keep them but flag — still a real contact for some businesses.
      }
      emails.push({ email: norm, guessCompany: company });
    }
    return { ok: true, emails, fetchedAt: new Date().toISOString() };
  } catch (err: any) {
    return {
      ok: false,
      emails: [],
      error: err?.name === "AbortError" ? "Request timed out (15s)" : err?.message ?? String(err),
      fetchedAt: new Date().toISOString(),
    };
  }
}

/** Heuristic company name from <title> or og:site_name, else the hostname. */
function guessCompany(html: string, url: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]{2,120})<\/title>/i);
  if (titleMatch) {
    const t = titleMatch[1].trim().split(/[|–—-]/)[0].trim();
    if (t) return t;
  }
  const ogMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{2,80})["']/i);
  if (ogMatch) return ogMatch[1].trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// FUTURE SEAM — search-engine / deep crawling.
// To add later, implement scrapeBySearch(query, niche) using a dedicated scraping
// API (e.g. Serper/SerpAPI/Crawlee) and route through the same return shape.
// ──────────────────────────────────────────────────────────────────────────
