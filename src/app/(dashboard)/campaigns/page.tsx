// src/app/(dashboard)/campaigns/page.tsx
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CampaignsView } from "./campaigns-view";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [campaigns, templates, rawCountRow] = await Promise.all([
    db.select().from(schema.campaigns).orderBy(desc(schema.campaigns.createdAt)),
    db.select().from(schema.templates).orderBy(schema.templates.id),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.leads)
      .where(eq(schema.leads.status, "raw")),
  ]);

  // Serialize dates for client components (Date → ISO string).
  const safeCampaigns = campaigns.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Pick a template, select your leads, and send. Emails are load-balanced across your 8 SMTPs.
        </p>
      </div>

      <CampaignsView initialCampaigns={safeCampaigns} templates={templates} leadCount={rawCountRow[0]?.count ?? 0} />
    </div>
  );
}
