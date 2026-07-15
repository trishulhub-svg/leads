// src/app/(dashboard)/crm/page.tsx
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CrmView } from "./crm-view";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Handshake, KanbanSquare, MessageSquare, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  // CRM entries joined with leads.
  const entries = await db
    .select({
      id: schema.crmEntries.id,
      leadId: schema.crmEntries.leadId,
      stage: schema.crmEntries.stage,
      notes: schema.crmEntries.notes,
      firstRepliedAt: schema.crmEntries.firstRepliedAt,
      updatedAt: schema.crmEntries.updatedAt,
      email: schema.leads.email,
      firstName: schema.leads.firstName,
      company: schema.leads.company,
      niche: schema.leads.niche,
    })
    .from(schema.crmEntries)
    .innerJoin(schema.leads, eq(schema.crmEntries.leadId, schema.leads.id));
  const contacted = entries.filter((entry) => entry.stage === "contacted").length;
  const discussed = entries.filter((entry) => entry.stage === "discussed").length;
  const done = entries.filter((entry) => entry.stage === "done").length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Reply pipeline"
        icon={KanbanSquare}
        title="Turn replies into relationships"
        description="Focus on prospects who answered, capture context, and move every opportunity toward a clear outcome."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard compact icon={MessageSquare} label="New conversations" value={contacted} detail="Awaiting discussion" />
        <StatCard compact icon={Handshake} label="In discussion" value={discussed} detail="Active opportunities" tone="warning" />
        <StatCard compact icon={Trophy} label="Completed" value={done} detail="Successful outcomes" tone="success" />
      </div>
      <CrmView
        initialEntries={entries.map((e) => ({
          ...e,
          firstRepliedAt: e.firstRepliedAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
