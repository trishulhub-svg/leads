// src/lib/ensure-smtp-quota-columns.ts
// Production DBs created before quota tracking need these columns added once.
// Safe to call repeatedly — uses PRAGMA + ALTER only when missing.
import { clientSql } from "./db";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

const QUOTA_COLUMNS: { name: string; ddl: string }[] = [
  { name: "monthly_quota", ddl: "ALTER TABLE smtp_configs ADD COLUMN monthly_quota INTEGER NOT NULL DEFAULT 10000" },
  { name: "sent_this_month", ddl: "ALTER TABLE smtp_configs ADD COLUMN sent_this_month INTEGER NOT NULL DEFAULT 0" },
  { name: "month_reset_at", ddl: "ALTER TABLE smtp_configs ADD COLUMN month_reset_at INTEGER" },
  { name: "total_quota", ddl: "ALTER TABLE smtp_configs ADD COLUMN total_quota INTEGER" },
  { name: "sent_total", ddl: "ALTER TABLE smtp_configs ADD COLUMN sent_total INTEGER NOT NULL DEFAULT 0" },
];

export async function ensureSmtpQuotaColumns(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      const result = await clientSql.execute("PRAGMA table_info(smtp_configs)");
      const existing = new Set(
        result.rows.map((row) => String((row as { name?: unknown }).name ?? ""))
      );

      for (const col of QUOTA_COLUMNS) {
        if (existing.has(col.name)) continue;
        try {
          await clientSql.execute(col.ddl);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!/duplicate column|already exists/i.test(msg)) throw err;
        }
      }

      await clientSql.execute(
        "UPDATE smtp_configs SET month_reset_at = CAST(strftime('%s','now') AS INTEGER) WHERE month_reset_at IS NULL"
      );
      ensured = true;
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}
