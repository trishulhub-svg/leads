// src/app/(dashboard)/campaigns/campaigns-view.tsx
"use client";
import * as React from "react";
import { Send, Plus, Loader2, Mail, Eye, MessageSquare, Megaphone, Users, LayoutList, FileText, FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { TemplatesManager, type EmailTemplate, type BrandPublic } from "./templates-manager";
import type { PlanLimits } from "@/lib/plan-constants";

type Campaign = {
  id: number;
  name: string;
  templateId: number | null;
  status: string;
  niche: string | null;
  total: number;
  sent: number;
  failed: number;
  opened: number;
  replied: number;
  createdAt: string;
};

type Template = EmailTemplate;

export function CampaignsView({
  initialCampaigns,
  templates: initialTemplates,
  initialBrand,
  plan,
  leadCount,
}: {
  initialCampaigns: Campaign[];
  templates: Template[];
  initialBrand: BrandPublic;
  plan: PlanLimits;
  leadCount: number;
}) {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>(initialCampaigns);
  const [templates, setTemplates] = React.useState<Template[]>(initialTemplates);
  const [tab, setTab] = React.useState<"campaigns" | "templates">("campaigns");
  const [showCreate, setShowCreate] = React.useState(false);
  const [sending, setSending] = React.useState<number | null>(null);
  const [testingId, setTestingId] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);

  // Free plan: campaigns may only use the first (included) template.
  const usableTemplates =
    plan.plan === "premium" ? templates : templates.length > 0 ? [templates[0]] : [];

  async function refresh() {
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns || []);
  }

  async function refreshTemplates() {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.templates || []);
  }

  async function sendCampaign(id: number) {
    if (!confirm("Send this campaign now? Emails will be queued and sent across your SMTP pool.")) return;
    setSending(id);
    setResult(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({
          ok: true,
          msg: `Queued ${data.enqueued} emails (skipped ${data.alreadySent} already-sent). Sent ${data.sent} this run; remaining will continue via cron.`,
        });
      } else {
        setResult({ ok: false, msg: data.error || "Send failed." });
      }
      refresh();
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Send failed." });
    }
    setSending(null);
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border bg-muted/30 p-1">
        <Button
          size="sm"
          variant={tab === "campaigns" ? "default" : "ghost"}
          onClick={() => setTab("campaigns")}
          aria-pressed={tab === "campaigns"}
        >
          <LayoutList className="h-4 w-4" /> Campaigns
        </Button>
        <Button
          size="sm"
          variant={tab === "templates" ? "default" : "ghost"}
          onClick={() => setTab("templates")}
          aria-pressed={tab === "templates"}
        >
          <FileText className="h-4 w-4" /> Email templates
        </Button>
      </div>

      {tab === "templates" ? (
        <TemplatesManager initialTemplates={templates} initialBrand={initialBrand} plan={plan} onChanged={refreshTemplates} />
      ) : (
        <div className="space-y-4">
      {result && (
        <Alert variant={result.ok ? "success" : "error"}>{result.msg}</Alert>
      )}

      <div className="flex flex-col gap-3 rounded-xl border bg-card/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 text-primary" /> <strong className="text-foreground">{leadCount}</strong> leads ready
          </span>
          <button
            type="button"
            onClick={() => setTab("templates")}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
          >
            <Mail className="h-4 w-4 text-violet-500" /> <strong className="text-foreground">{templates.length}</strong> templates
          </button>
        </div>
        <Button onClick={() => setShowCreate((s) => !s)}>
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </div>

      {showCreate && (
        <CreateCampaignForm
          templates={usableTemplates}
          plan={plan}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first focused outreach campaign and turn your lead pool into conversations."
          action={<Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />Create campaign</Button>}
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const template = templates.find((t) => t.id === c.templateId);
            return (
              <Card key={c.id} className="group transition-all duration-200 hover:border-primary/20 hover:shadow-lg hover:shadow-slate-950/[0.04]">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-semibold tracking-tight">{c.name}</span>
                        <StatusBadge status={c.status} />
                        {c.niche && <Badge variant="secondary">{c.niche}</Badge>}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {template ? `${template.name} · ${template.subject}` : "No template"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {c.sent}/{c.total} sent
                        </span>
                        {c.opened > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {c.opened} opened
                          </span>
                        )}
                        {c.replied > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {c.replied} replied
                          </span>
                        )}
                        {c.failed > 0 && <span className="text-destructive">{c.failed} failed</span>}
                        <span>· {timeAgo(c.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:items-end">
                      <div className="flex w-full gap-2 sm:w-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => setTestingId((cur) => (cur === c.id ? null : c.id))}
                          disabled={sending === c.id}
                        >
                          <FlaskConical className="h-4 w-4" />
                          Test 1 email
                        </Button>
                        {(c.status === "draft" || c.status === "paused" || c.status === "sending") && (
                          <Button size="sm" className="w-full sm:w-auto" onClick={() => sendCampaign(c.id)} disabled={sending === c.id}>
                            {sending === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {c.status === "sending" ? "Continue sending" : "Send"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {testingId === c.id && (
                    <TestSendForm
                      campaignId={c.id}
                      templateName={template?.name}
                      onClose={() => setTestingId(null)}
                      onResult={(r) => {
                        setResult(r);
                        if (r.ok) setTestingId(null);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary" | "default"> = {
    done: "success",
    sending: "warning",
    failed: "destructive",
    draft: "secondary",
    paused: "secondary",
  };
  return (
    <Badge variant={map[status] ?? "default"} className="capitalize">
      {status}
    </Badge>
  );
}

function TestSendForm({
  campaignId,
  templateName,
  onClose,
  onResult,
}: {
  campaignId: number;
  templateName?: string;
  onClose: () => void;
  onResult: (r: { ok: boolean; msg: string }) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const to = String(fd.get("to") || "").trim();
    const firstName = String(fd.get("firstName") || "").trim();
    const company = String(fd.get("company") || "").trim();

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, firstName: firstName || undefined, company: company || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Test send failed.");
        setLoading(false);
        return;
      }
      onResult({
        ok: true,
        msg: data.message || `Test email sent to ${data.to}. Subject: ${data.subject}`,
      });
    } catch (err: any) {
      setError(err?.message || "Network error.");
    }
    setLoading(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 space-y-3 rounded-xl border border-teal-500/25 bg-teal-500/[0.06] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="h-4 w-4 text-teal-700 dark:text-teal-300" />
            Test campaign — 1 email
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Sends this campaign&apos;s template{templateName ? ` (${templateName})` : ""} to one address via your SMTP.
            Does not start bulk send and does not block that email from future campaigns.
          </p>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close test form">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor={`test-to-${campaignId}`} className="text-xs">
            Recipient email *
          </Label>
          <Input
            id={`test-to-${campaignId}`}
            name="to"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`test-fn-${campaignId}`} className="text-xs">
            First name (optional)
          </Label>
          <Input id={`test-fn-${campaignId}`} name="firstName" placeholder="Aarav" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`test-co-${campaignId}`} className="text-xs">
            Company (optional)
          </Label>
          <Input id={`test-co-${campaignId}`} name="company" placeholder="Acme Labs" />
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send test email
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CreateCampaignForm({
  templates,
  plan,
  onCreated,
}: {
  templates: Template[];
  plan: PlanLimits;
  onCreated: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        templateId: Number(fd.get("templateId")) || null,
        niche: fd.get("niche") || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) setError(data.error || "Failed to create");
    else onCreated();
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/[0.025]">
      <CardContent className="p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Create a new campaign</h3>
          <p className="mt-1 text-xs text-muted-foreground">Choose a template and optionally narrow your audience by niche.</p>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Campaign name *</Label>
            <Input id="name" name="name" required placeholder="July Outreach — SaaS" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="templateId" className="text-xs">Template</Label>
            <Select
              id="templateId"
              name="templateId"
              defaultValue={templates[0]?.id ?? ""}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            {plan.plan === "free" && (
              <p className="text-[11px] text-muted-foreground">Free plan includes 1 template. Upgrade for more.</p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="niche" className="text-xs">Niche (optional — filters leads by niche)</Label>
            <Input id="niche" name="niche" placeholder="e.g. SaaS, Agencies, E-commerce" />
          </div>
          {error && <Alert variant="error" className="sm:col-span-2">{error}</Alert>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create campaign
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
