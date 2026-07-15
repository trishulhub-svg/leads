// src/app/(dashboard)/campaigns/page.tsx
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CampaignsView } from "./campaigns-view";
import { PageHeader } from "@/components/page-header";
import { Send } from "lucide-react";
import { syncDefaultTemplates } from "@/lib/sync-templates";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await syncDefaultTemplates();

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

  const safeTemplates = templates.map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    htmlBody: t.htmlBody,
    ctaType: t.ctaType,
    ctaUrl: t.ctaUrl,
  }));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Outreach operations"
        icon={Send}
        title="Campaign control room"
        description="Build focused outreach, craft your email templates, and track every response."
      />

      <CampaignsView
        initialCampaigns={safeCampaigns}
        templates={safeTemplates}
        leadCount={rawCountRow[0]?.count ?? 0}
      />
    </div>
  );
}
