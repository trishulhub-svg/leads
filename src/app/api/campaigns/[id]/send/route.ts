// src/app/api/campaigns/[id]/send/route.ts
// Triggers a campaign: enqueues send_email rows (dedup-aware) then drains inline
// for up to ~25s (Hobby) / configurable. The cron route continues draining later.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enqueueCampaign, drainCampaign } from "@/lib/campaignEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaignId = Number(id);
  if (!campaignId) return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const leadIds: number[] | undefined = body.leadIds;

  // 1. Enqueue (dedup gate inside).
  const enq = await enqueueCampaign(campaignId, leadIds);

  // 2. Drain inline for as long as we safely can within the request budget.
  const drain = await drainCampaign(campaignId, { maxJobs: 500, deadlineMs: 25_000 });

  return NextResponse.json({
    ok: true,
    enqueued: enq.enqueued,
    alreadySent: enq.alreadySent,
    totalLeads: enq.total,
    ...drain,
  });
}
