// src/app/api/smtp/route.ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { SMTP_ROLES } from "@/drizzle/schema";

export const dynamic = "force-dynamic";

/** List all SMTP configs (passwords never exposed). */
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(schema.smtpConfigs).orderBy(schema.smtpConfigs.role, schema.smtpConfigs.id);
  const safe = rows.map((r) => ({
    id: r.id,
    label: r.label,
    role: r.role,
    host: r.host,
    port: r.port,
    secure: r.secure,
    user: r.user,
    hasPassword: Boolean(r.passEnc),
    fromName: r.fromName,
    fromEmail: r.fromEmail,
    dailyLimit: r.dailyLimit,
    sentToday: r.sentToday,
    healthy: r.healthy,
    lastError: r.lastError,
    lastCheckedAt: r.lastCheckedAt,
    imapHost: r.imapHost,
    imapPort: r.imapPort,
    imapUser: r.imapUser,
    hasImapPassword: Boolean(r.imapPassEnc),
    createdAt: r.createdAt,
  }));
  return NextResponse.json({ configs: safe });
}

/** Create or update an SMTP config. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    id,
    label,
    role,
    host,
    port,
    secure,
    user: smtpUser,
    password, // plaintext from the form; only set if user typed a new one
    fromName,
    fromEmail,
    dailyLimit,
    imapHost,
    imapPort,
    imapSecure,
    imapUser,
    imapPassword,
  } = body;

  if (!label || !host || !smtpUser || !fromEmail) {
    return NextResponse.json({ error: "Label, host, user, and from email are required." }, { status: 400 });
  }
  if (!SMTP_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  // Enforce the 8-SMTP cap (4 primary + 4 emergency).
  if (!id) {
    const existing = await db
      .select({ id: schema.smtpConfigs.id, role: schema.smtpConfigs.role })
      .from(schema.smtpConfigs)
      .where(eq(schema.smtpConfigs.role, role));
    if (existing.length >= 4) {
      return NextResponse.json(
        { error: `You already have 4 ${role} SMTPs. That's the maximum per role.` },
        { status: 400 }
      );
    }
  }

  const portNum = Number(port) || 587;
  const values: Partial<typeof schema.smtpConfigs.$inferInsert> = {
    label,
    role,
    host,
    port: portNum,
    secure: secure ?? portNum === 465,
    user: smtpUser,
    fromName: fromName || "Trishulhub",
    fromEmail,
    dailyLimit: Number(dailyLimit) || 500,
    imapHost: imapHost || null,
    imapPort: imapPort ? Number(imapPort) : 993,
    imapSecure: imapSecure ?? true,
    imapUser: imapUser || null,
  };

  // Only re-encrypt if a new plaintext password was provided.
  if (password) values.passEnc = await encrypt(password);
  if (imapPassword) values.imapPassEnc = await encrypt(imapPassword);

  if (id) {
    await db.update(schema.smtpConfigs).set(values).where(eq(schema.smtpConfigs.id, id));
    return NextResponse.json({ ok: true, id });
  } else {
    if (!password) return NextResponse.json({ error: "Password is required for a new SMTP." }, { status: 400 });
    const inserted = await db
      .insert(schema.smtpConfigs)
      .values(values as typeof schema.smtpConfigs.$inferInsert)
      .returning({ id: schema.smtpConfigs.id });
    return NextResponse.json({ ok: true, id: inserted[0].id });
  }
}

/** Delete an SMTP config. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(schema.smtpConfigs).where(eq(schema.smtpConfigs.id, id));
  return NextResponse.json({ ok: true });
}
