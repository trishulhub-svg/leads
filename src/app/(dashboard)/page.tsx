// src/app/(dashboard)/page.tsx
import { eq, sql, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Eye, MessageSquare, Trophy, Users, Send, KanbanSquare } from "lucide-react";
import { fmtNum, timeAgo } from "@/lib/utils";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your lead generation and email activity.</p>
      </div>

      {/* Primary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile icon={Mail} label="Emails Sent" value={sent} accent="primary" />
        <MetricTile icon={Eye} label="Opens" value={opened} sub={sent > 0 ? `${openRate}% open rate` : undefined} accent="blue" />
        <MetricTile icon={MessageSquare} label="Replies" value={replied} sub={sent > 0 ? `${replyRate}% reply rate` : undefined} accent="indigo" />
        <MetricTile icon={Trophy} label="Converted (Done)" value={converted} accent="emerald" />
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricTile icon={Users} label="Raw Leads" value={leads} accent="slate" />
        <MetricTile icon={KanbanSquare} label="In CRM" value={crm} accent="amber" />
        <MetricTile icon={Send} label="Campaigns" value={totalCampaigns} sub={activeCampaigns > 0 ? `${activeCampaigns} sending` : undefined} accent="violet" />
      </div>

      {/* Recent replies */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Replies</CardTitle>
        </CardHeader>
        <CardContent>
          {recentReplies.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No replies yet. Replies appear here automatically once your campaigns start getting responses.
            </p>
          ) : (
            <div className="space-y-2">
              {recentReplies.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.fromEmail}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.subject || "(no subject)"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ReplyBadge classification={r.classification} />
                    <span className="text-xs text-muted-foreground">{timeAgo(r.receivedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  accent: "primary" | "blue" | "indigo" | "emerald" | "slate" | "amber" | "violet";
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold">{fmtNum(value)}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${colors[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
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
