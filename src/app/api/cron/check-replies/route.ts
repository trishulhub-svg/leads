// src/app/api/cron/check-replies/route.ts
// Vercel Cron: polls all IMAP-configured inboxes for replies, classifies them,
// and auto-promotes repliers into the CRM (or blacklists bounces).
import { NextResponse } from "next/server";
import { checkAllInboxes } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const providedSecret = authHeader?.replace("Bearer ", "") || url.searchParams.get("secret");
  if (secret && providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await checkAllInboxes();
  return NextResponse.json({ ok: true, results });
}
