// src/lib/normalize.ts
// Email normalization + validation helpers shared across import/scrape/dedup.

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

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
    if (isValidEmail(e)) found.add(normalizeEmail(e));
  }
  // general email pattern
  const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  while ((m = emailRe.exec(text))) {
    const e = m[0];
    if (isValidEmail(e)) found.add(normalizeEmail(e));
  }
  return Array.from(found);
}
