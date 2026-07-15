// src/lib/ensure-crm-advanced-columns.ts
// Backfill advanced CRM columns on DBs created before this feature.
import { clientSql } from "./db";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

const COLUMNS: { name: string; ddl: string }[] = [
  { name: "deal_value", ddl: "ALTER TABLE crm_entries ADD COLUMN deal_value INTEGER" },
  { name: "priority", ddl: "ALTER TABLE crm_entries ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'" },
  { name: "follow_up_at", ddl: "ALTER TABLE crm_entries ADD COLUMN follow_up_at INTEGER" },
];

export async function ensureCrmAdvancedColumns(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      const result = await clientSql.execute("PRAGMA table_info(crm_entries)");
      const existing = new Set(
        result.rows.map((row) => String((row as { name?: unknown }).name ?? ""))
      );

      for (const col of COLUMNS) {
        if (existing.has(col.name)) continue;
        try {
          await clientSql.execute(col.ddl);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!/duplicate column|already exists/i.test(msg)) throw err;
        }
      }
      ensured = true;
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}
