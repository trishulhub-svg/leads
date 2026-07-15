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
  ImagePlus,
  Palette,
  Type,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { PremiumGate, PremiumChip } from "@/components/premium-gate";
import { UPGRADE_WHATSAPP } from "@/lib/plan";
import type { PlanLimits } from "@/lib/plan";
import {
  compileVisualEmailHtml,
  decodeVisualMarker,
  defaultVisual,
  type VisualTemplate,
} from "@/lib/email-template-html";
import { interpolate } from "@/lib/template-interpolate";

export type EmailTemplate = {
  id: number;
  name: string;
  subject: string;
  htmlBody: string;
  ctaType: string;
  ctaUrl: string | null;
};

export type BrandPublic = {
  brandName: string;
  senderName: string;
  accentColor: string;
  hasLogo: boolean;
  logoUrl: string | null;
};

type Draft = {
  name: string;
  subject: string;
  htmlBody: string;
  ctaType: string;
  ctaUrl: string;
  visual: VisualTemplate;
};

const MERGE_CHIPS = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{company}}", label: "Company" },
  { token: "{{brand_name}}", label: "Brand" },
  { token: "{{sender_name}}", label: "Sender" },
];

function toDraft(t: EmailTemplate): Draft {
  const visual = decodeVisualMarker(t.htmlBody) || defaultVisual({
    headline: t.name,
    body: "Hi {{first_name}},\n\nWrite your message for {{company}} here.",
    ctaLabel: "Learn more",
  });
  return {
    name: t.name,
    subject: t.subject,
    htmlBody: t.htmlBody,
    ctaType: t.ctaType,
    ctaUrl: t.ctaUrl ?? "",
    visual,
  };
}

function blankDraft(): Draft {
  const visual = defaultVisual();
  return {
    name: "",
    subject: "{{company}} — a note from {{brand_name}}",
    htmlBody: compileVisualEmailHtml(visual),
    ctaType: "landing",
    ctaUrl: "https://example.com",
    visual,
  };
}

