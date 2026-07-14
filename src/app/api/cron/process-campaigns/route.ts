// src/app/api/cron/process-campaigns/route.ts
// Vercel Cron: drains all campaigns still in 'sending' status.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { drainCampaign } from "@/lib/campaignEngine";
import { authorizeCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = authorizeCron(req);
  if (auth) return auth;

  // Requeue any stuck 'processing' rows back to 'queued' (recovered crashed claims).
  await db
    .update(schema.sentEmails)
    .set({ status: "queued" })
    .where(eq(schema.sentEmails.status, "processing"));

  // Find all campaigns still sending.
  const active = await db
    .select({ id: schema.campaigns.id, name: schema.campaigns.name })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.status, "sending"));

  const results: Record<string, unknown> = {};
  for (const c of active) {
    try {
      results[c.name] = await drainCampaign(c.id, { maxJobs: 300, deadlineMs: 50_000 });
    } catch (err: unknown) {
      results[c.name] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ ok: true, processed: active.length, results });
}