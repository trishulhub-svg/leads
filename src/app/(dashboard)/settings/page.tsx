// src/app/(dashboard)/settings/page.tsx
import { db, schema } from "@/lib/db";
import { ChangePasswordForm } from "./change-password-form";
import { SmtpManager } from "./smtp-manager";
import { AiSettings } from "./ai-settings";
import { getPublicAiConfig } from "@/lib/ai";
import { PageHeader } from "@/components/page-header";
import { PremiumGate } from "@/components/premium-gate";
import { getPlanLimits } from "@/lib/plan";
import { ensureSmtpQuotaColumns } from "@/lib/ensure-smtp-quota-columns";
import { Bot, LockKeyhole, Mail, SlidersHorizontal } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await ensureSmtpQuotaColumns();

  const [smtpRows, user, aiConfig, plan] = await Promise.all([
    db.select().from(schema.smtpConfigs).orderBy(schema.smtpConfigs.role, schema.smtpConfigs.id),
    db.select().from(schema.users).limit(1).then((r) => r[0]),
    getPublicAiConfig(),
    getPlanLimits(),
  ]);

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
    monthlyQuota: r.monthlyQuota,
    sentThisMonth: r.sentThisMonth,
    monthlyLeft: Math.max(0, r.monthlyQuota - r.sentThisMonth),
    totalQuota: r.totalQuota,
    sentTotal: r.sentTotal,
    totalLeft: r.totalQuota == null ? null : Math.max(0, r.totalQuota - r.sentTotal),
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
    <div className="space-y-9">
      <PageHeader
        eyebrow="Workspace controls"
        icon={SlidersHorizontal}
        title="Settings & infrastructure"
        description="Configure intelligence providers, sending infrastructure, and security from one place."
      />

      <div>
        <SectionTitle icon={Bot} title="Lead intelligence" description="AI configuration for discovery relevance and enrichment." />
        {plan.leadIntelligence ? (
          <AiSettings initial={aiConfig} />
        ) : (
          <PremiumGate
            title="Lead intelligence is Premium"
            description="Connect DeepSeek AI to rank and enrich discovered businesses. Upgrade to unlock AI settings and smarter lead scoring."
          />
        )}
      </div>

      <div className="border-t pt-8">
        <SectionTitle icon={Mail} title="Email infrastructure" description="Primary delivery plus emergency failover — with live quota remaining." />
      </div>
      <SmtpManager initial={safeSmtp} plan={plan} />

      <div className="border-t pt-8">
        <SectionTitle icon={LockKeyhole} title="Account security" description="Identity and password controls for this workspace." />
        <div className="max-w-xl rounded-xl border bg-card/95 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-muted/30 p-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
              {(user?.name || "F").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Logged in as</p>
              <p className="truncate font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
