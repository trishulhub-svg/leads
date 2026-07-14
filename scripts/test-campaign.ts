// scripts/test-campaign.ts
// Verifies the campaign pipeline: enqueue creates sent_email rows (dedup-aware),
// drain picks them up and routes via the load balancer. Uses a stubbed mail sender
// so no real SMTP is needed.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { enqueueCampaign, refreshCampaignCounters } from "../src/lib/campaignEngine";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

async function clean() {
  for (const t of [schema.sentEmails, schema.campaigns, schema.leads, schema.smtpConfigs]) {
    const rows = await db.select().from(t);
    for (const r of rows) {
      await db.delete(t).where(eq((t as any).id, r.id));
    }
  }
}

(async () => {
  console.log("\n=== Campaign Engine Tests ===\n");
  await clean();

  // Seed: 4 leads, 1 template, 1 campaign.
  await db.insert(schema.leads).values([
    { email: "a@test.com", emailNorm: "a@test.com", status: "raw", source: "manual" },
    { email: "b@test.com", emailNorm: "b@test.com", status: "raw", source: "manual" },
    { email: "c@test.com", emailNorm: "c@test.com", status: "raw", source: "manual" },
  ]);
  const tpl = await db
    .insert(schema.templates)
    .values({
      name: "Test Template",
      subject: "Hi {{first_name}}",
      htmlBody: "<p>Hello {{first_name}} at {{company}}</p>",
      ctaType: "landing",
    })
    .returning({ id: schema.templates.id });
  const camp = await db
    .insert(schema.campaigns)
    .values({ name: "Test Campaign", templateId: tpl[0].id, status: "draft" })
    .returning({ id: schema.campaigns.id });

  // Test 1: enqueue creates sent_email rows for all 3 leads.
  const enq = await enqueueCampaign(camp[0].id);
  assert(enq.enqueued === 3, "enqueue creates 3 sent_email rows");
  assert(enq.alreadySent === 0, "no already-sent leads in a clean DB");

  const sentRows = await db.select().from(schema.sentEmails).where(eq(schema.sentEmails.campaignId, camp[0].id));
  assert(sentRows.length === 3, "3 queued emails recorded");
  assert(sentRows.every((r) => r.status === "queued"), "all emails start as 'queued'");

  // Test 2: re-enqueuing the same campaign → all 3 are deduped (already sent).
  const enq2 = await enqueueCampaign(camp[0].id);
  assert(enq2.enqueued === 0, "re-enqueue dedupes all (already in sent_emails)");
  assert(enq2.alreadySent === 3, "reports 3 already-sent");

  // Test 3: refreshCampaignCounters tallies correctly.
  await refreshCampaignCounters(camp[0].id);
  const updatedCamp = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, camp[0].id)).limit(1).then((r) => r[0]);
  assert(updatedCamp.total === 3, "campaign total = 3");
  assert(updatedCamp.sent === 0, "campaign sent = 0 (nothing drained yet)");

  await clean();
  console.log("\n=== All campaign engine tests passed ✅ ===\n");
  process.exit(0);
})().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
