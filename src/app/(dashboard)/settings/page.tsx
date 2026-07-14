// src/app/(dashboard)/settings/page.tsx
import { db, schema } from "@/lib/db";
import { ChangePasswordForm } from "./change-password-form";
import { SmtpManager } from "./smtp-manager";
import { AiSettings } from "./ai-settings";
import { getPublicAiConfig } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [smtpRows, user, aiConfig] = await Promise.all([
    db.select().from(schema.smtpConfigs).orderBy(schema.smtpConfigs.role, schema.smtpConfigs.id),
    db.select().from(schema.users).limit(1).then((r) => r[0]),
    getPublicAiConfig(),
  ]);

  // Strip secrets before sending to the client.
  const safeSmtp = smtpRows.map((r) => ({
    id: r.id,
    label: r.label,
    role: r.role,
    host: r.host,
    port: r.port,
    secure: r.secure,
    user: r.user,
    hasPassword: Boolean(r.passEnc),
    fromName: r.fromName,
    fromEmail: r.fromEmail,
    dailyLimit: r.dailyLimit,
    sentToday: r.sentToday,
    healthy: r.healthy,
    lastError: r.lastError,
    lastCheckedAt: r.lastCheckedAt ? r.lastCheckedAt.toISOString() : null,
    imapHost: r.imapHost,
    imapPort: r.imapPort,
    imapSecure: r.imapSecure,
    imapUser: r.imapUser,
    hasImapPassword: Boolean(r.imapPassEnc),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage lead intelligence, email infrastructure, and account security.</p>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Lead intelligence</h2>
        <AiSettings initial={aiConfig} />
      </div>

      <div className="border-t pt-8">
        <h2 className="mb-4 text-lg font-semibold">Email infrastructure</h2>
      </div>
      <SmtpManager initial={safeSmtp} />

      <div className="border-t pt-8">
        <h2 className="mb-4 text-lg font-semibold">Account</h2>
        <div className="max-w-md rounded-lg border bg-card p-5">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Logged in as</p>
            <p className="font-medium">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
