// src/app/api/unsubscribe/route.ts
// Public unsubscribe endpoint. Supports one-click List-Unsubscribe=One-Click (POST)
// and GET redirects to the human-friendly confirmation page.
import { NextResponse } from "next/server";
import { suppressEmail, verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const page = new URL("/unsubscribe", url.origin);
  if (token) page.searchParams.set("token", token);
  else page.searchParams.set("error", "missing");
  return NextResponse.redirect(page);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let token = url.searchParams.get("token");
  if (!token) {
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const body = await req.text();
        token = new URLSearchParams(body).get("token");
      }
    } catch {
      // ignore
    }
  }
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const verified = await verifyUnsubscribeToken(token);
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

  await suppressEmail(verified.email);
  // RFC 8058 one-click success — empty 200.
  return new NextResponse(null, { status: 200 });
}
