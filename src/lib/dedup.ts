// src/lib/dedup.ts
// Deduplication logic. The sent_emails unique index is the HARD guarantee, but we
// pre-check at import time so the user sees what will be skipped.
import { inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { isUsableLeadEmail, normalizeEmail } from "./normalize";

export type ImportRow = {
  email: string;
  firstName?: string | null;
  company?: string | null;
};

export type DedupReport = {
  added: number;
  duplicatesInFile: number;
  alreadyLeads: number;
  alreadySent: number;
  invalid: number;
  total: number;
};

/**
 * Bulk-insert leads, skipping:
 *  - invalid emails
 *  - duplicates within the same import
 *  - emails that already exist as a lead (leads.email_norm unique)
 *  - emails that were EVER sent before (sent_emails.email_norm unique) — the
 *    core CRM rule: "if sent before, cannot be added to a new campaign."
 *
 * Uses the leads unique index for conflict resolution; does NOT throw on dup.
 */
export async function importLeads(
  rows: ImportRow[],
  source: "discovery" | "scrape" | "csv" | "manual",
  niche?: string
): Promise<DedupReport> {
  const report: DedupReport = {
    added: 0,
    duplicatesInFile: 0,
    alreadyLeads: 0,
    alreadySent: 0,
    invalid: 0,
    total: rows.length,
  };

  // Pre-fetch sent + existing lead norms so we can classify skips.
  const candidateNorms = new Set<string>();
  const seenInFile = new Set<string>();
  const validRows: { norm: string; row: ImportRow }[] = [];

  for (const row of rows) {
    const norm = normalizeEmail(row.email || "");
    if (!norm || !isUsableLeadEmail(norm)) {
      report.invalid++;
      continue;
    }
    if (seenInFile.has(norm)) {
      report.duplicatesInFile++;
      continue;
    }
    seenInFile.add(norm);
    candidateNorms.add(norm);
    validRows.push({ norm, row });
  }

  if (validRows.length === 0) return report;

  const norms = Array.from(candidateNorms);

  const existingLeads = await db
    .select({ emailNorm: schema.leads.emailNorm })
    .from(schema.leads)
    .where(inArray(schema.leads.emailNorm, norms));
  const leadSet = new Set(existingLeads.map((l) => l.emailNorm));

  const sentRows = await db
    .select({ emailNorm: schema.sentEmails.emailNorm })
    .from(schema.sentEmails)
    .where(inArray(schema.sentEmails.emailNorm, norms));
  const sentSet = new Set(sentRows.map((s) => s.emailNorm));

  const toInsert: (typeof schema.leads.$inferInsert)[] = [];
  for (const { norm, row } of validRows) {
    if (leadSet.has(norm)) {
      report.alreadyLeads++;
      continue;
    }
    if (sentSet.has(norm)) {
      report.alreadySent++;
      continue;
    }
    toInsert.push({
      email: row.email,
      emailNorm: norm,
      firstName: row.firstName || null,
      company: row.company || null,
      niche: niche || null,
      source,
      status: "raw",
    });
  }

  if (toInsert.length > 0) {
    // libSQL supports multi-row insert; the unique index silently handles any
    // race by failing just the offending row.
    try {
      await db.insert(schema.leads).values(toInsert);
      report.added = toInsert.length;
    } catch (err) {
      // If the batch fails (e.g. one row collided), fall back to per-row inserts.
      console.error("[dedup] batch insert failed, retrying per-row:", err);
      for (const v of toInsert) {
        try {
          await db.insert(schema.leads).values(v).onConflictDoNothing();
          report.added++;
        } catch {
          // ignore single-row collision
        }
      }
    }
  }

  return report;
}
