// src/lib/template-interpolate.ts
// Client-safe merge-tag rendering for email templates.

export type TemplateVars = {
  firstName?: string | null;
  company?: string | null;
  email?: string | null;
  ctaUrl?: string | null;
  unsubscribeUrl?: string | null;
  brandName?: string | null;
  senderName?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
};

/** Interpolate merge tags into a template subject or HTML body. */
export function interpolate(html: string, vars: TemplateVars): string {
  const first = vars.firstName || there(vars.email);
  const cta = vars.ctaUrl || "#";
  const unsub = vars.unsubscribeUrl || "#";
  const brandName = vars.brandName || "Your Brand";
  const senderName = vars.senderName || brandName;
  const brandColor = vars.brandColor || "#1d4ed8";
  const logoUrl = vars.logoUrl || "";
  const logoBlock = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeAttr(brandName)}" width="120" style="display:block;max-width:120px;height:auto;margin:0 0 10px;border:0;" />`
    : "";

  return html
    .replace(/\{\{\s*first_name\s*\}\}/gi, escapeHtml(first))
    .replace(/\{\{\s*last_name\s*\}\}/gi, "")
    .replace(/\{\{\s*company\s*\}\}/gi, escapeHtml(vars.company || "your team"))
    .replace(/\{\{\s*email\s*\}\}/gi, escapeHtml(vars.email || ""))
    .replace(/\{\{\s*cta_url\s*\}\}/gi, escapeAttr(cta))
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, escapeAttr(unsub))
    .replace(/\{\{\s*brand_name\s*\}\}/gi, escapeHtml(brandName))
    .replace(/\{\{\s*sender_name\s*\}\}/gi, escapeHtml(senderName))
    .replace(/\{\{\s*brand_color\s*\}\}/gi, escapeAttr(brandColor))
    .replace(/\{\{\s*logo_url\s*\}\}/gi, escapeAttr(logoUrl || "#"))
    .replace(/\{\{\s*logo_block\s*\}\}/gi, logoBlock);
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
