// src/lib/smtpLoadBalancer.ts
// The 8-SMTP routing + failover engine.
//
// Strategy:
//  - pickSmtp() returns the next healthy Primary whose sent_today < daily_limit,
//    via round-robin (cursor persisted in settings).
//  - When no healthy Primary is available, failover to Emergency SMTPs (same logic).
//  - markFailure() increments a consecutive-failure counter; after 3 consecutive
//    failures, marks the SMTP unhealthy. A successful send or test resets the counter.
//  - markSent() uses an atomic SQL increment (sent_today = sent_today + 1).
import { eq, and, asc, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db, schema } from "./db";
import { getSetting, setSetting } from "./settings";
import { decrypt } from "./crypto";
import type { SmtpRole } from "@/drizzle/schema";

export type ResolvedSmtp = {
  id: number;
  label: string;
  fromName: string;
  fromEmail: string;
  transporter: nodemailer.Transporter;
};

const RR_PRIMARY = "rr_smtp_primary";
const RR_EMERGENCY = "rr_smtp_emergency";
const FAILURE_THRESHOLD = 3; // consecutive failures before marking unhealthy

/** Reset an SMTP's daily counter if it's a new day. */
async function maybeResetCounter(row: typeof schema.smtpConfigs.$inferSelect) {
  const today = new Date();
  const reset = new Date(row.limitResetAt);
  const sameDay =
    today.getFullYear() === reset.getFullYear() &&
    today.getMonth() === reset.getMonth() &&
    today.getDate() === reset.getDate();
  if (!sameDay) {
    await db
      .update(schema.smtpConfigs)
      .set({ sentToday: 0, limitResetAt: today })
      .where(eq(schema.smtpConfigs.id, row.id));
    return { ...row, sentToday: 0 };
  }
  return row;
}

/** Return healthy candidates (under their daily limit) for a role, ordered by id. */
async function healthyCandidates(role: SmtpRole) {
  const rows = await db
    .select()
    .from(schema.smtpConfigs)
    .where(and(eq(schema.smtpConfigs.role, role), eq(schema.smtpConfigs.healthy, true)))
    .orderBy(asc(schema.smtpConfigs.id));
  const reset = await Promise.all(rows.map(maybeResetCounter));
  return reset.filter((r) => r.sentToday < r.dailyLimit);
}

/** Pick the next SMTP by round-robin across healthy candidates of the given role. */
async function pickByRole(role: SmtpRole, cursorKey: string): Promise<typeof schema.smtpConfigs.$inferSelect | null> {
  const candidates = await healthyCandidates(role);
  if (candidates.length === 0) return null;

  const cursorRaw = await getSetting(cursorKey);
  let lastId = cursorRaw ? parseInt(cursorRaw, 10) : 0;
  if (isNaN(lastId)) lastId = 0;

  // Find the first candidate whose id > lastId; wrap around to the first.
  let next = candidates.find((c) => c.id > lastId);
  if (!next) next = candidates[0];

  await setSetting(cursorKey, String(next.id));
  return next;
}

/**
 * Pick the next available SMTP across the whole pool: Primary first, then Emergency.
 * Returns null only if the entire pool is exhausted (caller should pause the campaign).
 */
export async function pickSmtp(): Promise<typeof schema.smtpConfigs.$inferSelect | null> {
  return (await pickByRole("primary", RR_PRIMARY)) ?? (await pickByRole("emergency", RR_EMERGENCY));
}

/** Build a nodemailer transporter for a config row. */
export async function buildTransporter(row: typeof schema.smtpConfigs.$inferSelect): Promise<nodemailer.Transporter> {
  const pass = await decrypt(row.passEnc);
  return nodemailer.createTransport({
    host: row.host,
    port: row.port,
    secure: row.secure,
    auth: { user: row.user, pass },
  });
}

/** Resolve a config row into a ready-to-use ResolvedSmtp. */
export async function resolveSmtp(row: typeof schema.smtpConfigs.$inferSelect): Promise<ResolvedSmtp> {
  return {
    id: row.id,
    label: row.label,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    transporter: await buildTransporter(row),
  };
}

/**
 * Increment sent_today atomically (SQL: sent_today = sent_today + 1).
 * Also resets the failure counter on success.
 */
export async function markSent(smtpId: number): Promise<void> {
  await db
    .update(schema.smtpConfigs)
    .set({ sentToday: sql`${schema.smtpConfigs.sentToday} + 1`, healthy: true, lastError: null })
    .where(eq(schema.smtpConfigs.id, smtpId));
}

/**
 * Record a failure. After FAILURE_THRESHOLD consecutive failures, mark unhealthy.
 * We track consecutive failures via the lastError field (prefixed with a count).
 */
export async function markFailure(smtpId: number, error: string): Promise<void> {
  const row = await db
    .select({ healthy: schema.smtpConfigs.healthy, lastError: schema.smtpConfigs.lastError })
    .from(schema.smtpConfigs)
    .where(eq(schema.smtpConfigs.id, smtpId))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return;

  // Parse the current failure count from the lastError prefix "fails:N:...".
  let count = 1;
  if (row.lastError?.startsWith("fails:")) {
    const match = row.lastError.match(/^fails:(\d+):/);
    if (match) count = parseInt(match[1], 10) + 1;
  }

  const prefix = `fails:${count}:`;
  if (count >= FAILURE_THRESHOLD) {
    await db
      .update(schema.smtpConfigs)
      .set({ healthy: false, lastError: `${prefix}${error.slice(0, 450)}`, lastCheckedAt: new Date() })
      .where(eq(schema.smtpConfigs.id, smtpId));
  } else {
    await db
      .update(schema.smtpConfigs)
      .set({ lastError: `${prefix}${error.slice(0, 450)}`, lastCheckedAt: new Date() })
      .where(eq(schema.smtpConfigs.id, smtpId));
  }
}

/** Mark an SMTP healthy again (e.g. a successful test / send). Resets failure counter. */
export async function markHealthy(smtpId: number): Promise<void> {
  await db
    .update(schema.smtpConfigs)
    .set({ healthy: true, lastError: null, lastCheckedAt: new Date() })
    .where(eq(schema.smtpConfigs.id, smtpId));
}

/** Test a connection (verify) without sending. Throws on failure. */
export async function testConnection(row: typeof schema.smtpConfigs.$inferSelect): Promise<void> {
  const transporter = await buildTransporter(row);
  await transporter.verify();
  await markHealthy(row.id);
}

/** Pool health summary for the dashboard / settings. */
export async function poolSummary() {
  const rows = await db.select().from(schema.smtpConfigs).orderBy(asc(schema.smtpConfigs.role), asc(schema.smtpConfigs.id));
  const reset = await Promise.all(rows.map(maybeResetCounter));
  return {
    primary: {
      total: reset.filter((r) => r.role === "primary").length,
      healthy: reset.filter((r) => r.role === "primary" && r.healthy && r.sentToday < r.dailyLimit).length,
    },
    emergency: {
      total: reset.filter((r) => r.role === "emergency").length,
      healthy: reset.filter((r) => r.role === "emergency" && r.healthy && r.sentToday < r.dailyLimit).length,
    },
    rows: reset,
  };
}

/** Reset all daily counters (called by the reset-limits cron at local midnight). */
export async function resetAllDailyLimits(): Promise<void> {
  const now = new Date();
  await db.update(schema.smtpConfigs).set({ sentToday: 0, limitResetAt: now });
}