// src/app/(dashboard)/crm/page.tsx
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CrmView } from "./crm-view";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { getPlanLimits } from "@/lib/plan";
import { ensureCrmAdvancedColumns } from "@/lib/ensure-crm-advanced-columns";
import { Handshake, KanbanSquare, MessageSquare, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  await ensureCrmAdvancedColumns();
  const [plan, entries] = await Promise.all([
    getPlanLimits(),
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
      .innerJoin(schema.leads, eq(schema.crmEntries.leadId, schema.leads.id)),
  ]);

  const contacted = entries.filter((entry) => entry.stage === "contacted").length;
  const discussed = entries.filter((entry) => entry.stage === "discussed").length;
  const done = entries.filter((entry) => entry.stage === "done").length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Advanced reply pipeline"
        icon={KanbanSquare}
        title="CRM command center"
        description="Move every reply through contacted → discussed → done. Premium adds follow-ups, deal value, analytics, and conversation history."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard compact icon={MessageSquare} label="New conversations" value={contacted} detail="Awaiting discussion" />
        <StatCard compact icon={Handshake} label="In discussion" value={discussed} detail="Active opportunities" tone="warning" />
        <StatCard compact icon={Trophy} label="Completed" value={done} detail="Successful outcomes" tone="success" />
      </div>
      <CrmView
        plan={plan}
        initialEntries={entries.map((e) => ({
          ...e,
          dealValue: e.dealValue,
          priority: e.priority ?? "normal",
          followUpAt: e.followUpAt ? e.followUpAt.toISOString() : null,
          firstRepliedAt: e.firstRepliedAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
