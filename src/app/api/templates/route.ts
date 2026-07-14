// src/app/api/templates/route.ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await db.select().from(schema.templates).orderBy(schema.templates.id);
  return NextResponse.json({ templates });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, name, subject, htmlBody, ctaType, ctaUrl } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db
    .update(schema.templates)
    .set({
      ...(name !== undefined && { name }),
      ...(subject !== undefined && { subject }),
      ...(htmlBody !== undefined && { htmlBody }),
      ...(ctaType !== undefined && { ctaType }),
      ...(ctaUrl !== undefined && { ctaUrl }),
    })
    .where(eq(schema.templates.id, id));
  return NextResponse.json({ ok: true });
}
