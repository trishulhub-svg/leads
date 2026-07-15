// src/lib/email.ts
// Two entry points:
//  - sendOwnerEmail(): sends a transactional email (OTP, notifications) using the
//    FIRST healthy primary SMTP. Used by auth/forgot-password.
//  - sendCampaignEmail(): sends one campaign email via a resolved SMTP, with
//    template-variable interpolation + a tracking pixel.
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { pickSmtp, resolveSmtp, buildTransporter, markSent, markFailure } from "./smtpLoadBalancer";

/** Send a transactional email to the owner using the first healthy primary SMTP. */
export async function sendOwnerEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const row = await pickSmtp();
  if (!row) throw new Error("No healthy SMTP configured. Add at least one Primary SMTP in Settings.");
  const smtp = await resolveSmtp(row);
  try {
    await smtp.transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to,
      subject,
      html,
    });
    await markSent(smtp.id);
  } catch (err: any) {
    await markFailure(smtp.id, err?.message ?? String(err));
    throw err;
  }
}

export type TemplateVars = {
  firstName?: string | null;
  company?: string | null;
  email?: string | null;
  /** Absolute URL — not HTML-escaped beyond attribute-safe encoding. */
  ctaUrl?: string | null;
  /** Absolute unsubscribe URL. */
  unsubscribeUrl?: string | null;
};

/** Interpolate merge tags into a template subject or HTML body. */
export function interpolate(html: string, vars: TemplateVars): string {
  const first = vars.firstName || there(vars.email);
  const cta = vars.ctaUrl || "#";
  const unsub = vars.unsubscribeUrl || "#";
  return html
    .replace(/\{\{\s*first_name\s*\}\}/gi, escapeHtml(first))
    .replace(/\{\{\s*last_name\s*\}\}/gi, "")
    .replace(/\{\{\s*company\s*\}\}/gi, escapeHtml(vars.company || "your team"))
    .replace(/\{\{\s*email\s*\}\}/gi, escapeHtml(vars.email || ""))
    .replace(/\{\{\s*cta_url\s*\}\}/gi, escapeAttr(cta))
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, escapeAttr(unsub));
}

function there(email?: string | null): string {
  if (!email) return "there";
  const name = email.split("@")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Send a single campaign email. Returns the smtpId used.
 * The caller is responsible for picking the SMTP + recording the sent_email row.
 */
export async function sendCampaignEmail({
  smtp,
  to,
  subject,
  html,
  sentEmailId,
  unsubscribeUrl,
}: {
  smtp: { id: number; fromName: string; fromEmail: string; transporter: import("nodemailer").Transporter };
  to: string;
  subject: string;
  html: string;
  sentEmailId: number;
  unsubscribeUrl?: string | null;
}): Promise<number> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  // Open-tracking pixel (best-effort; many clients block images).
  const pixel = baseUrl
    ? `<img src="${baseUrl}/api/track/open/${sentEmailId}" width="1" height="1" alt="" style="display:none" />`
    : "";

  const headers: Record<string, string> = {
    "X-Sent-By": "trishulhub-leads",
    "X-Sent-Email-Id": String(sentEmailId),
  };
  if (unsubscribeUrl && unsubscribeUrl !== "#") {
    const apiUnsub = unsubscribeUrl.includes("/unsubscribe?")
      ? unsubscribeUrl.replace("/unsubscribe?", "/api/unsubscribe?")
      : unsubscribeUrl;
    headers["List-Unsubscribe"] = `<${apiUnsub}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  await smtp.transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to,
    subject,
    html: html + pixel,
    headers,
  });
  await markSent(smtp.id);
  return smtp.id;
}

/** Build a standalone transporter for a specific SMTP config id (used by test endpoint). */
export async function transporterForConfigId(configId: number) {
  const row = await db
    .select()
    .from(schema.smtpConfigs)
    .where(eq(schema.smtpConfigs.id, configId))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new Error("SMTP config not found");
  return buildTransporter(row);
}
