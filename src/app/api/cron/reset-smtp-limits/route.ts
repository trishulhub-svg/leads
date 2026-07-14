// src/app/api/cron/reset-smtp-limits/route.ts
// Vercel Cron (daily): resets every SMTP's sent_today counter.
import { NextResponse } from "next/server";
import { resetAllDailyLimits } from "@/lib/smtpLoadBalancer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const providedSecret = authHeader?.replace("Bearer ", "") || url.searchParams.get("secret");
  if (secret && providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await resetAllDailyLimits();
  return NextResponse.json({ ok: true });
}
