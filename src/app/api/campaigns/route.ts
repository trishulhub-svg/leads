// src/app/api/campaigns/route.ts
// List campaigns + create a new one.
import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaigns = await db
    .select({
      id: schema.campaigns.id,
      name: schema.campaigns.name,
      templateId: schema.campaigns.templateId,
      status: schema.campaigns.status,
      niche: schema.campaigns.niche,
      total: schema.campaigns.total,
      sent: schema.campaigns.sent,
      failed: schema.campaigns.failed,
      opened: schema.campaigns.opened,
      replied: schema.campaigns.replied,
      createdAt: schema.campaigns.createdAt,
    })
    .from(schema.campaigns)
    .orderBy(desc(schema.campaigns.createdAt));
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, templateId, niche } = await req.json();
  if (!name) return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });

  const tid = templateId ? Number(templateId) : null;
  if (tid) {
    const { getPlanLimits, isTemplateAllowed } = await import("@/lib/plan");
    const limits = await getPlanLimits();
    if (limits.plan === "free") {
      const allIds = await db
        .select({ id: schema.templates.id })
        .from(schema.templates)
        .orderBy(schema.templates.id);
      if (!isTemplateAllowed(
        limits,
        tid,
        allIds.map((r) => r.id)
      )) {
        return NextResponse.json(
          { error: "Free plan allows 1 email template. Upgrade to Premium to use more.", upgrade: true },
          { status: 403 }
        );
      }
    }
  }

  const inserted = await db
    .insert(schema.campaigns)
    .values({
      name,
      templateId: tid,
      niche: niche || null,
      status: "draft",
    })
    .returning({ id: schema.campaigns.id });
  return NextResponse.json({ ok: true, id: inserted[0].id });
}

void eq;
void sql;
