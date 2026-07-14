// drizzle/seed.ts
// Creates the single owner account (from env) and 4 default email templates.
// Idempotent — safe to run repeatedly.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
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
      await db.update(schema.templates).set({ subject: t.subject, htmlBody: t.htmlBody, ctaType: t.ctaType }).where(eq(schema.templates.id, exists.id));
    } else {
      await db.insert(schema.templates).values(t);
    }
  }
  console.log(`[seed] done — ${templates.length} templates.`);
}

function defaultTemplates(): (typeof schema.templates.$inferInsert)[] {
  return [
    {
      name: "Cold Intro — Service",
      subject: "Quick idea for {{company}}",
      ctaType: "landing",
      htmlBody: `<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
  <p>Hi {{first_name}},</p>
  <p>I came across {{company}} and wanted to reach out. We help businesses like yours streamline their outreach and convert more leads into paying customers — without adding headcount.</p>
  <p>Would it be worth a quick 15-minute call this week to see if there's a fit?</p>
  <p style="margin:28px 0">
    <a href="https://your-landing-page.com" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Book a Call</a>
  </p>
  <p>Best,<br/>Taroon</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="font-size:12px;color:#6b7280">You received this email because you opted in or are a relevant business contact. Reply "stop" to unsubscribe.</p>
</div>`,
    },
    {
      name: "Follow-up — Gentle Nudge",
      subject: "Re: Quick idea for {{company}}",
      ctaType: "whatsapp",
      htmlBody: `<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
  <p>Hi {{first_name}},</p>
  <p>Just floating this back to the top of your inbox in case it got buried. I know things get busy.</p>
  <p>If it's easier, I'm happy to answer quick questions over WhatsApp:</p>
  <p style="margin:28px 0">
    <a href="https://wa.me/919999999999" style="display:inline-block;padding:12px 28px;background:#25D366;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Chat on WhatsApp</a>
  </p>
  <p>If the timing isn't right, just let me know.</p>
  <p>Best,<br/>Taroon</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="font-size:12px;color:#6b7280">Reply "stop" to unsubscribe.</p>
</div>`,
    },
    {
      name: "Value Offer — Discount",
      subject: "{{first_name}}, a special offer for {{company}}",
      ctaType: "landing",
      htmlBody: `<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
  <p>Hi {{first_name}},</p>
  <p>For the next 7 days we're offering {{company}} an exclusive 20% onboarding discount on our lead-generation platform.</p>
  <p>Here's what you get:</p>
  <ul>
    <li>Automated email outreach across 8 sending servers</li>
    <li>Smart deduplication — never email the same lead twice</li>
    <li>A minimalist CRM that only surfaces leads who actually reply</li>
  </ul>
  <p style="margin:28px 0">
    <a href="https://your-landing-page.com/offers" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Claim the Offer</a>
  </p>
  <p>Best,<br/>Taroon</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="font-size:12px;color:#6b7280">Reply "stop" to unsubscribe.</p>
</div>`,
    },
    {
      name: "Case Study — Social Proof",
      subject: "How a company like {{company}} grew 3x",
      ctaType: "landing",
      htmlBody: `<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
  <p>Hi {{first_name}},</p>
  <p>Last quarter we helped a client in a similar space go from 20 leads/month to over 600 — using the exact system I'd like to show you.</p>
  <p>The best part: it runs almost on autopilot once it's set up.</p>
  <p>I put together a short case study. Want me to send it over?</p>
  <p style="margin:28px 0">
    <a href="https://your-landing-page.com/case-study" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">See the Case Study</a>
  </p>
  <p>Best,<br/>Taroon</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="font-size:12px;color:#6b7280">Reply "stop" to unsubscribe.</p>
</div>`,
    },
  ];
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
