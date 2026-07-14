// src/app/api/cron/process-campaigns/route.ts
// Vercel Cron entry point (replaces a BullMQ worker). Drains all campaigns that
// are still in 'sending' status. Secured by CRON_SECRET.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { drainCampaign } from "@/lib/campaignEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Authorize via header (Vercel Cron sends this) or ?secret= for manual runs.
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const providedSecret = authHeader?.replace("Bearer ", "") || url.searchParams.get("secret");
  if (secret && providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all campaigns still sending.
  const active = await db
    .select({ id: schema.campaigns.id, name: schema.campaigns.name })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.status, "sending"));

  const results: Record<string, unknown> = {};
  for (const c of active) {
    try {
      results[c.name] = await drainCampaign(c.id, { maxJobs: 300, deadlineMs: 50_000 });
    } catch (err: any) {
      results[c.name] = { error: err?.message ?? String(err) };
    }
  }

  return NextResponse.json({ ok: true, processed: active.length, results });
}
