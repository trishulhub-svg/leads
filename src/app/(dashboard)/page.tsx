// src/app/(dashboard)/page.tsx
import { eq, sql, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Eye, MessageSquare, Trophy, Users, Send, KanbanSquare, Activity, ArrowUpRight } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ProductTour } from "@/components/product-tour";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Aggregate stats in parallel.
  const [sentRow, openedRow, repliedRow, convertedRow, leadRow, crmRow, campaignRow, recentReplies] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(schema.sentEmails).where(eq(schema.sentEmails.status, "sent")),
    db.select({ c: sql<number>`count(*)` }).from(schema.sentEmails).where(sql`${schema.sentEmails.openedAt} is not null`),
    db.select({ c: sql<number>`count(*)` }).from(schema.sentEmails).where(sql`${schema.sentEmails.repliedAt} is not null`),
    db.select({ c: sql<number>`count(*)` }).from(schema.crmEntries).where(eq(schema.crmEntries.stage, "done")),
    db.select({ c: sql<number>`count(*)` }).from(schema.leads).where(eq(schema.leads.status, "raw")),
    db.select({ c: sql<number>`count(*)` }).from(schema.crmEntries),
    db
      .select({
        active: sql<number>`sum(case when ${schema.campaigns.status}='sending' then 1 else 0 end)`,
        total: sql<number>`count(*)`,
      })
      .from(schema.campaigns),
    db
      .select({
        fromEmail: schema.replyLog.fromEmail,
        subject: schema.replyLog.subject,
        classification: schema.replyLog.classification,
        receivedAt: schema.replyLog.receivedAt,
      })
      .from(schema.replyLog)
      .orderBy(desc(schema.replyLog.receivedAt))
      .limit(8),
  ]);

  const sent = sentRow[0]?.c ?? 0;
  const opened = openedRow[0]?.c ?? 0;
  const replied = repliedRow[0]?.c ?? 0;
  const converted = convertedRow[0]?.c ?? 0;
  const leads = leadRow[0]?.c ?? 0;
  const crm = crmRow[0]?.c ?? 0;
  const activeCampaigns = Number(campaignRow[0]?.active ?? 0);
  const totalCampaigns = campaignRow[0]?.total ?? 0;

  const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
  const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Command center"
        icon={Activity}
        title="Good to see you."
        description="A clear view of your outreach performance, conversations, and pipeline health."
      />

      <ProductTour />

      {/* Primary metrics */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Mail} label="Emails sent" value={sent} detail="Total delivered outreach" />
        <StatCard icon={Eye} label="Email opens" value={opened} detail={sent > 0 ? `${openRate}% open rate` : "Awaiting first campaign"} tone="info" />
        <StatCard icon={MessageSquare} label="Replies" value={replied} detail={sent > 0 ? `${replyRate}% reply rate` : "Conversations appear here"} tone="violet" />
        <StatCard icon={Trophy} label="Converted" value={converted} detail="CRM opportunities won" tone="success" />
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.65fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pipeline snapshot</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Current workspace inventory</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 p-3">
            <SnapshotRow icon={Users} label="Raw leads" value={leads} tone="primary" />
            <SnapshotRow icon={KanbanSquare} label="Active in CRM" value={crm} tone="warning" />
            <SnapshotRow
              icon={Send}
              label="Campaigns"
              value={totalCampaigns}
              detail={activeCampaigns > 0 ? `${activeCampaigns} sending now` : "No active sends"}
              tone="violet"
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent replies</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Latest conversations across campaigns</p>
              </div>
              <Badge variant="outline">{recentReplies.length} latest</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {recentReplies.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-lg bg-muted/20 px-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <p className="mt-3 text-sm font-semibold">Your inbox is quiet</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  Replies will appear automatically as prospects respond to your outreach.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentReplies.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/30">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-bold">
                        {r.fromEmail.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.fromEmail}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subject || "(no subject)"}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ReplyBadge classification={r.classification} />
                      <span className="hidden text-[11px] text-muted-foreground sm:inline">{timeAgo(r.receivedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SnapshotRow({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  detail?: string;
  tone: "primary" | "warning" | "violet";
}) {
  const colors = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/30">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{detail || "Ready for action"}</p>
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ReplyBadge({ classification }: { classification: string }) {
  const map: Record<string, "success" | "destructive" | "secondary" | "warning"> = {
    positive: "success",
    negative: "destructive",
    bounce: "destructive",
    autoreply: "secondary",
    neutral: "secondary",
  };
  return (
    <Badge variant={map[classification] ?? "secondary"} className="capitalize">
      {classification}
    </Badge>
  );
}
