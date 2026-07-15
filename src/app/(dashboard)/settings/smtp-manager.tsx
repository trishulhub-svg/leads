// src/app/(dashboard)/settings/smtp-manager.tsx
"use client";
import * as React from "react";
import { Plus, Trash2, Plug, Loader2, CheckCircle2, XCircle, ShieldAlert, Server, X, Lock, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { PremiumGate, PremiumChip } from "@/components/premium-gate";
import type { PlanLimits } from "@/lib/plan-constants";
import { UPGRADE_WHATSAPP } from "@/lib/plan-constants";

type SmtpRow = {
  id: number;
  label: string;
  role: "primary" | "emergency";
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  dailyLimit: number;
  sentToday: number;
  monthlyQuota: number;
  sentThisMonth: number;
  monthlyLeft: number;
  totalQuota: number | null;
  sentTotal: number;
  totalLeft: number | null;
  healthy: boolean;
  lastError: string | null;
  lastCheckedAt: string | null;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapUser: string | null;
  hasImapPassword: boolean;
};

export function SmtpManager({ initial, plan }: { initial: SmtpRow[]; plan: PlanLimits }) {
  const [configs, setConfigs] = React.useState<SmtpRow[]>(initial);
  const [editing, setEditing] = React.useState<SmtpRow | "new-primary" | "new-emergency" | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [planState, setPlanState] = React.useState(plan);

  React.useEffect(() => {
    let active = true;
    fetch("/api/smtp")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.configs) setConfigs(d.configs);
        if (d.plan) setPlanState(d.plan);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);
  const primary = configs.filter((c) => c.role === "primary");
  const emergency = configs.filter((c) => c.role === "emergency");
  const canAddPrimary = primary.length < planState.maxPrimarySmtp;
  const canAddEmergency = emergency.length < planState.maxEmergencySmtp;
  const showPremiumSmtpUpsell = planState.plan === "free";

  async function handleDelete(id: number) {
    if (!confirm("Delete this SMTP configuration?")) return;
    await fetch("/api/smtp", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setEditing(null);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <PoolSummary
          title="Primary SMTP"
          subtitle={planState.plan === "free" ? "Free plan · 1 primary included" : "Main sending pool — round-robin"}
          total={primary.length}
          healthy={primary.filter((c) => c.healthy).length}
          accent="primary"
        />
        <PoolSummary
          title="Emergency SMTP"
          subtitle={planState.plan === "free" ? "Free plan · 1 failover included" : "Failover when primaries are exhausted"}
          total={emergency.length}
          healthy={emergency.filter((c) => c.healthy).length}
          accent="amber"
        />
      </div>

      <SmtpList
        title={`Primary (${planState.maxPrimarySmtp} max on ${planState.plan})`}
        rows={primary}
        accent="primary"
        onEdit={(r) => setEditing(r)}
        onDelete={handleDelete}
        onAdd={canAddPrimary ? () => setEditing("new-primary") : undefined}
        addLabel="Add Primary SMTP"
        lockedAdd={
          !canAddPrimary && showPremiumSmtpUpsell
            ? { href: UPGRADE_WHATSAPP, label: "More primary SMTPs" }
            : undefined
        }
      />

      <SmtpList
        title={`Emergency (${planState.maxEmergencySmtp} max on ${planState.plan})`}
        rows={emergency}
        accent="amber"
        onEdit={(r) => setEditing(r)}
        onDelete={handleDelete}
        onAdd={canAddEmergency ? () => setEditing("new-emergency") : undefined}
        addLabel="Add Emergency SMTP"
        lockedAdd={
          !canAddEmergency && showPremiumSmtpUpsell
            ? { href: UPGRADE_WHATSAPP, label: "More emergency SMTPs" }
            : undefined
        }
      />

      {showPremiumSmtpUpsell && (
        <PremiumGate
          title="Smart SMTP pool & higher volume"
          description="Unlock up to 4 primary + 4 emergency SMTPs, smarter load balancing across providers, and higher sending capacity when you need to scale."
        />
      )}

      {editing && (
        <SmtpEditor
          initial={typeof editing === "string" ? null : editing}
          defaultRole={editing === "new-emergency" ? "emergency" : "primary"}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function PoolSummary({
  title,
  subtitle,
  total,
  healthy,
  accent,
}: {
  title: string;
  subtitle: string;
  total: number;
  healthy: number;
  accent: "primary" | "amber";
}) {
  return (
    <Card className="transition-all duration-200 hover:border-primary/20 hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg",
            accent === "primary" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          )}
        >
          <Server className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{title}</p>
            <Badge variant={healthy > 0 ? "success" : total === 0 ? "secondary" : "destructive"}>
              {healthy}/{total} healthy
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SmtpList({
  title,
  rows,
  accent,
  onEdit,
  onDelete,
  onAdd,
  addLabel,
  lockedAdd,
}: {
  title: string;
  rows: SmtpRow[];
  accent: "primary" | "amber";
  onEdit: (r: SmtpRow) => void;
  onDelete: (id: number) => void;
  onAdd?: () => void;
  addLabel: string;
  lockedAdd?: { href: string; label: string };
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          {onAdd && (
            <Button size="sm" variant="outline" onClick={onAdd}>
              <Plus className="h-4 w-4" /> {addLabel}
            </Button>
          )}
          {lockedAdd && (
            <a
              href={lockedAdd.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-800 dark:text-amber-300"
            >
              <Lock className="h-3.5 w-3.5" /> {lockedAdd.label}
              <PremiumChip />
            </a>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No {accent} SMTPs configured. {onAdd && "Add one to start sending."}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <SmtpCard key={row.id} row={row} onEdit={() => onEdit(row)} onDelete={() => onDelete(row.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuotaBar({
  label,
  used,
  total,
  left,
}: {
  label: string;
  used: number;
  total: number;
  left: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const tone = left <= 0 ? "bg-destructive" : pct >= 85 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="min-w-[9rem] flex-1">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">
          {left.toLocaleString()} left · {used.toLocaleString()}/{total.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SmtpCard({ row, onEdit, onDelete }: { row: SmtpRow; onEdit: () => void; onDelete: () => void }) {
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; msg: string } | null>(null);

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId: row.id }),
      });
      const data = await res.json();
      setTestResult({ ok: data.ok, msg: data.ok ? data.message : data.error });
    } catch (err: any) {
      setTestResult({ ok: false, msg: err?.message ?? "Test failed" });
    }
    setTesting(false);
  }

  return (
    <Card className="transition-all duration-200 hover:border-primary/20 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">{row.label}</span>
              {row.healthy ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Healthy
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Unhealthy
                </Badge>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {row.user}@{row.host}:{row.port} · {row.fromName} &lt;{row.fromEmail}&gt;
            </p>
            <div className="flex flex-wrap gap-3 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Quota
              </div>
              <QuotaBar label="Today" used={row.sentToday} total={row.dailyLimit} left={Math.max(0, row.dailyLimit - row.sentToday)} />
              <QuotaBar label="This month" used={row.sentThisMonth} total={row.monthlyQuota} left={row.monthlyLeft} />
              {row.totalQuota != null && row.totalLeft != null && (
                <QuotaBar label="Total" used={row.sentTotal} total={row.totalQuota} left={row.totalLeft} />
              )}
            </div>
            {row.imapHost && <p className="text-xs text-muted-foreground">IMAP: {row.imapHost}</p>}
            {row.lastError && (
              <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-3 w-3" /> {row.lastError}
              </p>
            )}
            {testResult && (
              <Alert variant={testResult.ok ? "success" : "error"} className="py-2 text-xs">
                {testResult.msg}
              </Alert>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="outline" onClick={test} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Test
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive" aria-label={`Delete ${row.label}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SmtpEditor({
  initial,
  defaultRole,
  onClose,
  onSaved,
}: {
  initial: SmtpRow | null;
  defaultRole: "primary" | "emergency";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isEdit = !!initial;
  const headingId = "smtp-editor-title";
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const focusFirst = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [onClose]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      label: fd.get("label"),
      role: fd.get("role"),
      host: fd.get("host"),
      port: fd.get("port"),
      secure: fd.get("secure") === "on",
      user: fd.get("user"),
      fromName: fd.get("fromName"),
      fromEmail: fd.get("fromEmail"),
      dailyLimit: fd.get("dailyLimit"),
      monthlyQuota: fd.get("monthlyQuota"),
      totalQuota: fd.get("totalQuota"),
      imapHost: fd.get("imapHost"),
      imapPort: fd.get("imapPort"),
      imapUser: fd.get("imapUser"),
    };
    const password = String(fd.get("password") || "");
    const imapPassword = String(fd.get("imapPassword") || "");
    if (password) body.password = password;
    if (imapPassword) body.imapPassword = imapPassword;
    if (initial) body.id = initial.id;

    const res = await fetch("/api/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to save");
    } else {
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <Card
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle id={headingId}>{isEdit ? "Edit SMTP connection" : "Add SMTP connection"}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Set provider quotas so remaining capacity stays visible here.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close SMTP editor">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="label" className="text-xs">Label *</Label>
                <Input id="label" name="label" defaultValue={initial?.label} required placeholder="Brevo Primary" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-xs">Role *</Label>
                <Select id="role" name="role" defaultValue={initial?.role ?? defaultRole}>
                  <option value="primary">Primary</option>
                  <option value="emergency">Emergency</option>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outbound SMTP</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="host" className="text-xs">Host *</Label>
                  <Input id="host" name="host" defaultValue={initial?.host} required placeholder="smtp-relay.brevo.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="port" className="text-xs">Port *</Label>
                  <Input id="port" name="port" type="number" defaultValue={initial?.port ?? 587} required />
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="user" className="text-xs">Username *</Label>
                  <Input id="user" name="user" defaultValue={initial?.user} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">
                    Password {isEdit && "(leave blank to keep)"}
                  </Label>
                  <Input id="password" name="password" type="password" required={!isEdit} placeholder={isEdit ? "••••••" : ""} />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" name="secure" defaultChecked={initial?.secure ?? false} />
                Use SSL/TLS (port 465). Leave unchecked for STARTTLS (port 587).
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fromName" className="text-xs">From name</Label>
                <Input id="fromName" name="fromName" defaultValue={initial?.fromName ?? "Your Brand"} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fromEmail" className="text-xs">From email *</Label>
                <Input id="fromEmail" name="fromEmail" type="email" defaultValue={initial?.fromEmail} required />
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Provider email quotas *</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Enter what your SMTP provider allows. We’ll track usage here so you don’t need to check their dashboard.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dailyLimit" className="text-xs">Daily limit</Label>
                  <Input id="dailyLimit" name="dailyLimit" type="number" min={1} defaultValue={initial?.dailyLimit ?? 500} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="monthlyQuota" className="text-xs">Monthly quota *</Label>
                  <Input id="monthlyQuota" name="monthlyQuota" type="number" min={1} defaultValue={initial?.monthlyQuota ?? 10000} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="totalQuota" className="text-xs">Total quota (optional)</Label>
                  <Input
                    id="totalQuota"
                    name="totalQuota"
                    type="number"
                    min={1}
                    defaultValue={initial?.totalQuota ?? ""}
                    placeholder="Leave blank if none"
                  />
                </div>
              </div>
            </div>

            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-medium">Inbound IMAP (for reply monitoring)</summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="imapHost" className="text-xs">IMAP host</Label>
                    <Input id="imapHost" name="imapHost" defaultValue={initial?.imapHost ?? ""} placeholder="imap.gmail.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imapPort" className="text-xs">IMAP port</Label>
                    <Input id="imapPort" name="imapPort" type="number" defaultValue={initial?.imapPort ?? 993} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="imapUser" className="text-xs">IMAP username</Label>
                    <Input id="imapUser" name="imapUser" defaultValue={initial?.imapUser ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imapPassword" className="text-xs">
                      IMAP password {isEdit && "(blank=keep)"}
                    </Label>
                    <Input id="imapPassword" name="imapPassword" type="password" placeholder={isEdit ? "••••••" : ""} />
                  </div>
                </div>
              </div>
            </details>

            {error && <Alert variant="error">{error}</Alert>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? "Save changes" : "Add SMTP"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
