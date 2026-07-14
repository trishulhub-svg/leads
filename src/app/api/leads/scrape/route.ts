// src/app/api/leads/scrape/route.ts
// Scrape emails from a URL and import them as raw leads (dedup-aware).
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { scrapeUrl } from "@/lib/scraper";
import { importLeads } from "@/lib/dedup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, niche } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "A URL is required." }, { status: 400 });
  }

  const result = await scrapeUrl(url, niche);
  if (!result.ok || result.emails.length === 0) {
    return NextResponse.json({
      ok: false,
      error: result.error || "No emails found on that page.",
      found: 0,
    });
  }

  const report = await importLeads(
    result.emails.map((e) => ({ email: e.email, company: e.guessCompany })),
    "scrape",
    niche
  );

  return NextResponse.json({ ok: true, found: result.emails.length, report, source: result });
}
