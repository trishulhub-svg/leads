// src/app/(dashboard)/crm/crm-view.tsx
"use client";
import * as React from "react";
import {
  Search,
  Loader2,
  MessageSquare,
  Download,
  Flag,
  CalendarClock,
  IndianRupee,
  Filter,
  Sparkles,
  Lock,
  X,
  Mail,
  Building2,
  Clock3,
  CheckSquare,
  Square,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { cn, timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { PremiumGate, PremiumChip } from "@/components/premium-gate";
import type { PlanLimits } from "@/lib/plan-constants";
import { UPGRADE_WHATSAPP } from "@/lib/plan-constants";

type Stage = "contacted" | "discussed" | "done" | "wasted";
type Priority = "low" | "normal" | "high";

type Entry = {
  id: number;
  leadId: number;
  stage: Stage;
  notes: string | null;
  dealValue: number | null;
  priority: Priority;
  followUpAt: string | null;
  firstRepliedAt: string;
  updatedAt: string;
  email: string;
  firstName: string | null;
  company: string | null;
  niche: string | null;
};

type ReplyItem = {
  id: number;
  fromEmail: string;
  subject: string | null;
  snippet: string | null;
  classification: string;
  receivedAt: string;
};

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "contacted", label: "Contacted", color: "border-l-primary" },
  { key: "discussed", label: "Discussed", color: "border-l-warning" },
  { key: "done", label: "Done", color: "border-l-success" },
  { key: "wasted", label: "Wasted", color: "border-l-destructive" },
];

