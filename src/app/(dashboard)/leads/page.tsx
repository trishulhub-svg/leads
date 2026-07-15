// src/app/(dashboard)/leads/page.tsx
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { LeadsView } from "./leads-view";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Database, ShieldOff, Upload, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const [leads, stats] = await Promise.all([
    db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.status, "raw"))
      .orderBy(desc(schema.leads.createdAt))
      .limit(100),
    db
      .select({
        raw: sql<number>`sum(case when status='raw' then 1 else 0 end)`,
        blacklisted: sql<number>`sum(case when status='blacklisted' then 1 else 0 end)`,
        total: sql<number>`count(*)`,
      })
      .from(schema.leads),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Lead intelligence"
        icon={Upload}
        title="Build your prospect universe"
        description="Import your contact lists, keep them clean and de-duplicated, and keep your outreach pool ready."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard compact icon={Users} label="Ready to contact" value={stats[0]?.raw ?? 0} detail="Qualified raw leads" />
        <StatCard compact icon={ShieldOff} label="Suppressed" value={stats[0]?.blacklisted ?? 0} detail="Blacklisted contacts" tone="warning" />
        <StatCard compact icon={Database} label="Total database" value={stats[0]?.total ?? 0} detail="All stored contacts" tone="violet" />
      </div>

      <LeadsView
        initialLeads={leads.map((l) => ({
          ...l,
          createdAt: l.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
