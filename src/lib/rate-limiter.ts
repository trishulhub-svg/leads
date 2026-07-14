// src/lib/rate-limiter.ts
// DB-backed rate limiting (mirrors the proven kadam-app pattern).
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

export type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
  /** True when the DB was unavailable — caller may choose to allow the request. */
  dbError?: boolean;
};

export async function checkRateLimit(
  key: string,
  cfg: { max: number; windowMs: number }
): Promise<RateLimitResult> {
  const rlKey = `rl:${key}`;
  const now = Date.now();

  try {
    const existing = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, rlKey))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      await db
        .insert(schema.settings)
        .values({ key: rlKey, value: JSON.stringify({ count: 1, start: now }) });
      return { allowed: true };
    }

    let data: { count: number; start: number };
    try {
      data = JSON.parse(existing.value);
      if (typeof data.count !== "number" || typeof data.start !== "number") throw new Error("bad");
    } catch {
      await db
        .update(schema.settings)
        .set({ value: JSON.stringify({ count: 1, start: now }) })
        .where(eq(schema.settings.key, rlKey));
      return { allowed: true };
    }

    // Window expired — reset.
    if (now - data.start > cfg.windowMs) {
      await db
        .update(schema.settings)
        .set({ value: JSON.stringify({ count: 1, start: now }) })
        .where(eq(schema.settings.key, rlKey));
      return { allowed: true };
    }

    // Limit hit — do NOT increment.
    if (data.count >= cfg.max) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((cfg.windowMs - (now - data.start)) / 1000)),
      };
    }

    await db
      .update(schema.settings)
      .set({ value: JSON.stringify({ count: data.count + 1, start: data.start }) })
      .where(eq(schema.settings.key, rlKey));
    return { allowed: true };
  } catch (err) {
    console.error("[rate-limiter] DB error:", err);
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
