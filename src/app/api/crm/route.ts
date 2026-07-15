// src/app/api/crm/route.ts
// List / update CRM entries. Advanced fields require Premium.
import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CRM_PRIORITIES, CRM_STAGES } from "@/drizzle/schema";
import { getPlanLimits } from "@/lib/plan";
import { ensureCrmAdvancedColumns } from "@/lib/ensure-crm-advanced-columns";

export const dynamic = "force-dynamic";

function serialize(row: {
  id: number;
  leadId: number;
  stage: (typeof CRM_STAGES)[number];
  notes: string | null;
  dealValue: number | null;
  priority: (typeof CRM_PRIORITIES)[number];
  followUpAt: Date | null;
  firstRepliedAt: Date;
  updatedAt: Date;
  email: string;
  firstName: string | null;
  company: string | null;
  niche: string | null;
}) {
  return {
    id: row.id,
    leadId: row.leadId,
    stage: row.stage,
    notes: row.notes,
    dealValue: row.dealValue,
    priority: row.priority,
    followUpAt: row.followUpAt ? row.followUpAt.toISOString() : null,
    firstRepliedAt: row.firstRepliedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    email: row.email,
    firstName: row.firstName,
    company: row.company,
    niche: row.niche,
  };
}

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureCrmAdvancedColumns();
  const [entries, plan] = await Promise.all([
    db
      .select({
        id: schema.crmEntries.id,
        leadId: schema.crmEntries.leadId,
        stage: schema.crmEntries.stage,
        notes: schema.crmEntries.notes,
        dealValue: schema.crmEntries.dealValue,
        priority: schema.crmEntries.priority,
        followUpAt: schema.crmEntries.followUpAt,
        firstRepliedAt: schema.crmEntries.firstRepliedAt,
        updatedAt: schema.crmEntries.updatedAt,
        email: schema.leads.email,
        firstName: schema.leads.firstName,
        company: schema.leads.company,
        niche: schema.leads.niche,
      })
      .from(schema.crmEntries)
      .innerJoin(schema.leads, eq(schema.crmEntries.leadId, schema.leads.id))
      .orderBy(desc(schema.crmEntries.updatedAt)),
    getPlanLimits(),
  ]);
  return NextResponse.json({ entries: entries.map(serialize), plan });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureCrmAdvancedColumns();

  const body = await req.json();
  const { id, stage, notes, priority, dealValue, followUpAt, ids, bulkStage } = body as {
    id?: number;
    stage?: string;
    notes?: string | null;
    priority?: string;
    dealValue?: number | string | null;
    followUpAt?: string | null;
    ids?: number[];
    bulkStage?: string;
  };

  const plan = await getPlanLimits();

  // Premium: bulk stage move
  if (Array.isArray(ids) && bulkStage) {
    if (!plan.advancedCrm) {
      return NextResponse.json(
        { error: "Bulk pipeline actions are a Premium feature. Upgrade to unlock.", upgrade: true },
        { status: 403 }
      );
    }
    if (!CRM_STAGES.includes(bulkStage as (typeof CRM_STAGES)[number])) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    const cleanIds = ids.map(Number).filter(Boolean);
    if (cleanIds.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });
    for (const entryId of cleanIds) {
      await db
        .update(schema.crmEntries)
        .set({ stage: bulkStage as (typeof CRM_STAGES)[number] })
        .where(eq(schema.crmEntries.id, entryId));
    }
    return NextResponse.json({ ok: true, updated: cleanIds.length });
  }

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Partial<typeof schema.crmEntries.$inferInsert> = {};
  if (stage !== undefined) {
    if (!CRM_STAGES.includes(stage as (typeof CRM_STAGES)[number])) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    updates.stage = stage as (typeof CRM_STAGES)[number];
  }
  if (notes !== undefined) updates.notes = notes;

  const wantsAdvanced =
    priority !== undefined || dealValue !== undefined || followUpAt !== undefined;
  if (wantsAdvanced && !plan.advancedCrm) {
    return NextResponse.json(
      { error: "Advanced CRM fields are Premium. Upgrade to unlock follow-ups, priority, and deal value.", upgrade: true },
      { status: 403 }
    );
  }

  if (priority !== undefined) {
    if (!CRM_PRIORITIES.includes(priority as (typeof CRM_PRIORITIES)[number])) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    updates.priority = priority as (typeof CRM_PRIORITIES)[number];
  }
  if (dealValue !== undefined) {
    if (dealValue == null || dealValue === "") {
      updates.dealValue = null;
    } else {
      const n = Number(dealValue);
      if (Number.isNaN(n) || n < 0) return NextResponse.json({ error: "Invalid deal value" }, { status: 400 });
      updates.dealValue = Math.floor(n);
    }
  }
  if (followUpAt !== undefined) {
    if (followUpAt === null || followUpAt === "") {
      updates.followUpAt = null;
    } else {
      const d = new Date(followUpAt);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid follow-up date" }, { status: 400 });
      updates.followUpAt = d;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(schema.crmEntries).set(updates).where(eq(schema.crmEntries.id, id));
  return NextResponse.json({ ok: true });
}
