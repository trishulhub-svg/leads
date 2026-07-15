// scripts/test-leads.ts
// Verifies the dedup + import logic:
//  - invalid emails rejected
//  - in-file duplicates collapsed
//  - already-existing leads skipped
//  - already-sent emails rejected (the hard CRM rule)
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { importLeads } from "../src/lib/dedup";
import { extractEmails, normalizeEmail } from "../src/lib/normalize";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

async function cleanLeads() {
  for (const l of await db.select().from(schema.leads)) {
    await db.delete(schema.leads).where(eq(schema.leads.id, l.id));
  }
  for (const s of await db.select().from(schema.sentEmails)) {
    await db.delete(schema.sentEmails).where(eq(schema.sentEmails.id, s.id));
  }
}

(async () => {
  console.log("\n=== Leads + Dedup Tests ===\n");
  await cleanLeads();

  // Test 1: extractEmails finds mailto: + plain emails.
  const extracted = extractEmails(
    `<a href="mailto:alice@Example.COM">x</a> contact bob@test.io please NO@example
     docs: user@domain.com and person@example.com`
  );
  assert(extracted.includes("alice@example.com"), "extractEmails decodes mailto: + normalizes case");
  assert(extracted.includes("bob@test.io"), "extractEmails finds plain emails");
  assert(!extracted.includes("no@example"), "extractEmails rejects incomplete addresses");
  assert(!extracted.includes("user@domain.com"), "extractEmails rejects common placeholder addresses");
  assert(!extracted.includes("person@example.com"), "extractEmails rejects reserved example domains");

  // Test 2: import adds valid leads.
  const r1 = await importLeads(
    [
      { email: "alice@acme.com", firstName: "Alice", company: "Acme" },
      { email: "bob@beta.io", firstName: "Bob" },
      { email: "not-an-email" },
    ],
    "manual",
    "SaaS"
  );
  assert(r1.added === 2, "import adds 2 valid leads (1 invalid rejected)");
  assert(r1.invalid === 1, "invalid email counted");

  // Test 3: re-importing same emails → alreadyLeads.
  const r2 = await importLeads(
    [{ email: "alice@acme.com" }, { email: "carol@gamma.com" }],
    "manual",
    "SaaS"
  );
  assert(r2.alreadyLeads === 1, "re-import skips existing leads");
  assert(r2.added === 1, "only the new lead (carol) is added");

  // Test 4: in-file duplicates collapsed.
  const r3 = await importLeads(
    [{ email: "dup@test.com" }, { email: "DUP@test.com" }, { email: "unique@test.com" }],
    "csv",
    "test"
  );
  assert(r3.duplicatesInFile === 1, "duplicate within the same file is collapsed");
  assert(r3.added === 2, "two unique emails added");

  // Test 5: the HARD CRM RULE — simulate an already-sent email, then verify
  // it CANNOT be re-imported (even as a new lead).
  await db.insert(schema.sentEmails).values({
    email: "sentbefore@delta.com",
    emailNorm: normalizeEmail("sentbefore@delta.com"),
    subject: "old campaign",
    status: "sent",
  });
  const r4 = await importLeads([{ email: "sentbefore@delta.com" }, { email: "fresh@epsilon.com" }], "manual");
  assert(r4.alreadySent === 1, "already-sent email is rejected at import (hard dedup rule)");
  assert(r4.added === 1, "fresh email still imports fine");

  // Test 6: placeholder addresses found in website examples never enter the lead pool.
  const r5 = await importLeads(
    [
      { email: "user@domain.com" },
      { email: "sales@example.com" },
      { email: "real.contact@legitimate-business.co" },
    ],
    "discovery"
  );
  assert(r5.invalid === 2, "placeholder and reserved-domain emails are counted as invalid");
  assert(r5.added === 1, "a legitimate discovered email still imports");

  await cleanLeads();
  console.log("\n=== All leads/dedup tests passed ✅ ===\n");
  process.exit(0);
})().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
