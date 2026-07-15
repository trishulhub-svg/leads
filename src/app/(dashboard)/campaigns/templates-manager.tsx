// src/app/(dashboard)/campaigns/templates-manager.tsx
"use client";
import * as React from "react";
import {
  Plus,
  Save,
  Trash2,
  Loader2,
  Eye,
  Code2,
  FileText,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type EmailTemplate = {
  id: number;
  name: string;
  subject: string;
  htmlBody: string;
  ctaType: string;
  ctaUrl: string | null;
};

type Draft = {
  name: string;
  subject: string;
  htmlBody: string;
  ctaType: string;
  ctaUrl: string;
};

const VARIABLES = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{company}}", label: "Company" },
  { token: "{{email}}", label: "Email" },
  { token: "{{cta_url}}", label: "CTA URL" },
  { token: "{{unsubscribe_url}}", label: "Unsubscribe URL" },
];

const SAMPLE = {
  first_name: "Aarav",
  company: "Acme Labs",
  email: "aarav@acmelabs.com",
  cta_url: "https://trishulhub.com",
  unsubscribe_url: "https://example.com/unsubscribe",
};

const BLANK_BODY = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f6f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
        <tr><td style="background:#0f172a;padding:20px 28px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#93c5fd;font-weight:700;">Trishulhub</p>
        </td></tr>
        <tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:15px;line-height:1.65;">
          <p>Hi {{first_name}},</p>
          <p>I wanted to reach out to {{company}} with a short note.</p>
          <p style="margin:28px 0">
            <a href="{{cta_url}}" style="display:inline-block;padding:13px 28px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">Book a call</a>
          </p>
          <p>Warm regards,<br/><strong>Trishulhub Team</strong></p>
        </td></tr>
        <tr><td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;">
          <a href="{{unsubscribe_url}}" style="display:inline-block;padding:10px 18px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:12px;font-weight:600;color:#334155;text-decoration:none;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

function renderPreview(html: string): string {
  return html
    .replace(/\{\{\s*first_name\s*\}\}/gi, SAMPLE.first_name)
    .replace(/\{\{\s*last_name\s*\}\}/gi, "")
    .replace(/\{\{\s*company\s*\}\}/gi, SAMPLE.company)
    .replace(/\{\{\s*email\s*\}\}/gi, SAMPLE.email)
    .replace(/\{\{\s*cta_url\s*\}\}/gi, SAMPLE.cta_url)
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, SAMPLE.unsubscribe_url);
}

function toDraft(t: EmailTemplate): Draft {
  return {
    name: t.name,
    subject: t.subject,
    htmlBody: t.htmlBody,
    ctaType: t.ctaType,
    ctaUrl: t.ctaUrl ?? "",
  };
}

