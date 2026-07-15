// src/lib/default-templates.ts
// Canonical Trishulhub outreach templates (shared by seed + runtime sync).
import type { schema } from "./db";

type TemplateInsert = typeof schema.templates.$inferInsert;

function emailShell(opts: {
  preheader: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaColor?: string;
}): string {
  const ctaColor = opts.ctaColor || "#1d4ed8";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${opts.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#0f172a;padding:20px 28px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#93c5fd;font-weight:700;">Trishulhub</p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#ffffff;font-weight:600;">${opts.title}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:15px;line-height:1.65;">
              ${opts.bodyHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                <tr>
                  <td style="border-radius:8px;background:${ctaColor};">
                    <a href="{{cta_url}}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${opts.ctaLabel}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#1f2937;">Warm regards,<br/><strong>Trishulhub Team</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#6b7280;">
                You’re receiving this because your business was added to a Trishulhub outreach list.
                If this isn’t relevant, you can unsubscribe instantly below.
              </p>
              <a href="{{unsubscribe_url}}" style="display:inline-block;padding:10px 18px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;font-size:12px;font-weight:600;color:#334155;text-decoration:none;">Unsubscribe</a>
              <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;">
                Trishulhub · <a href="{{unsubscribe_url}}" style="color:#6b7280;">Unsubscribe from future emails</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function defaultTemplates(): TemplateInsert[] {
  return [
    {
      name: "Cold Intro — Service",
      subject: "{{company}} — a quick idea from Trishulhub",
      ctaType: "landing",
      ctaUrl: "https://trishulhub.com",
      htmlBody: emailShell({
        preheader: "A short note for {{company}} about improving outreach without extra headcount.",
        title: "A thoughtful introduction",
        ctaLabel: "Book a 15-minute call",
        bodyHtml: `<p style="margin:0 0 14px;">Hi {{first_name}},</p>
<p style="margin:0 0 14px;">I came across <strong>{{company}}</strong> and wanted to introduce Trishulhub — we help growth teams run compliant cold outreach with multi-SMTP delivery, hard deduplication, and a CRM that only surfaces people who reply.</p>
<p style="margin:0 0 14px;">If lead quality and reply rate matter this quarter, I’d welcome a brief conversation to see whether we’re a fit.</p>
<p style="margin:0;">Would a 15-minute call this week work?</p>`,
      }),
    },
    {
      name: "Follow-up — Gentle Nudge",
      subject: "Re: {{company}} — following up from Trishulhub",
      ctaType: "whatsapp",
      ctaUrl: "https://wa.me/919662106793?text=" + encodeURIComponent("Hi trishulhub team"),
      htmlBody: emailShell({
        preheader: "Just floating this back up in case my earlier note got buried.",
        title: "Quick follow-up",
        ctaLabel: "Chat on WhatsApp",
        ctaColor: "#16a34a",
        bodyHtml: `<p style="margin:0 0 14px;">Hi {{first_name}},</p>
<p style="margin:0 0 14px;">I wanted to gently follow up on my earlier note to <strong>{{company}}</strong>. I know inboxes get busy.</p>
<p style="margin:0 0 14px;">If email isn’t convenient, I’m happy to answer a couple of questions on WhatsApp — no pitch deck required.</p>
<p style="margin:0;">If the timing isn’t right, just say so and I’ll close the loop.</p>`,
      }),
    },
    {
      name: "Value Offer — Discount",
      subject: "{{first_name}}, a limited onboarding offer for {{company}}",
      ctaType: "landing",
      ctaUrl: "https://trishulhub.com",
      htmlBody: emailShell({
        preheader: "Exclusive onboarding support for {{company}} — available for a limited time.",
        title: "A practical offer for {{company}}",
        ctaLabel: "Claim the offer",
        bodyHtml: `<p style="margin:0 0 14px;">Hi {{first_name}},</p>
<p style="margin:0 0 14px;">For a limited window we’re offering <strong>{{company}}</strong> priority onboarding on the Trishulhub outreach stack.</p>
<p style="margin:0 0 8px;">What’s included:</p>
<ul style="margin:0 0 14px;padding-left:18px;">
  <li style="margin-bottom:6px;">Multi-SMTP sending with automatic failover</li>
  <li style="margin-bottom:6px;">Hard email deduplication across every campaign</li>
  <li style="margin-bottom:6px;">A reply-first CRM so your team only works warm conversations</li>
</ul>
<p style="margin:0;">If helpful, I can walk you through setup in a short call.</p>`,
      }),
    },
    {
      name: "Case Study — Social Proof",
      subject: "How teams like {{company}} improved outreach results",
      ctaType: "landing",
      ctaUrl: "https://trishulhub.com",
      htmlBody: emailShell({
        preheader: "A short case study relevant to teams like {{company}}.",
        title: "Results worth a closer look",
        ctaLabel: "Request the case study",
        bodyHtml: `<p style="margin:0 0 14px;">Hi {{first_name}},</p>
<p style="margin:0 0 14px;">Teams similar to <strong>{{company}}</strong> have used Trishulhub to move from inconsistent manual outreach to a repeatable system — with cleaner lists, safer sending, and clearer reply handling.</p>
<p style="margin:0 0 14px;">I put together a concise case study covering process, safeguards, and outcomes. Happy to share it if useful.</p>
<p style="margin:0;">Would you like me to send it over?</p>`,
      }),
    },
  ];
}
