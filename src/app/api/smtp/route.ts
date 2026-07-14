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

  // For NEW configs, all fields are required with defaults. For UPDATEs, only
  // set fields that were actually provided (omit → don't clobber existing value).
  const isUpdate = Boolean(id);
  const portNum = port !== undefined ? Number(port) || 587 : undefined;
  const values: Partial<typeof schema.smtpConfigs.$inferInsert> = {};

  if (label !== undefined) values.label = label;
  if (role !== undefined) values.role = role;
  if (host !== undefined) values.host = host;
  if (portNum !== undefined) values.port = portNum;
  if (secure !== undefined) values.secure = secure;
  else if (portNum !== undefined) values.secure = portNum === 465;
  if (smtpUser !== undefined) values.user = smtpUser;
  if (fromName !== undefined) values.fromName = fromName || "Trishulhub";
  if (fromEmail !== undefined) values.fromEmail = fromEmail;
  if (dailyLimit !== undefined) values.dailyLimit = Number(dailyLimit) || 500;
  if (imapHost !== undefined) values.imapHost = imapHost || null;
  if (imapPort !== undefined) values.imapPort = imapPort ? Number(imapPort) : 993;
  if (imapSecure !== undefined) values.imapSecure = imapSecure;
  if (imapUser !== undefined) values.imapUser = imapUser || null;

  // Only re-encrypt if a new plaintext password was provided.
  if (password) values.passEnc = await encrypt(password);
  if (imapPassword) values.imapPassEnc = await encrypt(imapPassword);

  if (isUpdate) {
    if (Object.keys(values).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }
    await db.update(schema.smtpConfigs).set(values).where(eq(schema.smtpConfigs.id, id));
    return NextResponse.json({ ok: true, id });
  } else {
    // For new configs, fill in required defaults.
    if (!host) return NextResponse.json({ error: "Host is required." }, { status: 400 });
    if (!smtpUser) return NextResponse.json({ error: "Username is required." }, { status: 400 });
    if (!fromEmail) return NextResponse.json({ error: "From email is required." }, { status: 400 });
    if (!password) return NextResponse.json({ error: "Password is required for a new SMTP." }, { status: 400 });
    const inserted = await db
      .insert(schema.smtpConfigs)
      .values({
        label: label || "SMTP",
        role,
        host,
        port: portNum ?? 587,
        secure: secure ?? portNum === 465,
        user: smtpUser,
        fromName: fromName || "Trishulhub",
        fromEmail,
        dailyLimit: Number(dailyLimit) || 500,
        passEnc: values.passEnc!,
        imapHost: imapHost || null,
        imapPort: imapPort ? Number(imapPort) : 993,
        imapSecure: imapSecure ?? true,
        imapUser: imapUser || null,
        ...(values.imapPassEnc ? { imapPassEnc: values.imapPassEnc } : {}),
      })
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