export function TemplatesManager({
  initialTemplates,
  onChanged,
}: {
  initialTemplates: EmailTemplate[];
  onChanged?: () => void;
}) {
  const [templates, setTemplates] = React.useState<EmailTemplate[]>(initialTemplates);
  const [selectedId, setSelectedId] = React.useState<number | "new" | null>(
    initialTemplates[0]?.id ?? null
  );
  const [draft, setDraft] = React.useState<Draft>(
    initialTemplates[0] ? toDraft(initialTemplates[0]) : blankDraft()
  );
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [tab, setTab] = React.useState<"edit" | "preview">("edit");
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  function blankDraftInit() {
    setSelectedId("new");
    setDraft(blankDraft());
    setResult(null);
    setTab("edit");
  }

  function selectTemplate(t: EmailTemplate) {
    setSelectedId(t.id);
    setDraft(toDraft(t));
    setResult(null);
    setTab("edit");
  }

  async function refresh(): Promise<EmailTemplate[]> {
    const res = await fetch("/api/templates");
    const data = await res.json();
    const list: EmailTemplate[] = data.templates || [];
    setTemplates(list);
    onChanged?.();
    return list;
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function insertVariable(token: string) {
    const el = bodyRef.current;
    if (!el) {
      update("htmlBody", draft.htmlBody + token);
      return;
    }
    const start = el.selectionStart ?? draft.htmlBody.length;
    const end = el.selectionEnd ?? draft.htmlBody.length;
    const next = draft.htmlBody.slice(0, start) + token + draft.htmlBody.slice(end);
    update("htmlBody", next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      const payload = {
        name: draft.name,
        subject: draft.subject,
        htmlBody: draft.htmlBody,
        ctaType: draft.ctaType,
        ctaUrl: draft.ctaUrl,
      };
      const isNew = selectedId === "new";
      const res = await fetch("/api/templates", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? payload : { ...payload, id: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error || "Could not save template." });
      } else {
        const list = await refresh();
        const savedId = isNew ? data.id : selectedId;
        const saved = list.find((t) => t.id === savedId);
        if (saved) selectTemplate(saved);
        setResult({ ok: true, msg: isNew ? "Template created." : "Template saved." });
      }
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Could not save template." });
    }
    setSaving(false);
  }

  async function remove() {
    if (selectedId === "new" || selectedId === null) return;
    if (!confirm("Delete this template? Campaigns using it will keep sending but lose the link.")) return;
    setDeleting(true);
    setResult(null);
    try {
      const res = await fetch("/api/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error || "Could not delete template." });
      } else {
        const list = await refresh();
        if (list[0]) selectTemplate(list[0]);
        else blankDraftInit();
        setResult({ ok: true, msg: "Template deleted." });
      }
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Could not delete template." });
    }
    setDeleting(false);
  }

  const dirty =
    selectedId === "new" ||
    (() => {
      const original = templates.find((t) => t.id === selectedId);
      if (!original) return true;
      return (
        original.name !== draft.name ||
        original.subject !== draft.subject ||
        original.htmlBody !== draft.htmlBody ||
        original.ctaType !== draft.ctaType ||
        (original.ctaUrl ?? "") !== draft.ctaUrl
      );
    })();

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Template list */}
      <div className="space-y-3">
        <Button onClick={blankDraftInit} variant="outline" className="w-full justify-start">
          <Plus className="h-4 w-4" /> New template
        </Button>
        <div className="space-y-1.5">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              aria-current={selectedId === t.id ? "true" : undefined}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all",
                selectedId === t.id
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "border-border bg-card/60 hover:border-primary/20 hover:bg-muted/40"
              )}
            >
              <span className="flex w-full items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-semibold">{t.name}</span>
              </span>
              <span className="truncate text-xs text-muted-foreground">{t.subject}</span>
            </button>
          ))}
          {selectedId === "new" && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm font-medium text-primary">
              <Plus className="h-3.5 w-3.5" /> New template (unsaved)
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="min-w-0 space-y-4 rounded-xl border bg-card/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border bg-muted/30 p-1">
            <Button
              size="sm"
              variant={tab === "edit" ? "default" : "ghost"}
              onClick={() => setTab("edit")}
              aria-pressed={tab === "edit"}
            >
              <Code2 className="h-4 w-4" /> Edit
            </Button>
            <Button
              size="sm"
              variant={tab === "preview" ? "default" : "ghost"}
              onClick={() => setTab("preview")}
              aria-pressed={tab === "preview"}
            >
              <Eye className="h-4 w-4" /> Preview
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {selectedId !== "new" && selectedId !== null && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={remove} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {selectedId === "new" ? "Create template" : "Save changes"}
            </Button>
          </div>
        </div>

        {result && <Alert variant={result.ok ? "success" : "error"}>{result.msg}</Alert>}

        {tab === "edit" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name" className="text-xs">Template name *</Label>
                <Input
                  id="tpl-name"
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Cold Intro — Service"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject" className="text-xs">Subject line *</Label>
                <Input
                  id="tpl-subject"
                  value={draft.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  placeholder="Quick idea for {{company}}"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-cta" className="text-xs">Call to action</Label>
                <Select id="tpl-cta" value={draft.ctaType} onChange={(e) => update("ctaType", e.target.value)}>
                  <option value="landing">Landing page</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="none">None</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-cta-url" className="text-xs">
                  {draft.ctaType === "whatsapp" ? "WhatsApp link / number" : "CTA URL"}
                </Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="tpl-cta-url"
                    value={draft.ctaUrl}
                    onChange={(e) => update("ctaUrl", e.target.value)}
                    placeholder={draft.ctaType === "whatsapp" ? "https://wa.me/9199…" : "https://your-landing.com"}
                    className="pl-9"
                    disabled={draft.ctaType === "none"}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="tpl-body" className="text-xs">Email body (HTML)</Label>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">Insert:</span>
                  {VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVariable(v.token)}
                      className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                      title={`Insert ${v.label}`}
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                id="tpl-body"
                ref={bodyRef}
                value={draft.htmlBody}
                onChange={(e) => update("htmlBody", e.target.value)}
                spellCheck={false}
                className="min-h-[320px] font-mono text-xs leading-relaxed"
                placeholder="<p>Hi {{first_name}}…</p>"
              />
              <p className="text-[11px] text-muted-foreground">
                Use <code className="rounded bg-muted px-1">{"{{first_name}}"}</code>,{" "}
                <code className="rounded bg-muted px-1">{"{{company}}"}</code>,{" "}
                <code className="rounded bg-muted px-1">{"{{cta_url}}"}</code> and{" "}
                <code className="rounded bg-muted px-1">{"{{unsubscribe_url}}"}</code> —
                filled per recipient at send time. Always include an Unsubscribe button with{" "}
                <code className="rounded bg-muted px-1">{"{{unsubscribe_url}}"}</code>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subject</p>
              <p className="mt-1 text-sm font-medium">{renderPreview(draft.subject) || "(no subject)"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">{draft.ctaType}</Badge>
                {draft.ctaUrl && draft.ctaType !== "none" && (
                  <span className="truncate text-[11px] text-muted-foreground">{draft.ctaUrl}</span>
                )}
                <span className="text-[11px] text-muted-foreground">Sample: {SAMPLE.first_name} · {SAMPLE.company}</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border bg-white">
              <iframe
                title="Email preview"
                className="h-[420px] w-full"
                sandbox=""
                srcDoc={renderPreview(draft.htmlBody)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function blankDraft(): Draft {
  return {
    name: "",
    subject: "",
    htmlBody: BLANK_BODY,
    ctaType: "landing",
    ctaUrl: "https://trishulhub.com",
  };
}