function isOverdue(followUpAt: string | null, stage: Stage): boolean {
  if (!followUpAt || stage === "done" || stage === "wasted") return false;
  return new Date(followUpAt).getTime() < Date.now();
}

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export function CrmView({
  initialEntries,
  plan,
}: {
  initialEntries: Entry[];
  plan: PlanLimits;
}) {
  const [entries, setEntries] = React.useState<Entry[]>(initialEntries);
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"kanban" | "list">("kanban");
  const [updating, setUpdating] = React.useState<number | null>(null);
  const [nicheFilter, setNicheFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState<"all" | Priority>("all");
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [drawerId, setDrawerId] = React.useState<number | null>(null);
  const [banner, setBanner] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const advanced = plan.advancedCrm;

  const niches = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.niche?.trim()) set.add(e.niche.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (q) {
        const hay = `${e.email} ${e.firstName || ""} ${e.company || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (advanced) {
        if (nicheFilter !== "all" && (e.niche || "") !== nicheFilter) return false;
        if (priorityFilter !== "all" && e.priority !== priorityFilter) return false;
        if (overdueOnly && !isOverdue(e.followUpAt, e.stage)) return false;
      }
      return true;
    });
  }, [entries, query, advanced, nicheFilter, priorityFilter, overdueOnly]);

  const insights = React.useMemo(() => {
    const total = entries.length;
    const won = entries.filter((e) => e.stage === "done").length;
    const lost = entries.filter((e) => e.stage === "wasted").length;
    const open = entries.filter((e) => e.stage === "contacted" || e.stage === "discussed");
    const overdue = open.filter((e) => isOverdue(e.followUpAt, e.stage)).length;
    const pipelineValue = open.reduce((sum, e) => sum + (e.dealValue || 0), 0);
    const closed = won + lost;
    const winRate = closed > 0 ? Math.round((won / closed) * 100) : 0;
    const wonEntries = entries.filter((e) => e.stage === "done");
    const avgCloseDays =
      wonEntries.length > 0
        ? Math.round(
            wonEntries.reduce((sum, e) => sum + daysBetween(e.firstRepliedAt, e.updatedAt), 0) /
              wonEntries.length
          )
        : 0;
    return { total, won, overdue, pipelineValue, winRate, avgCloseDays, open: open.length };
  }, [entries]);

  async function patchEntry(id: number, body: Record<string, unknown>) {
    const res = await fetch("/api/crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBanner({ ok: false, msg: data.error || "Update failed." });
      return false;
    }
    return true;
  }

  async function moveStage(id: number, stage: Stage) {
    setUpdating(id);
    const prev = entries.find((e) => e.id === id);
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, stage, updatedAt: new Date().toISOString() } : e)));
    const ok = await patchEntry(id, { stage });
    if (!ok && prev) {
      setEntries((list) => list.map((e) => (e.id === id ? { ...e, stage: prev.stage } : e)));
    }
    setUpdating(null);
  }

  async function saveNotes(id: number, notes: string) {
    const ok = await patchEntry(id, { notes });
    if (ok) setEntries((list) => list.map((e) => (e.id === id ? { ...e, notes } : e)));
    return ok;
  }

  async function saveAdvanced(
    id: number,
    patch: Partial<Pick<Entry, "priority" | "dealValue" | "followUpAt" | "notes">>
  ) {
    if (!advanced) {
      setBanner({ ok: false, msg: "Upgrade to Premium to use advanced CRM fields." });
      return false;
    }
    const ok = await patchEntry(id, patch);
    if (ok) {
      setEntries((list) =>
        list.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e))
      );
    }
    return ok;
  }

  async function bulkMove(stage: Stage) {
    if (!advanced) return;
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBanner(null);
    const res = await fetch("/api/crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, bulkStage: stage }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBanner({ ok: false, msg: data.error || "Bulk update failed." });
      return;
    }
    setEntries((list) =>
      list.map((e) => (selected.has(e.id) ? { ...e, stage, updatedAt: new Date().toISOString() } : e))
    );
    setSelected(new Set());
    setBanner({ ok: true, msg: `Moved ${ids.length} opportunit${ids.length === 1 ? "y" : "ies"} to ${stage}.` });
  }

  function exportCsv() {
    if (!advanced) return;
    const rows = [
      ["Name", "Email", "Company", "Niche", "Stage", "Priority", "Deal value", "Follow-up", "Replied", "Notes"],
      ...filtered.map((e) => [
        e.firstName || "",
        e.email,
        e.company || "",
        e.niche || "",
        e.stage,
        e.priority,
        e.dealValue == null ? "" : String(e.dealValue),
        e.followUpAt ? e.followUpAt.slice(0, 10) : "",
        e.firstRepliedAt,
        (e.notes || "").replace(/\s+/g, " ").trim(),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No conversations yet"
        description="Qualified leads will appear here automatically when they reply to your campaigns."
      />
    );
  }

  const drawerEntry = drawerId != null ? entries.find((e) => e.id === drawerId) ?? null : null;

  return (
    <div className="space-y-4">
      {banner && <Alert variant={banner.ok ? "success" : "error"}>{banner.msg}</Alert>}

      {/* Premium insights */}
      {advanced ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InsightChip label="Win rate" value={`${insights.winRate}%`} detail={`${insights.won} closed won`} />
          <InsightChip label="Open pipeline" value={formatMoney(insights.pipelineValue)} detail={`${insights.open} active`} />
          <InsightChip
            label="Follow-ups due"
            value={String(insights.overdue)}
            detail={insights.overdue ? "Needs attention" : "All clear"}
            warn={insights.overdue > 0}
          />
          <InsightChip label="Avg. days to close" value={String(insights.avgCloseDays)} detail="Won deals" />
        </div>
      ) : (
        <PremiumGate
          compact
          title="Pipeline intelligence"
          description="Unlock win-rate analytics, deal value tracking, follow-up reminders, reply timelines, bulk actions, and CSV export."
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card/80 p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads…"
              aria-label="Search CRM leads"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border bg-muted/30 p-1">
              <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} onClick={() => setView("kanban")} aria-pressed={view === "kanban"}>
                Kanban
              </Button>
              <Button size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")} aria-pressed={view === "list"}>
                List
              </Button>
            </div>
            {advanced ? (
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            ) : (
              <a
                href={UPGRADE_WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-800 dark:text-amber-300"
              >
                <Lock className="h-3.5 w-3.5" /> Export · Premium
              </a>
            )}
          </div>
        </div>

        {advanced ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filters
            </span>
            <Select
              aria-label="Filter by niche"
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="h-8 w-40 text-xs"
            >
              <option value="all">All niches</option>
              {niches.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as "all" | Priority)}
              className="h-8 w-36 text-xs"
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </Select>
            <Button
              size="sm"
              variant={overdueOnly ? "default" : "outline"}
              className="h-8"
              onClick={() => setOverdueOnly((v) => !v)}
              aria-pressed={overdueOnly}
            >
              <CalendarClock className="h-3.5 w-3.5" /> Overdue only
            </Button>
            {selected.size > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                <Select
                  aria-label="Bulk move stage"
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value as Stage;
                    if (v) bulkMove(v);
                    e.target.value = "";
                  }}
                  className="h-8 w-40 text-xs"
                >
                  <option value="" disabled>
                    Bulk move to…
                  </option>
                  <option value="contacted">Contacted</option>
                  <option value="discussed">Discussed</option>
                  <option value="done">Done</option>
                  <option value="wasted">Wasted</option>
                </Select>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <PremiumChip label="Advanced filters" />
            <PremiumChip label="Follow-ups" />
            <PremiumChip label="Deal value" />
            <PremiumChip label="Reply timeline" />
          </div>
        )}
      </div>

      {view === "kanban" ? (
        <div className="flex snap-x gap-4 overflow-x-auto pb-3 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
          {STAGES.map((col) => {
            const colEntries = filtered.filter((e) => e.stage === col.key);
            return (
              <div key={col.key} className="w-[82vw] max-w-sm shrink-0 snap-start space-y-2 sm:w-80 lg:w-auto lg:max-w-none">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary">{colEntries.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colEntries.map((entry) => (
                    <KanbanCard
                      key={entry.id}
                      entry={entry}
                      color={col.color}
                      advanced={advanced}
                      selected={selected.has(entry.id)}
                      onToggleSelect={() => toggleSelected(entry.id)}
                      onOpen={() => setDrawerId(entry.id)}
                      onMove={moveStage}
                      onSaveNotes={saveNotes}
                      updating={updating === entry.id}
                    />
                  ))}
                  {colEntries.length === 0 && <EmptyState icon={MessageSquare} title="No leads" compact />}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ListView
          entries={filtered}
          advanced={advanced}
          selected={selected}
          onToggleSelect={toggleSelected}
          onOpen={(id) => setDrawerId(id)}
          onMove={moveStage}
          updating={updating}
        />
      )}

      {drawerEntry && (
        <OpportunityDrawer
          entry={drawerEntry}
          advanced={advanced}
          onClose={() => setDrawerId(null)}
          onMove={moveStage}
          onSaveNotes={saveNotes}
          onSaveAdvanced={saveAdvanced}
        />
      )}
    </div>
  );
}

function InsightChip({
  label,
  value,
  detail,
  warn = false,
}: {
  label: string;
  value: string;
  detail: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br from-card to-primary/[0.03] p-4 shadow-sm",
        warn && "border-amber-500/30 from-amber-500/[0.06]"
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function KanbanCard({
  entry,
  color,
  advanced,
  selected,
  onToggleSelect,
  onOpen,
  onMove,
  onSaveNotes,
  updating,
}: {
  entry: Entry;
  color: string;
  advanced: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onMove: (id: number, stage: Stage) => void;
  onSaveNotes: (id: number, notes: string) => Promise<boolean>;
  updating: boolean;
}) {
  const [editingNotes, setEditingNotes] = React.useState(false);
  const [notes, setNotes] = React.useState(entry.notes || "");
  const overdue = isOverdue(entry.followUpAt, entry.stage);

  return (
    <div
      className={cn(
        "rounded-xl border border-l-[3px] bg-card p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        color,
        overdue && "ring-1 ring-amber-500/40",
        selected && "border-primary/40 bg-primary/[0.03]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {advanced && (
              <button
                type="button"
                onClick={onToggleSelect}
                className="text-muted-foreground hover:text-foreground"
                aria-label={selected ? "Deselect" : "Select"}
              >
                {selected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
              </button>
            )}
            <button type="button" onClick={onOpen} className="truncate text-left text-sm font-medium hover:text-primary">
              {entry.firstName || entry.email}
            </button>
            {advanced && entry.priority === "high" && (
              <Badge variant="warning" className="h-5 gap-0.5 px-1.5 text-[10px]">
                <Flag className="h-2.5 w-2.5" /> High
              </Badge>
            )}
            {overdue && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                Overdue
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{entry.email}</p>
          {entry.company && <p className="truncate text-xs text-muted-foreground">{entry.company}</p>}
        </div>
        {updating && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {advanced && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {entry.dealValue != null && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5">
              <IndianRupee className="h-3 w-3" /> {formatMoney(entry.dealValue)}
            </span>
          )}
          {entry.followUpAt && (
            <span className={cn("inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5", overdue && "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>
              <CalendarClock className="h-3 w-3" /> {entry.followUpAt.slice(0, 10)}
            </span>
          )}
          {entry.niche && <Badge variant="secondary" className="h-5 text-[10px]">{entry.niche}</Badge>}
        </div>
      )}

      {editingNotes ? (
        <div className="mt-2 space-y-1">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-20 text-xs"
            rows={2}
            placeholder="Add a note…"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={async () => {
                const ok = await onSaveNotes(entry.id, notes);
                if (ok) setEditingNotes(false);
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingNotes(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          className="mt-1 line-clamp-2 w-full text-left text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setEditingNotes(true)}
        >
          {entry.notes || "+ add note"}
        </button>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={onOpen}>
          Open
        </Button>
        {entry.stage !== "done" && entry.stage !== "wasted" && (
          <>
            {entry.stage === "contacted" && (
              <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => onMove(entry.id, "discussed")}>
                → Discussed
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs text-success" onClick={() => onMove(entry.id, "done")}>
              ✓ Done
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs text-destructive" onClick={() => onMove(entry.id, "wasted")}>
              ✗ Wasted
            </Button>
          </>
        )}
        {(entry.stage === "done" || entry.stage === "wasted") && (
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onMove(entry.id, "contacted")}>
            ↩ Reopen
          </Button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Replied {timeAgo(entry.firstRepliedAt)}</p>
    </div>
  );
}

function ListView({
  entries,
  advanced,
  selected,
  onToggleSelect,
  onOpen,
  onMove,
  updating,
}: {
  entries: Entry[];
  advanced: boolean;
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpen: (id: number) => void;
  onMove: (id: number, stage: Stage) => void;
  updating: number | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card/90 shadow-sm">
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {advanced && <th className="w-10 p-3" />}
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Lead</th>
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Company</th>
              {advanced && (
                <>
                  <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Priority</th>
                  <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Deal</th>
                  <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Follow-up</th>
                </>
              )}
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Replied</th>
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Stage</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const overdue = isOverdue(entry.followUpAt, entry.stage);
              return (
                <tr key={entry.id} className={cn("border-b last:border-0", overdue && "bg-amber-500/[0.04]")}>
                  {advanced && (
                    <td className="p-3">
                      <button type="button" onClick={() => onToggleSelect(entry.id)} aria-label="Select row">
                        {selected.has(entry.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="p-3">
                    <button type="button" onClick={() => onOpen(entry.id)} className="text-left hover:text-primary">
                      <p className="font-medium">{entry.firstName || entry.email}</p>
                      <p className="text-xs text-muted-foreground">{entry.email}</p>
                    </button>
                  </td>
                  <td className="p-3 text-muted-foreground">{entry.company || "—"}</td>
                  {advanced && (
                    <>
                      <td className="p-3 capitalize text-muted-foreground">{entry.priority}</td>
                      <td className="p-3 tabular-nums text-muted-foreground">{formatMoney(entry.dealValue)}</td>
                      <td className={cn("p-3 text-xs", overdue ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                        {entry.followUpAt ? entry.followUpAt.slice(0, 10) : "—"}
                      </td>
                    </>
                  )}
                  <td className="p-3 text-xs text-muted-foreground">{timeAgo(entry.firstRepliedAt)}</td>
                  <td className="p-3">
                    <StageBadge stage={entry.stage} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {updating === entry.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      <Select
                        value={entry.stage}
                        onChange={(e) => onMove(entry.id, e.target.value as Stage)}
                        className="h-8 w-32 text-xs"
                      >
                        <option value="contacted">Contacted</option>
                        <option value="discussed">Discussed</option>
                        <option value="done">Done</option>
                        <option value="wasted">Wasted</option>
                      </Select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border/60 md:hidden">
        {entries.map((entry) => (
          <button key={entry.id} type="button" onClick={() => onOpen(entry.id)} className="block w-full p-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{entry.firstName || entry.email}</p>
                <p className="truncate text-xs text-muted-foreground">{entry.email}</p>
              </div>
              <StageBadge stage={entry.stage} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Replied {timeAgo(entry.firstRepliedAt)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function OpportunityDrawer({
  entry,
  advanced,
  onClose,
  onMove,
  onSaveNotes,
  onSaveAdvanced,
}: {
  entry: Entry;
  advanced: boolean;
  onClose: () => void;
  onMove: (id: number, stage: Stage) => void;
  onSaveNotes: (id: number, notes: string) => Promise<boolean>;
  onSaveAdvanced: (
    id: number,
    patch: Partial<Pick<Entry, "priority" | "dealValue" | "followUpAt" | "notes">>
  ) => Promise<boolean>;
}) {
  const [notes, setNotes] = React.useState(entry.notes || "");
  const [priority, setPriority] = React.useState<Priority>(entry.priority);
  const [dealValue, setDealValue] = React.useState(entry.dealValue == null ? "" : String(entry.dealValue));
  const [followUpAt, setFollowUpAt] = React.useState(entry.followUpAt ? entry.followUpAt.slice(0, 10) : "");
  const [saving, setSaving] = React.useState(false);
  const [replies, setReplies] = React.useState<ReplyItem[] | null>(null);
  const [loadingReplies, setLoadingReplies] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNotes(entry.notes || "");
    setPriority(entry.priority);
    setDealValue(entry.dealValue == null ? "" : String(entry.dealValue));
    setFollowUpAt(entry.followUpAt ? entry.followUpAt.slice(0, 10) : "");
  }, [entry]);

  React.useEffect(() => {
    if (!advanced) return;
    let active = true;
    setLoadingReplies(true);
    setReplyError(null);
    fetch(`/api/crm/${entry.id}/activity`)
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setReplyError(data.error || "Could not load timeline.");
          setReplies([]);
          return;
        }
        setReplies(data.replies || []);
      })
      .catch(() => {
        if (active) {
          setReplyError("Could not load timeline.");
          setReplies([]);
        }
      })
      .finally(() => {
        if (active) setLoadingReplies(false);
      });
    return () => {
      active = false;
    };
  }, [advanced, entry.id]);

  async function saveAll() {
    setSaving(true);
    await onSaveNotes(entry.id, notes);
    if (advanced) {
      await onSaveAdvanced(entry.id, {
        priority,
        dealValue: dealValue === "" ? null : Number(dealValue),
        followUpAt: followUpAt ? new Date(`${followUpAt}T12:00:00`).toISOString() : null,
      });
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Opportunity details"
        className="flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight">{entry.firstName || entry.email}</p>
            <p className="truncate text-sm text-muted-foreground">{entry.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StageBadge stage={entry.stage} />
              {entry.company && (
                <Badge variant="secondary" className="gap-1">
                  <Building2 className="h-3 w-3" /> {entry.company}
                </Badge>
              )}
            </div>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`mailto:${entry.email}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs font-medium hover:bg-muted/50"
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </a>
            <Select
              aria-label="Change stage"
              value={entry.stage}
              onChange={(e) => onMove(entry.id, e.target.value as Stage)}
              className="h-9 text-xs"
            >
              <option value="contacted">Contacted</option>
              <option value="discussed">Discussed</option>
              <option value="done">Done</option>
              <option value="wasted">Wasted</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Context, next steps, objections…" />
          </div>

          {advanced ? (
            <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.03] p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Premium fields
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="crm-priority" className="text-xs">Priority</Label>
                  <Select id="crm-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="crm-deal" className="text-xs">Deal value (₹)</Label>
                  <Input
                    id="crm-deal"
                    type="number"
                    min={0}
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="e.g. 50000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crm-followup" className="text-xs">Follow-up date</Label>
                <Input
                  id="crm-followup"
                  type="date"
                  value={followUpAt}
                  onChange={(e) => setFollowUpAt(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <PremiumGate
              compact
              title="Opportunity controls"
              description="Set priority, deal value, and follow-up reminders so nothing slips through."
            />
          )}

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="h-4 w-4 text-muted-foreground" /> Reply timeline
            </div>
            {!advanced ? (
              <PremiumGate
                compact
                title="Conversation history"
                description="See every matched reply and classification in one timeline."
              />
            ) : loadingReplies ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading replies…
              </div>
            ) : replyError ? (
              <Alert variant="error">{replyError}</Alert>
            ) : !replies || replies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reply history stored for this lead yet.</p>
            ) : (
              <ol className="space-y-3">
                {replies.map((r) => (
                  <li key={r.id} className="rounded-xl border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="capitalize">{r.classification}</Badge>
                      <span className="text-[11px] text-muted-foreground">{timeAgo(r.receivedAt)}</span>
                    </div>
                    {r.subject && <p className="mt-1 text-sm font-medium">{r.subject}</p>}
                    {r.snippet && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{r.snippet}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="border-t p-4">
          <Button className="w-full" onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </aside>
    </div>
  );
}

function StageBadge({ stage }: { stage: Stage }) {
  const map: Record<Stage, { variant: "default" | "secondary" | "success" | "destructive"; label: string }> = {
    contacted: { variant: "default", label: "Contacted" },
    discussed: { variant: "secondary", label: "Discussed" },
    done: { variant: "success", label: "Done" },
    wasted: { variant: "destructive", label: "Wasted" },
  };
  const cfg = map[stage];
  return (
    <Badge variant={cfg.variant} className="capitalize">
      {cfg.label}
    </Badge>
  );
}
