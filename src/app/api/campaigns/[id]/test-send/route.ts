// src/app/api/campaigns/[id]/test-send/route.ts
// One-recipient TEST of a campaign template. Does not enqueue bulk sends,
// does not change campaign status, and does not burn the recipient in dedup.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendTestCampaignEmail } from "@/lib/campaignEngine";
import { checkRateLimit } from "@/lib/rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaignId = Number(id);
  if (!campaignId) return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });

  const rl = await checkRateLimit(`campaign_test:${user.id}`, { max: 8, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed && !rl.dbError) {
    return NextResponse.json(
      { error: `Too many test sends. Try again in ${rl.retryAfter ?? 60}s.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const to = String(body.to || body.email || "").trim();
  const firstName = body.firstName != null ? String(body.firstName) : undefined;
  const company = body.company != null ? String(body.company) : undefined;

  const res = await sendTestCampaignEmail({ campaignId, to, firstName, company });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    to: res.to,
    subject: res.subject,
    message: `Test email sent to ${res.to}. Check the inbox (and spam). This does not count as a real campaign send.`,
  });
}
