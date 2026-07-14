// src/app/api/cron/check-replies/route.ts
// Vercel Cron: polls all IMAP-configured inboxes for replies, classifies them,
// and auto-promotes repliers into the CRM (or blacklists bounces).
import { NextResponse } from "next/server";
import { checkAllInboxes } from "@/lib/inbox";
import { authorizeCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = authorizeCron(req);
  if (auth) return auth;

  const results = await checkAllInboxes();
  return NextResponse.json({ ok: true, results });
}