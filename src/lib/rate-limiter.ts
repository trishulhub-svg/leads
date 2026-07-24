// src/lib/rate-limiter.ts
// DB-backed rate limiting with an ATOMIC increment (no read-modify-write race).
//
// The counter lives in the `settings` KV as JSON {count,start}. Increment +
// window-reset happen inside a single SQLite UPDATE using json functions, so
// concurrent requests can't all slip through before the count lands.
import { eq } from "drizzle-orm";
import { db, schema, clientSql } from "./db";

export type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
  /** True when the DB was unavailable — caller decides fail-open vs fail-closed. */
  dbError?: boolean;
};

export async function checkRateLimit(
  key: string,
  cfg: { max: number; windowMs: number }
): Promise<RateLimitResult> {
  const rlKey = `rl:${key}`;
  const now = Date.now();

  try {
    // 1. Try to create the counter atomically. If we insert it, this is the
    //    first hit in a fresh window → allowed.
    const initial = JSON.stringify({ count: 1, start: now });
    const insert = await clientSql.execute({
      sql: "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
      args: [rlKey, initial, Math.floor(now / 1000)],
    });
    if ((insert.rowsAffected ?? 0) > 0) {
      return { allowed: true };
    }

    // 2. Row exists — atomically reset-if-expired OR increment-if-under-limit.
    //    Returns the new value only when the request is allowed.
    const updated = await clientSql.execute({
      sql: `
        UPDATE settings
        SET value = json_object(
              'count',
              CASE WHEN (? - CAST(json_extract(value, '$.start') AS INTEGER)) > ?
                   THEN 1
                   ELSE CAST(json_extract(value, '$.count') AS INTEGER) + 1 END,
              'start',
              CASE WHEN (? - CAST(json_extract(value, '$.start') AS INTEGER)) > ?
                   THEN ?
                   ELSE CAST(json_extract(value, '$.start') AS INTEGER) END
            ),
            updated_at = ?
        WHERE key = ?
          AND (
            (? - CAST(json_extract(value, '$.start') AS INTEGER)) > ?
            OR CAST(json_extract(value, '$.count') AS INTEGER) < ?
          )
        RETURNING value
      `,
      args: [
        now, cfg.windowMs,
        now, cfg.windowMs, now,
        Math.floor(now / 1000),
        rlKey,
        now, cfg.windowMs,
        cfg.max,
      ],
    });

    if ((updated.rows?.length ?? 0) > 0) {
      return { allowed: true };
    }

    // 3. Blocked — compute retryAfter from the current window start.
    const current = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, rlKey))
      .limit(1)
      .then((r) => r[0]);
    let retryAfter = Math.ceil(cfg.windowMs / 1000);
    if (current) {
      try {
        const data = JSON.parse(current.value) as { start?: number };
        if (typeof data.start === "number") {
          retryAfter = Math.max(1, Math.ceil((cfg.windowMs - (now - data.start)) / 1000));
        }
      } catch {
        /* fall back to full window */
      }
    }
    return { allowed: false, retryAfter };
  } catch (err) {
    console.error("[rate-limiter] DB error:", err);
    // Signal the failure; each caller decides whether to fail open or closed.
    return { allowed: false, retryAfter: 60, dbError: true };
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  try {
    await db.delete(schema.settings).where(eq(schema.settings.key, `rl:${key}`));
  } catch (err) {
    console.error("[rate-limiter] clear error:", err);
  }
}
