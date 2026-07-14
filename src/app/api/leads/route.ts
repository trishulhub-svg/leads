// src/app/api/leads/route.ts
// List leads (with search + pagination), and delete.
import { NextResponse } from "next/server";
import { eq, or, like, desc, sql, and, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const status = searchParams.get("status") || "raw";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(200, Number(searchParams.get("limit") || 50));
  const offset = (page - 1) * limit;

  const conditions = [eq(schema.leads.status, status as "raw" | "blacklisted")];
  if (q) {
    conditions.push(
      or(
        like(schema.leads.email, `%${q}%`),
        like(schema.leads.firstName, `%${q}%`),
        like(schema.leads.company, `%${q}%`),
        like(schema.leads.niche, `%${q}%`)
      )!
    );
  }

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(schema.leads)
      .where(and(...conditions))
      .orderBy(desc(schema.leads.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.leads)
      .where(and(...conditions)),
  ]);

  return NextResponse.json({
    leads: rows,
    total: countRow[0].count,
    page,
    limit,
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(schema.leads).where(eq(schema.leads.id, id));
  return NextResponse.json({ ok: true });
}

// Suppress unused import (ne reserved for future status filters).
void ne;
