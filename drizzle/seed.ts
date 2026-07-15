// drizzle/seed.ts
// Creates the single owner account (from env) and 4 default email templates.
// Idempotent — safe to run repeatedly.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { defaultTemplates } from "../src/lib/default-templates";
// NOTE: tsx (used by `db:seed`) doesn't resolve the @/ path alias, so these use
// relative paths. The rest of the app (run via Next/webpack) uses @/ aliases.

async function seed() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME || "Founder";
  if (!email || !password) {
    throw new Error("OWNER_EMAIL and OWNER_PASSWORD must be set before seeding.");
  }
  if (password.length < 12) {
    throw new Error("OWNER_PASSWORD must be at least 12 characters.");
  }

  console.log(`[seed] ensuring owner ${email}…`);
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1).then((r) => r[0]);
  if (existing) {
    console.log("[seed] owner already exists — leaving password as-is.");
  } else {
    await db.insert(schema.users).values({
      name,
      email,
      password: await hashPassword(password),
    });
    console.log(`[seed] owner created. password set from OWNER_PASSWORD.`);
  }

  console.log("[seed] ensuring default templates…");
  const templates = defaultTemplates();
  for (const t of templates) {
    const exists = await db.select().from(schema.templates).where(eq(schema.templates.name, t.name)).limit(1).then((r) => r[0]);
    if (exists) {
      await db
        .update(schema.templates)
        .set({
          subject: t.subject,
          htmlBody: t.htmlBody,
          ctaType: t.ctaType,
          ctaUrl: t.ctaUrl ?? null,
        })
        .where(eq(schema.templates.id, exists.id));
    } else {
      await db.insert(schema.templates).values(t);
    }
  }
  console.log(`[seed] done — ${templates.length} templates.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
