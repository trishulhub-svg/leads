// src/lib/cron-auth.ts
// Shared auth helper for Vercel Cron routes. Fail CLOSED when CRON_SECRET
// is unset — never allow open access.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export function authorizeCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed — refuse to run if not configured.
    console.error("[cron] CRON_SECRET is not set — refusing to execute.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const expected = Buffer.from(secret);
  const provided = Buffer.from(providedSecret);
  const valid =
    expected.length === provided.length &&
    expected.length > 0 &&
    timingSafeEqual(expected, provided);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // authorized
}