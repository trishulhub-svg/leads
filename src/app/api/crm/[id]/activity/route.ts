// src/app/api/crm/[id]/activity/route.ts
// Premium: reply timeline for a CRM opportunity.
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPlanLimits } from "@/lib/plan";
import { ensureCrmAdvancedColumns } from "@/lib/ensure-crm-advanced-columns";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plan = await getPlanLimits();
  if (!plan.advancedCrm) {
    return NextResponse.json(
      { error: "Reply timeline is a Premium feature. Upgrade to unlock.", upgrade: true },
      { status: 403 }
    );
  }

  await ensureCrmAdvancedColumns();
  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const entry = await db
    .select({
      id: schema.crmEntries.id,
      leadId: schema.crmEntries.leadId,
      email: schema.leads.email,
      firstName: schema.leads.firstName,
      company: schema.leads.company,
      stage: schema.crmEntries.stage,
      notes: schema.crmEntries.notes,
      dealValue: schema.crmEntries.dealValue,
      priority: schema.crmEntries.priority,
      followUpAt: schema.crmEntries.followUpAt,
      firstRepliedAt: schema.crmEntries.firstRepliedAt,
    })
    .from(schema.crmEntries)
    .innerJoin(schema.leads, eq(schema.crmEntries.leadId, schema.leads.id))
    .where(eq(schema.crmEntries.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const replies = await db
    .select({
      id: schema.replyLog.id,
      fromEmail: schema.replyLog.fromEmail,
      subject: schema.replyLog.subject,
      snippet: schema.replyLog.snippet,
      classification: schema.replyLog.classification,
      receivedAt: schema.replyLog.receivedAt,
    })
    .from(schema.replyLog)
    .where(eq(schema.replyLog.leadId, entry.leadId))
    .orderBy(desc(schema.replyLog.receivedAt))
    .limit(30);

  return NextResponse.json({
    entry: {
      ...entry,
      followUpAt: entry.followUpAt ? entry.followUpAt.toISOString() : null,
      firstRepliedAt: entry.firstRepliedAt.toISOString(),
    },
    replies: replies.map((r) => ({
      ...r,
      receivedAt: r.receivedAt.toISOString(),
    })),
  });
}
