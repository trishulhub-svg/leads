// src/app/(dashboard)/leads/page.tsx
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { LeadsView } from "./leads-view";

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Raw Leads</h1>
          <p className="text-sm text-muted-foreground">
            Leads stay here until they reply to a campaign — then they move to the CRM.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Raw leads" value={stats[0]?.raw ?? 0} />
        <StatTile label="Blacklisted" value={stats[0]?.blacklisted ?? 0} />
        <StatTile label="Total in pool" value={stats[0]?.total ?? 0} />
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

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
