// src/app/api/templates/route.ts
// Full CRUD for email templates (single-owner).
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CTA_TYPES, type CtaType } from "../../../../drizzle/schema";

export const dynamic = "force-dynamic";

type TemplateInput = {
  name?: unknown;
  subject?: unknown;
  htmlBody?: unknown;
  ctaType?: unknown;
  ctaUrl?: unknown;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCta(value: unknown): CtaType {
  return CTA_TYPES.includes(value as CtaType) ? (value as CtaType) : "none";
}

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await db.select().from(schema.templates).orderBy(schema.templates.id);
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as TemplateInput;

  const { getPlanLimits } = await import("@/lib/plan");
  const limits = await getPlanLimits();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.templates);
  if (Number(count) >= limits.maxTemplates) {
    return NextResponse.json(
      {
        error:
          limits.plan === "free"
            ? "Free plan allows 1 email template. Upgrade to Premium for more templates."
            : `Template limit reached (${limits.maxTemplates}).`,
        upgrade: limits.plan === "free",
      },
      { status: 403 }
    );
  }

  const name = clean(body.name);
  const subject = clean(body.subject);
  const htmlBody = typeof body.htmlBody === "string" ? body.htmlBody : "";
  if (!name) return NextResponse.json({ error: "Template name is required." }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Subject line is required." }, { status: 400 });
  if (!htmlBody.trim()) return NextResponse.json({ error: "Email body cannot be empty." }, { status: 400 });

  const ctaType = normalizeCta(body.ctaType);
  const ctaUrl = clean(body.ctaUrl) || null;

  const inserted = await db
    .insert(schema.templates)
    .values({ name, subject, htmlBody, ctaType, ctaUrl })
    .returning({ id: schema.templates.id });

  return NextResponse.json({ ok: true, id: inserted[0].id });
}

export async function PUT(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as TemplateInput & { id?: unknown };
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { getPlanLimits, isTemplateAllowed } = await import("@/lib/plan");
  const limits = await getPlanLimits();
  if (limits.plan === "free") {
    const allIds = await db
      .select({ id: schema.templates.id })
      .from(schema.templates)
      .orderBy(schema.templates.id);
    if (!isTemplateAllowed(
      limits,
      id,
      allIds.map((r) => r.id)
    )) {
      return NextResponse.json(
        { error: "This template is Premium. Upgrade to unlock all templates.", upgrade: true },
        { status: 403 }
      );
    }
  }

  const updates: Partial<typeof schema.templates.$inferInsert> = {};
  if (body.name !== undefined) {
    const name = clean(body.name);
    if (!name) return NextResponse.json({ error: "Template name is required." }, { status: 400 });
    updates.name = name;
  }
  if (body.subject !== undefined) {
    const subject = clean(body.subject);
    if (!subject) return NextResponse.json({ error: "Subject line is required." }, { status: 400 });
    updates.subject = subject;
  }
  if (body.htmlBody !== undefined) {
    if (typeof body.htmlBody !== "string" || !body.htmlBody.trim()) {
      return NextResponse.json({ error: "Email body cannot be empty." }, { status: 400 });
    }
    updates.htmlBody = body.htmlBody;
  }
  if (body.ctaType !== undefined) updates.ctaType = normalizeCta(body.ctaType);
  if (body.ctaUrl !== undefined) updates.ctaUrl = clean(body.ctaUrl) || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await db.update(schema.templates).set(updates).where(eq(schema.templates.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
  const templateId = Number(id);
  if (!templateId) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Keep at least one template so campaigns always have something to reference.
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.templates);
  if (Number(count) <= 1) {
    return NextResponse.json({ error: "You must keep at least one template." }, { status: 400 });
  }

  // Detach any campaigns still pointing at this template before removing it.
  await db
    .update(schema.campaigns)
    .set({ templateId: null })
    .where(eq(schema.campaigns.templateId, templateId));
  await db.delete(schema.templates).where(eq(schema.templates.id, templateId));

  return NextResponse.json({ ok: true });
}
