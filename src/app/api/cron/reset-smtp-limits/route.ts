// src/app/api/cron/reset-smtp-limits/route.ts
// Vercel Cron (daily): resets every SMTP's sent_today counter.
import { NextResponse } from "next/server";
import { resetAllDailyLimits } from "@/lib/smtpLoadBalancer";
import { authorizeCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = authorizeCron(req);
  if (auth) return auth;

  await resetAllDailyLimits();
  return NextResponse.json({ ok: true });
}