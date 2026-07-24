// src/app/api/smtp/test/route.ts
// Verifies an SMTP connection (transporter.verify()) without sending mail.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { testConnection, markFailure } from "@/lib/smtpLoadBalancer";
import { assertSafeHost } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { configId, testData } = await req.json();

  // If testData provided (testing a NEW config before saving), build a one-off transporter.
  if (testData) {
    // Block internal/private hosts so this can't be used to probe the network.
    try {
      await assertSafeHost(String(testData.host || ""));
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err?.message || "Invalid SMTP host." }, { status: 200 });
    }
    const nodemailer = await import("nodemailer");
    try {
      const t = nodemailer.createTransport({
        host: testData.host,
        port: Number(testData.port) || 587,
        secure: testData.secure ?? Number(testData.port) === 465,
        auth: { user: testData.user, pass: testData.password },
      });
      await t.verify();
      return NextResponse.json({ ok: true, message: "Connection successful." });
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: friendlySmtpError(err) }, { status: 200 });
    }
  }

  // Otherwise test an existing saved config.
  const row = await db
    .select()
    .from(schema.smtpConfigs)
    .where(eq(schema.smtpConfigs.id, configId))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await testConnection(row);
    return NextResponse.json({ ok: true, message: "Connection successful." });
  } catch (err: any) {
    await markFailure(row.id, err?.message ?? String(err));
    return NextResponse.json({ ok: false, error: friendlySmtpError(err) }, { status: 200 });
  }
}

/** Translate common SMTP errors into founder-friendly messages. */
function friendlySmtpError(err: any): string {
  const msg = String(err?.message || err);
  if (/EAUTH|Invalid login|authentication/i.test(msg)) {
    return "Authentication failed — check your username and password.";
  }
  if (/ECONNECTION|connect ETIMEDOUT|Greeting never received/i.test(msg)) {
    return "Could not connect — check the host and port, and that the provider allows SMTP access.";
  }
  if (/EENVELOPE|self.?signed|certificate|SSL|TLS/i.test(msg)) {
    return "TLS/certificate error — try toggling the Secure option or matching the port (465=secure, 587=STARTTLS).";
  }
  return msg;
}