export function TemplatesManager({
  initialTemplates,
  initialBrand,
  plan,
  onChanged,
}: {
  initialTemplates: EmailTemplate[];
  initialBrand: BrandPublic;
  plan: PlanLimits;
  onChanged?: () => void;
}) {
  const [templates, setTemplates] = React.useState<EmailTemplate[]>(initialTemplates);
  const [brand, setBrand] = React.useState<BrandPublic>(initialBrand);
  const freeTemplateId = templates[0]?.id ?? null;
  const canCreateMore = templates.length < plan.maxTemplates;
  const [brandDraft, setBrandDraft] = React.useState({
    brandName: initialBrand.brandName,
    senderName: initialBrand.senderName,
    accentColor: initialBrand.accentColor,
  });
  const [selectedId, setSelectedId] = React.useState<number | "new" | null>(
    initialTemplates[0]?.id ?? null
  );
  const [draft, setDraft] = React.useState<Draft>(
    initialTemplates[0] ? toDraft(initialTemplates[0]) : blankDraft()
  );
  const [saving, setSaving] = React.useState(false);
  const [savingBrand, setSavingBrand] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [tab, setTab] = React.useState<"visual" | "html" | "preview">("visual");
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  function blankDraftInit() {
    if (!canCreateMore) {
      setResult({
        ok: false,
        msg: plan.plan === "free" ? "Free plan allows 1 email template. Upgrade to Premium for more." : "Template limit reached.",
      });
      return;
    }
    setSelectedId("new");
    setDraft(blankDraft());
    setResult(null);
    setTab("visual");
  }

  function selectTemplate(t: EmailTemplate) {
    if (plan.plan === "free" && freeTemplateId != null && t.id !== freeTemplateId) {
      setResult({ ok: false, msg: "This template is Premium. Upgrade to unlock all templates." });
      return;
    }
    setSelectedId(t.id);
    setDraft(toDraft(t));
    setResult(null);
    setTab("visual");
  }

  async function refresh(): Promise<EmailTemplate[]> {
    const res = await fetch("/api/templates");
    const data = await res.json();
    const list: EmailTemplate[] = data.templates || [];
    setTemplates(list);
    onChanged?.();
    return list;
  }

  function updateVisual<K extends keyof VisualTemplate>(key: K, value: VisualTemplate[K]) {
    setDraft((d) => {
      const visual = { ...d.visual, [key]: value };
      return {
        ...d,
        visual,
        htmlBody: compileVisualEmailHtml(visual, value === undefined ? d.visual.buttonColor : visual.buttonColor),
      };
    });
  }

  function rebuildFromVisual(visual: VisualTemplate, ctaType?: string) {
    const color = ctaType === "whatsapp" ? "#16a34a" : visual.buttonColor;
    return compileVisualEmailHtml({ ...visual, buttonColor: color }, color);
  }

  function insertIntoBody(token: string) {
    const el = bodyRef.current;
    const current = draft.visual.body;
    if (!el) {
      updateVisual("body", current + token);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    updateVisual("body", next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

  async function saveBrand() {
    setSavingBrand(true);
    setResult(null);
    try {
      const res = await fetch("/api/settings/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brandDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save brand.");
      setBrand(data.brand);
      setResult({ ok: true, msg: "Brand settings saved. They apply to all templates on send." });
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Could not save brand." });
    }
    setSavingBrand(false);
  }

  async function onLogoSelected(file: File | null) {
    if (!file) return;
    setSavingBrand(true);
    setResult(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Could not read logo file.");
      const res = await fetch("/api/settings/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoMime: match[1], logoBase64: match[2] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not upload logo.");
      setBrand(data.brand);
      setResult({ ok: true, msg: "Logo uploaded." });
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Could not upload logo." });
    }
    setSavingBrand(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function clearLogo() {
    setSavingBrand(true);
    try {
      const res = await fetch("/api/settings/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearLogo: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove logo.");
      setBrand(data.brand);
      setResult({ ok: true, msg: "Logo removed." });
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Could not remove logo." });
    }
    setSavingBrand(false);
  }

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      const htmlBody =
        tab === "html"
          ? draft.htmlBody
          : rebuildFromVisual(draft.visual, draft.ctaType);
      const payload = {
        name: draft.name,
        subject: draft.subject,
        htmlBody,
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
    if (!confirm("Delete this template?")) return;
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

  const previewHtml = React.useMemo(() => {
    const html =
      tab === "html" ? draft.htmlBody : rebuildFromVisual(draft.visual, draft.ctaType);
    return interpolate(html, {
      firstName: "Aarav",
      company: "Acme Labs",
      email: "aarav@acmelabs.com",
      ctaUrl: draft.ctaUrl || "https://example.com",
      unsubscribeUrl: "https://example.com/unsubscribe",
      brandName: brandDraft.brandName || brand.brandName,
      senderName: brandDraft.senderName || brand.senderName,
      brandColor: brandDraft.accentColor || brand.accentColor,
      logoUrl: brand.logoUrl ? `${brand.logoUrl}?t=${Date.now()}` : null,
    });
  }, [draft, tab, brand, brandDraft]);

  return (
    <div className="space-y-4">
      {/* Brand settings */}
      <div className="rounded-xl border bg-card/95 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Palette className="h-4 w-4 text-primary" /> Your email brand
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Used across every template — change the name, sender, color, and logo anytime.
            </p>
          </div>
          <Button size="sm" onClick={saveBrand} disabled={savingBrand}>
            {savingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save brand
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_140px_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name" className="text-xs">Brand name</Label>
            <Input
              id="brand-name"
              value={brandDraft.brandName}
              onChange={(e) => setBrandDraft((b) => ({ ...b, brandName: e.target.value }))}
              placeholder="Acme Outreach"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sender-name" className="text-xs">Sign-off name</Label>
            <Input
              id="sender-name"
              value={brandDraft.senderName}
              onChange={(e) => setBrandDraft((b) => ({ ...b, senderName: e.target.value }))}
              placeholder="Acme Team"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-color" className="text-xs">Accent color</Label>
            <div className="flex gap-2">
              <Input
                id="brand-color"
                type="color"
                value={brandDraft.accentColor}
                onChange={(e) => setBrandDraft((b) => ({ ...b, accentColor: e.target.value }))}
                className="h-10 w-14 cursor-pointer p-1"
              />
              <Input
                value={brandDraft.accentColor}
                onChange={(e) => setBrandDraft((b) => ({ ...b, accentColor: e.target.value }))}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Logo</Label>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                {brand.hasLogo && brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${brand.logoUrl}?v=1`} alt="Brand logo" className="h-full w-full object-contain" />
                ) : (
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => onLogoSelected(e.target.files?.[0] || null)}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={savingBrand}>
                Upload
              </Button>
              {brand.hasLogo && (
                <Button type="button" size="sm" variant="ghost" onClick={clearLogo} disabled={savingBrand}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Template list */}
        <div className="space-y-3">
          {canCreateMore ? (
            <Button onClick={blankDraftInit} variant="outline" className="w-full justify-start">
              <Plus className="h-4 w-4" /> New template
            </Button>
          ) : (
            <a
              href={UPGRADE_WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-800 dark:text-amber-300"
            >
              <Lock className="h-4 w-4" /> More templates · Premium
            </a>
          )}
          <div className="space-y-1.5">
            {templates.map((t, index) => {
              const locked = plan.plan === "free" && freeTemplateId != null && t.id !== freeTemplateId;
              return (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                aria-current={selectedId === t.id ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all",
                  locked && "opacity-70",
                  selectedId === t.id
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border bg-card/60 hover:border-primary/20 hover:bg-muted/40"
                )}
              >
                <span className="flex w-full items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold">{t.name}</span>
                  {locked && <PremiumChip label="Locked" />}
                  {!locked && index === 0 && plan.plan === "free" && (
                    <Badge variant="secondary" className="text-[10px]">Free</Badge>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">{t.subject}</span>
              </button>
            )})}
            {selectedId === "new" && (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm font-medium text-primary">
                <Plus className="h-3.5 w-3.5" /> New template (unsaved)
              </div>
            )}
          </div>
          {plan.plan === "free" && templates.length > 1 && (
            <PremiumGate
              compact
              title="Unlock all templates"
              description="Free plan includes 1 editable template. Upgrade for a full template library."
            />
          )}
        </div>

        {/* Editor */}
        <div className="min-w-0 space-y-4 rounded-xl border bg-card/95 p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-xl border bg-muted/30 p-1">
              <Button size="sm" variant={tab === "visual" ? "default" : "ghost"} onClick={() => setTab("visual")} aria-pressed={tab === "visual"}>
                <Type className="h-4 w-4" /> Visual
              </Button>
              <Button size="sm" variant={tab === "html" ? "default" : "ghost"} onClick={() => setTab("html")} aria-pressed={tab === "html"}>
                <Code2 className="h-4 w-4" /> HTML
              </Button>
              <Button size="sm" variant={tab === "preview" ? "default" : "ghost"} onClick={() => setTab("preview")} aria-pressed={tab === "preview"}>
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
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {selectedId === "new" ? "Create template" : "Save changes"}
              </Button>
            </div>
          </div>

          {result && <Alert variant={result.ok ? "success" : "error"}>{result.msg}</Alert>}

          {tab === "visual" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-name" className="text-xs">Template name *</Label>
                  <Input id="tpl-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Cold Intro" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-subject" className="text-xs">Subject line *</Label>
                  <Input id="tpl-subject" value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} placeholder="{{company}} — quick idea" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-headline" className="text-xs">Email headline</Label>
                  <Input id="tpl-headline" value={draft.visual.headline} onChange={(e) => updateVisual("headline", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-preheader" className="text-xs">Preview text (inbox snippet)</Label>
                  <Input id="tpl-preheader" value={draft.visual.preheader} onChange={(e) => updateVisual("preheader", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="tpl-body" className="text-xs">Message</Label>
                  <div className="flex flex-wrap gap-1">
                    {MERGE_CHIPS.map((chip) => (
                      <button
                        key={chip.token}
                        type="button"
                        onClick={() => insertIntoBody(chip.token)}
                        className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                      >
                        {chip.token}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  id="tpl-body"
                  ref={bodyRef}
                  value={draft.visual.body}
                  onChange={(e) => updateVisual("body", e.target.value)}
                  className="min-h-[200px] text-sm leading-relaxed"
                  placeholder={"Hi {{first_name}},\n\nYour message…"}
                />
                <p className="text-[11px] text-muted-foreground">
                  Use blank lines for new paragraphs. Start lines with - for bullet lists.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-cta-label" className="text-xs">Button text</Label>
                  <Input id="tpl-cta-label" value={draft.visual.ctaLabel} onChange={(e) => updateVisual("ctaLabel", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-cta" className="text-xs">Button type</Label>
                  <Select
                    id="tpl-cta"
                    value={draft.ctaType}
                    onChange={(e) => {
                      const ctaType = e.target.value;
                      setDraft((d) => ({
                        ...d,
                        ctaType,
                        htmlBody: rebuildFromVisual(d.visual, ctaType),
                      }));
                    }}
                  >
                    <option value="landing">Landing / link</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="none">None</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-cta-url" className="text-xs">Button URL</Label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="tpl-cta-url"
                      value={draft.ctaUrl}
                      onChange={(e) => setDraft((d) => ({ ...d, ctaUrl: e.target.value }))}
                      className="pl-9"
                      placeholder="https://…"
                      disabled={draft.ctaType === "none"}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "html" && (
            <div className="space-y-2">
              <Label htmlFor="tpl-html" className="text-xs">HTML body</Label>
              <Textarea
                id="tpl-html"
                value={draft.htmlBody}
                onChange={(e) => setDraft((d) => ({ ...d, htmlBody: e.target.value }))}
                spellCheck={false}
                className="min-h-[420px] font-mono text-xs leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">
                Advanced mode. Keep <code className="rounded bg-muted px-1">{"{{unsubscribe_url}}"}</code> and{" "}
                <code className="rounded bg-muted px-1">{"{{brand_name}}"}</code> for correct branding.
              </p>
            </div>
          )}

          {tab === "preview" && (
            <div className="space-y-3">
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subject</p>
                <p className="mt-1 text-sm font-medium">
                  {interpolate(draft.subject, {
                    firstName: "Aarav",
                    company: "Acme Labs",
                    brandName: brandDraft.brandName || brand.brandName,
                  })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{brandDraft.brandName || brand.brandName}</Badge>
                  <Badge variant="outline" className="capitalize">{draft.ctaType}</Badge>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border bg-white">
                <iframe title="Email preview" className="h-[480px] w-full" sandbox="" srcDoc={previewHtml} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
