// src/app/(dashboard)/crm/page.tsx
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CrmView } from "./crm-view";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
        <p className="text-sm text-muted-foreground">
          Only leads who replied appear here. Move them across stages: Contacted → Discussed → Done or Wasted.
        </p>
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
