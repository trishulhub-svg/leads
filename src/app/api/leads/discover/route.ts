import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { discoverLocalLeads } from "@/lib/lead-discovery";
import { importLeads } from "@/lib/dedup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const inputSchema = z.object({
  location: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  radiusKm: z.coerce.number().int().min(1).max(50),
  maxBusinesses: z.coerce.number().int().min(5).max(40).default(20),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { getPlanLimits } = await import("@/lib/plan");
  const limits = await getPlanLimits();
  if (!limits.leadIntelligence) {
    return NextResponse.json(
      { error: "Lead discovery is a Premium feature. Upgrade to unlock.", upgrade: true },
      { status: 403 }
    );
  }

  const rateLimit = await checkRateLimit(`lead_discovery:${user.id}`, {
    max: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed && !rateLimit.dbError) {
    return NextResponse.json(
      { error: `Discovery limit reached. Try again in ${rateLimit.retryAfter ?? 60} seconds.` },
      { status: 429 }
    );
  }

  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid discovery request." },
      { status: 400 }
    );
  }

  try {
    const discovery = await discoverLocalLeads(parsed.data);
    const importRows = discovery.businesses.flatMap((business) =>
      business.emails.map((email) => ({
        email,
        company: business.name,
      }))
    );
    const report = await importLeads(importRows, "discovery", parsed.data.category);

    return NextResponse.json({
      ok: true,
      discovery,
      report,
      emailsFound: importRows.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lead discovery failed." },
      { status: 502 }
    );
  }
}
