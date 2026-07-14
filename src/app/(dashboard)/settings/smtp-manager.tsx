// src/app/(dashboard)/settings/smtp-manager.tsx
"use client";
import * as React from "react";
import { Plus, Trash2, Plug, Loader2, CheckCircle2, XCircle, ShieldAlert, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  healthy: boolean;
  lastError: string | null;
  lastCheckedAt: string | null;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapUser: string | null;
  hasImapPassword: boolean;
};

export function SmtpManager({ initial }: { initial: SmtpRow[] }) {
  const [configs, setConfigs] = React.useState<SmtpRow[]>(initial);
  const [editing, setEditing] = React.useState<SmtpRow | "new" | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Refresh from server after mutations.
  React.useEffect(() => {
    let active = true;
    fetch("/api/smtp")
      .then((r) => r.json())
      .then((d) => {
        if (active && d.configs) setConfigs(d.configs);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const primary = configs.filter((c) => c.role === "primary");
  const emergency = configs.filter((c) => c.role === "emergency");

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
      {/* Pool summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <PoolSummary
          title="Primary SMTPs"
          subtitle="Main sending pool — round-robin load balanced"
          total={primary.length}
          healthy={primary.filter((c) => c.healthy && c.sentToday < c.dailyLimit).length}
          accent="primary"
        />
        <PoolSummary
          title="Emergency SMTPs"
          subtitle="Failover pool — used when all Primaries hit limits"
          total={emergency.length}
          healthy={emergency.filter((c) => c.healthy && c.sentToday < c.dailyLimit).length}
          accent="amber"
        />
      </div>

      {/* Primary list */}
      <SmtpList
        title="Primary (4 max)"
        rows={primary}
        accent="primary"
        onEdit={(r) => setEditing(r)}
        onDelete={handleDelete}
        onAdd={primary.length < 4 ? () => setEditing("new") : undefined}
        addLabel="Add Primary SMTP"
      />

      {/* Emergency list */}
      <SmtpList
        title="Emergency (4 max)"
        rows={emergency}
        accent="amber"
        onEdit={(r) => setEditing(r)}
        onDelete={handleDelete}
        onAdd={emergency.length < 4 ? () => setEditing("new") : undefined}
        addLabel="Add Emergency SMTP"
      />

      {editing && (
        <SmtpEditor
          initial={editing === "new" ? null : editing}
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
    <Card>
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
            <Badge variant={healthy > 0 ? "success" : "destructive"}>
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
}: {
  title: string;
  rows: SmtpRow[];
  accent: "primary" | "amber";
  onEdit: (r: SmtpRow) => void;
  onDelete: (id: number) => void;
  onAdd?: () => void;
  addLabel: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {onAdd && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-4 w-4" /> {addLabel}
          </Button>
        )}
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
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
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
            <p className="mt-1 text-xs text-muted-foreground">
              Sent today: {row.sentToday}/{row.dailyLimit}
              {row.imapHost && <span className="ml-2">· IMAP: {row.imapHost}</span>}
            </p>
            {row.lastError && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-3 w-3" /> {row.lastError}
              </p>
            )}
            {testResult && (
              <p className={cn("mt-1 text-xs", testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                {testResult.msg}
              </p>
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
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
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
  onClose,
  onSaved,
}: {
  initial: SmtpRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isEdit = !!initial;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>{isEdit ? "Edit SMTP" : "Add SMTP"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="label" className="text-xs">Label *</Label>
                <Input id="label" name="label" defaultValue={initial?.label} required placeholder="Brevo Primary" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-xs">Role *</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue={initial?.role ?? "primary"}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="primary">Primary</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outbound SMTP</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="host" className="text-xs">Host *</Label>
                  <Input id="host" name="host" defaultValue={initial?.host} required placeholder="smtp-relay.brevo.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="port" className="text-xs">Port *</Label>
                  <Input id="port" name="port" type="number" defaultValue={initial?.port ?? 587} required />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fromName" className="text-xs">From name</Label>
                <Input id="fromName" name="fromName" defaultValue={initial?.fromName ?? "Taroon"} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fromEmail" className="text-xs">From email *</Label>
                <Input id="fromEmail" name="fromEmail" type="email" defaultValue={initial?.fromEmail} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dailyLimit" className="text-xs">Daily sending limit</Label>
              <Input id="dailyLimit" name="dailyLimit" type="number" defaultValue={initial?.dailyLimit ?? 500} />
              <p className="text-xs text-muted-foreground">When this SMTP hits the limit, it auto-fails over to the next.</p>
            </div>

            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Inbound IMAP (for reply monitoring)</summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="imapHost" className="text-xs">IMAP host</Label>
                    <Input id="imapHost" name="imapHost" defaultValue={initial?.imapHost ?? ""} placeholder="imap.gmail.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imapPort" className="text-xs">IMAP port</Label>
                    <Input id="imapPort" name="imapPort" type="number" defaultValue={initial?.imapPort ?? 993} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                <p className="text-xs text-muted-foreground">
                  Fill this in to let the system monitor this inbox for replies and auto-promote leads into the CRM.
                </p>
              </div>
            </details>

            {error && <p className="text-sm text-destructive">{error}</p>}

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
