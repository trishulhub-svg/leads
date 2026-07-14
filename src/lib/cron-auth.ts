// src/lib/cron-auth.ts
// Shared auth helper for Vercel Cron routes. Fail CLOSED when CRON_SECRET
// is unset — never allow open access.
import { NextResponse } from "next/server";

export function authorizeCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed — refuse to run if not configured.
    console.error("[cron] CRON_SECRET is not set — refusing to execute.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  const url = new URL(req.url);
  const providedSecret = authHeader?.replace("Bearer ", "") || url.searchParams.get("secret");
  if (providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // authorized
}