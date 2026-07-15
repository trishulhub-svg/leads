// src/lib/email-template-html.ts
// Compiles visual template fields into email-safe HTML (brand-neutral placeholders).

export type VisualTemplate = {
  preheader: string;
  headline: string;
  body: string;
  ctaLabel: string;
  /** When set, overrides workspace accent for this template's button. */
  buttonColor?: string;
};

const VISUAL_MARKER = "EMAIL_VISUAL";

function toBase64(value: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(value, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(value)));
}

function fromBase64(value: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(value, "base64").toString("utf8");
  return decodeURIComponent(escape(atob(value)));
}

export function encodeVisualMarker(visual: VisualTemplate): string {
  return `<!--${VISUAL_MARKER}:${toBase64(JSON.stringify(visual))}-->`;
}

export function decodeVisualMarker(html: string): VisualTemplate | null {
  const match = html.match(/<!--EMAIL_VISUAL:([A-Za-z0-9+/=]+)-->/);
  if (!match) return null;
  try {
    return JSON.parse(fromBase64(match[1])) as VisualTemplate;
  } catch {
    return null;
  }
}

/** Convert plain text (with blank lines) into simple email paragraphs / bullets. */
export function bodyTextToHtml(body: string): string {
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return `<p style="margin:0 0 14px;">Hi {{first_name}},</p>`;
  }

  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const isList = lines.length > 0 && lines.every((l) => /^[-*•]/.test(l));
      if (isList) {
        const items = lines
          .map((l) => l.replace(/^[-*•]\s*/, ""))
          .map((l) => `<li style="margin-bottom:6px;">${escapeHtml(l)}</li>`)
          .join("");
        return `<ul style="margin:0 0 14px;padding-left:18px;">${items}</ul>`;
      }
      // Allow merge tags through; escape the rest carefully by only escaping <>& outside {{ }}
      return `<p style="margin:0 0 14px;">${lines.map((l) => escapeKeepingMergeTags(l)).join("<br/>")}</p>`;
    })
    .join("\n");
}

function escapeKeepingMergeTags(s: string): string {
  // Split around merge tags so {{first_name}} stays intact.
  return s
    .split(/(\{\{[^}]+\}\})/g)
    .map((part) => (/^\{\{[^}]+\}\}$/.test(part) ? part : escapeHtml(part)))
    .join("");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function compileVisualEmailHtml(visual: VisualTemplate, buttonColor = "{{brand_color}}"): string {
  const color = buttonColor || "{{brand_color}}";
  const bodyHtml = bodyTextToHtml(visual.body);
  const marker = encodeVisualMarker(visual);

  return `${marker}
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(visual.headline || "Email")}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(visual.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#0f172a;padding:20px 28px;">
              {{logo_block}}
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#93c5fd;font-weight:700;">{{brand_name}}</p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#ffffff;font-weight:600;">${escapeHtml(visual.headline)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:15px;line-height:1.65;">
              ${bodyHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                <tr>
                  <td style="border-radius:8px;background:${color};">
                    <a href="{{cta_url}}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(visual.ctaLabel || "Learn more")}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#1f2937;">Warm regards,<br/><strong>{{sender_name}}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#6b7280;">
                You’re receiving this email from {{brand_name}}. If this isn’t relevant, you can unsubscribe below.
              </p>
              <a href="{{unsubscribe_url}}" style="display:inline-block;padding:10px 18px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;font-size:12px;font-weight:600;color:#334155;text-decoration:none;">Unsubscribe</a>
              <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;">
                {{brand_name}} · <a href="{{unsubscribe_url}}" style="color:#6b7280;">Unsubscribe from future emails</a>
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

export function defaultVisual(partial?: Partial<VisualTemplate>): VisualTemplate {
  return {
    preheader: partial?.preheader ?? "A short note for {{company}}.",
    headline: partial?.headline ?? "A quick introduction",
    body:
      partial?.body ??
      `Hi {{first_name}},

I came across {{company}} and wanted to reach out.

Would it be worth a short conversation this week?`,
    ctaLabel: partial?.ctaLabel ?? "Book a call",
    buttonColor: partial?.buttonColor,
  };
}
