// scripts/test-unsubscribe.ts
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { interpolate } from "../src/lib/email";
import { createUnsubscribeUrl, suppressEmail, verifyUnsubscribeToken } from "../src/lib/unsubscribe";
import { defaultTemplates } from "../src/lib/default-templates";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

(async () => {
  console.log("\n=== Unsubscribe + template checks ===\n");

  process.env.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const url = await createUnsubscribeUrl("prospect@acme-test.io");
  assert(url.includes("/unsubscribe?token="), "unsubscribe URL contains token");
  const token = new URL(url).searchParams.get("token")!;
  const verified = await verifyUnsubscribeToken(token);
  assert(verified.ok === true && verified.ok && verified.email === "prospect@acme-test.io", "token verifies to normalized email");

  await db.delete(schema.leads).where(eq(schema.leads.emailNorm, "prospect@acme-test.io"));
  await db.insert(schema.leads).values({
    email: "prospect@acme-test.io",
    emailNorm: "prospect@acme-test.io",
    source: "manual",
    status: "raw",
  });
  await suppressEmail("prospect@acme-test.io");
  const row = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.emailNorm, "prospect@acme-test.io"))
    .limit(1)
    .then((r) => r[0]);
  assert(row?.status === "blacklisted", "suppress blacklists the lead");

  const templates = defaultTemplates();
  assert(templates.length === 4, "four professional templates defined");
  for (const t of templates) {
    assert(t.htmlBody.includes("{{unsubscribe_url}}"), `${t.name} includes unsubscribe button merge tag`);
    assert(t.htmlBody.includes("{{cta_url}}"), `${t.name} includes cta_url merge tag`);
    assert(t.htmlBody.includes(">Unsubscribe<"), `${t.name} has visible Unsubscribe button`);
    const rendered = interpolate(t.htmlBody, {
      firstName: "Aarav",
      company: "Acme",
      email: "aarav@acme.io",
      ctaUrl: t.ctaUrl,
      unsubscribeUrl: url,
    });
    assert(rendered.includes(url), `${t.name} renders working unsubscribe href`);
    assert(!rendered.includes("{{unsubscribe_url}}"), `${t.name} leaves no unsubscribe placeholder`);
    assert(!rendered.includes("{{first_name}}"), `${t.name} leaves no first_name placeholder`);
  }

  await db.delete(schema.leads).where(eq(schema.leads.emailNorm, "prospect@acme-test.io"));
  console.log("\n=== All unsubscribe/template checks passed ✅ ===\n");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
