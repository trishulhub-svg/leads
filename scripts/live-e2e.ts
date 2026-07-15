// scripts/live-e2e.ts — live HTTP test against the running dev server.
// Mints a valid session cookie, then exercises import + leads listing + template CRUD.
import fs from "fs";
import path from "path";
import { SignJWT } from "jose/jwt/sign";

const BASE = process.env.BASE_URL || "http://localhost:3000";

/** Prefer the value Next.js loads from `.env` (shell AUTH_SECRET can diverge). */
function authSecretFromDotenv(): string {
  const envPath = path.resolve(process.cwd(), ".env");
  const line = fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .find((row) => row.startsWith("AUTH_SECRET="));
  const fromFile = line?.slice("AUTH_SECRET=".length).trim();
  const secret = fromFile || process.env.AUTH_SECRET || "";
  if (secret.length < 32) throw new Error("AUTH_SECRET missing or too short in .env");
  return secret;
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

async function mintCookie(): Promise<string> {
  const secret = new TextEncoder().encode(authSecretFromDotenv());
  const token = await new SignJWT({ id: 1, name: "Founder", email: "founder@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("1")
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(secret);
  return `tl_session=${token}`;
}

(async () => {
  console.log("\n=== Live E2E (import + leads + templates) ===\n");
  const cookie = await mintCookie();
  const h = { Cookie: cookie, "Content-Type": "application/json" };

  // 1. Import leads via CSV (multipart)
  const stamp = Date.now();
  const csv = `email,first_name,company\nnitin${stamp}@shreeja.in,Nitin,Shreeja Foods\npriya${stamp}@lotusdental.in,Priya,Lotus Dental\ninvalid-row,No,Body\nnitin${stamp}@shreeja.in,Dup,Dup\n`;
  const fd = new FormData();
  fd.append("file", new Blob([csv], { type: "text/csv" }), "leads.csv");
  fd.append("niche", "E2E Test");
  const importRes = await fetch(`${BASE}/api/leads/import`, { method: "POST", headers: { Cookie: cookie }, body: fd });
  const importData = await importRes.json();
  assert(importRes.ok && importData.ok, "import endpoint returns ok");
  assert(importData.report.added === 2, `import added 2 leads (got ${importData.report.added})`);
  assert(importData.report.duplicatesInFile === 1, `1 in-file duplicate collapsed (got ${importData.report.duplicatesInFile})`);
  // Invalid CSV rows are filtered during parse (before dedup), so they never reach the report.

  // 2. Leads listing shows the imported leads
  const listRes = await fetch(`${BASE}/api/leads?limit=100`, { headers: h });
  const listData = await listRes.json();
  const emails = (listData.leads as any[]).map((l) => l.email);
  assert(emails.includes(`nitin${stamp}@shreeja.in`), "imported lead nitin appears in directory");
  assert(emails.includes(`priya${stamp}@lotusdental.in`), "imported lead priya appears in directory");
  const nitin = (listData.leads as any[]).find((l) => l.email === `nitin${stamp}@shreeja.in`);
  assert(nitin.niche === "E2E Test", "imported lead carries the default niche");
  assert(nitin.source === "csv", "imported lead marked as csv source");

  // 3. Search filters leads
  const searchRes = await fetch(`${BASE}/api/leads?q=lotus&limit=100`, { headers: h });
  const searchData = await searchRes.json();
  assert(
    searchData.leads.some((l: any) => l.email === `priya${stamp}@lotusdental.in`),
    "search finds lead by company"
  );

  // 4. Templates — list defaults
  let tRes = await fetch(`${BASE}/api/templates`, { headers: h });
  let tData = await tRes.json();
  const startCount = tData.templates.length;
  assert(startCount >= 1, `templates list returns ${startCount} templates`);

  // 5. Create a new template
  const createRes = await fetch(`${BASE}/api/templates`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      name: "E2E Custom Template",
      subject: "Hey {{first_name}} from {{company}}",
      htmlBody: "<p>Hi {{first_name}}, quick note for {{company}}.</p>",
      ctaType: "whatsapp",
      ctaUrl: "https://wa.me/919999999999",
    }),
  });
  const createData = await createRes.json();
  assert(createRes.ok && createData.ok && createData.id, "template create returns new id");
  const newId = createData.id;

  // 6. Edit + save the template
  const putRes = await fetch(`${BASE}/api/templates`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ id: newId, subject: "Updated subject for {{company}}" }),
  });
  assert(putRes.ok, "template update returns ok");
  tRes = await fetch(`${BASE}/api/templates`, { headers: h });
  tData = await tRes.json();
  const saved = tData.templates.find((t: any) => t.id === newId);
  assert(saved && saved.subject === "Updated subject for {{company}}", "template edit persisted");

  // 7. Validation: empty body rejected
  const badRes = await fetch(`${BASE}/api/templates`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "Bad", subject: "x", htmlBody: "   " }),
  });
  assert(badRes.status === 400, "empty body template rejected with 400");

  // 8. Delete the template
  const delRes = await fetch(`${BASE}/api/templates`, {
    method: "DELETE",
    headers: h,
    body: JSON.stringify({ id: newId }),
  });
  assert(delRes.ok, "template delete returns ok");
  tRes = await fetch(`${BASE}/api/templates`, { headers: h });
  tData = await tRes.json();
  assert(tData.templates.length === startCount, "template count back to start after delete");
  assert(!tData.templates.find((t: any) => t.id === newId), "deleted template no longer listed");

  // 9. Scrape route should be gone (removed)
  const scrapeRes = await fetch(`${BASE}/api/leads/scrape`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ url: "https://example.com" }),
  });
  assert(scrapeRes.status === 404 || scrapeRes.status === 405, `scrape endpoint removed (status ${scrapeRes.status})`);

  console.log("\n=== All live E2E checks passed ✅ ===\n");
  process.exit(0);
})().catch((e) => {
  console.error("E2E error:", e);
  process.exit(1);
});
