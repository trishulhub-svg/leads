// src/lib/normalize.ts
// Email normalization + validation helpers shared across import/scrape/dedup.

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
const RESERVED_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
  "example.in",
]);
const PLACEHOLDER_LOCALS = new Set([
  "user",
  "username",
  "yourname",
  "your-name",
  "name",
  "someone",
  "sample",
  "demo",
]);

/** Lowercase + trim an email address (the dedup key). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strict email validation. */
export function isValidEmail(email: string): boolean {
  const e = email.trim();
  if (e.length < 5 || e.length > 254) return false;
  return EMAIL_RE.test(e);
}

/**
 * Reject syntactically valid addresses that are clearly documentation or form
 * placeholders. Keep this conservative so legitimate role inboxes still pass.
 */
export function isUsableLeadEmail(email: string): boolean {
  if (!isValidEmail(email)) return false;
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split("@");
  if (
    RESERVED_DOMAINS.has(domain) ||
    domain.endsWith(".example") ||
    domain.endsWith(".test") ||
    domain === "localhost"
  ) {
    return false;
  }
  if (domain === "domain.com" && PLACEHOLDER_LOCALS.has(local)) return false;
  return true;
}

/**
 * Extract all email-looking substrings from arbitrary text/HTML.
 * Used by the URL scraper and the .txt importer.
 */
export function extractEmails(text: string): string[] {
  const found = new Set<string>();
  // mailto: links first
  const mailtoRe = /mailto:([^"'?>\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(text))) {
    const e = decodeURIComponent(m[1]).trim();
    if (isUsableLeadEmail(e)) found.add(normalizeEmail(e));
  }
  // general email pattern
  const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  while ((m = emailRe.exec(text))) {
    const e = m[0];
    if (isUsableLeadEmail(e)) found.add(normalizeEmail(e));
  }
  return Array.from(found);
}
