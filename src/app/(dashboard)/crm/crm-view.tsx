// src/app/(dashboard)/crm/crm-view.tsx
"use client";
import * as React from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";

type Stage = "contacted" | "discussed" | "done" | "wasted";

type Entry = {
  id: number;
  leadId: number;
  stage: Stage;
  notes: string | null;
  firstRepliedAt: string;
  updatedAt: string;
  email: string;
  firstName: string | null;
  company: string | null;
  niche: string | null;
};

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "contacted", label: "Contacted", color: "border-l-blue-500" },
  { key: "discussed", label: "Discussed", color: "border-l-amber-500" },
  { key: "done", label: "Done", color: "border-l-emerald-500" },
  { key: "wasted", label: "Wasted", color: "border-l-rose-500" },
];

export function CrmView({ initialEntries }: { initialEntries: Entry[] }) {
  const [entries, setEntries] = React.useState<Entry[]>(initialEntries);
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"kanban" | "list">("kanban");
  const [updating, setUpdating] = React.useState<number | null>(null);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(
      (e) =>
        e.email.toLowerCase().includes(q) ||
        (e.firstName?.toLowerCase().includes(q)) ||
        (e.company?.toLowerCase().includes(q))
    );
  }, [entries, query]);

  async function moveStage(id: number, stage: Stage) {
    setUpdating(id);
    const prevStage = entries.find((e) => e.id === id)?.stage;
    // Optimistic update.
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, stage } : e)));
    try {
      const res = await fetch("/api/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch {
      // Roll back on failure.
      setEntries((prev) => prev.map((e) => (e.id === id && prevStage ? { ...e, stage: prevStage } : e)));
    }
    setUpdating(null);
  }

  async function saveNotes(id: number, notes: string) {
    try {
      const res = await fetch("/api/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-20 text-center text-muted-foreground">
        <p className="text-sm">
          No leads in the CRM yet. Leads appear here automatically when they reply to your campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-md border p-0.5">
          <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} onClick={() => setView("kanban")}>
            Kanban
          </Button>
          <Button size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")}>
            List
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {STAGES.map((col) => {
            const colEntries = filtered.filter((e) => e.stage === col.key);
            return (
              <div key={col.key} className="space-y-2">
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
                      onMove={moveStage}
                      onSaveNotes={saveNotes}
                      updating={updating === entry.id}
                    />
                  ))}
                  {colEntries.length === 0 && (
                    <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ListView entries={filtered} onMove={moveStage} updating={updating} />
      )}
    </div>
  );
}

function KanbanCard({
  entry,
  color,
  onMove,
  onSaveNotes,
  updating,
}: {
  entry: Entry;
  color: string;
  onMove: (id: number, stage: Stage) => void;
  onSaveNotes: (id: number, notes: string) => Promise<boolean>;
  updating: boolean;
}) {
  const [editingNotes, setEditingNotes] = React.useState(false);
  const [notes, setNotes] = React.useState(entry.notes || "");

  return (
    <div className={cn("rounded-md border border-l-4 bg-card p-3 shadow-sm", color)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{entry.firstName || entry.email}</p>
          <p className="truncate text-xs text-muted-foreground">{entry.email}</p>
          {entry.company && <p className="truncate text-xs text-muted-foreground">{entry.company}</p>}
        </div>
        {updating && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {editingNotes ? (
        <div className="mt-2 space-y-1">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded border bg-background p-1.5 text-xs"
            rows={2}
            placeholder="Add a note…"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={async () => {
                const ok = await onSaveNotes(entry.id, notes);
                if (ok) setEditingNotes(false);
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingNotes(false)}>
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
        {entry.stage !== "done" && entry.stage !== "wasted" && (
          <>
            {entry.stage === "contacted" && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => onMove(entry.id, "discussed")}>
                → Discussed
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-emerald-600" onClick={() => onMove(entry.id, "done")}>
              ✓ Done
            </Button>
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-destructive" onClick={() => onMove(entry.id, "wasted")}>
              ✗ Wasted
            </Button>
          </>
        )}
        {(entry.stage === "done" || entry.stage === "wasted") && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onMove(entry.id, "contacted")}>
            ↩ Reopen
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">Replied {timeAgo(entry.firstRepliedAt)}</p>
    </div>
  );
}

function ListView({
  entries,
  onMove,
  updating,
}: {
  entries: Entry[];
  onMove: (id: number, stage: Stage) => void;
  updating: number | null;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Lead</th>
            <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Company</th>
            <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Replied</th>
            <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Stage</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b last:border-0">
              <td className="p-3">
                <p className="font-medium">{entry.firstName || entry.email}</p>
                <p className="text-xs text-muted-foreground">{entry.email}</p>
              </td>
              <td className="p-3 text-muted-foreground">{entry.company || "—"}</td>
              <td className="p-3 text-xs text-muted-foreground">{timeAgo(entry.firstRepliedAt)}</td>
              <td className="p-3">
                <StageBadge stage={entry.stage} />
              </td>
              <td className="p-3">
                <div className="flex items-center justify-end gap-1">
                  {updating === entry.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  <select
                    value={entry.stage}
                    onChange={(e) => onMove(entry.id, e.target.value as Stage)}
                    className="h-7 rounded border bg-background px-2 text-xs"
                  >
                    <option value="contacted">Contacted</option>
                    <option value="discussed">Discussed</option>
                    <option value="done">Done</option>
                    <option value="wasted">Wasted</option>
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
