// src/app/api/crm/route.ts
// Update a CRM entry's stage and/or notes.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CRM_STAGES } from "@/drizzle/schema";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, stage, notes } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Partial<typeof schema.crmEntries.$inferInsert> = {};
  if (stage !== undefined) {
    if (!CRM_STAGES.includes(stage)) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    updates.stage = stage;
  }
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(schema.crmEntries).set(updates).where(eq(schema.crmEntries.id, id));
  return NextResponse.json({ ok: true });
}
