// src/app/(dashboard)/leads/leads-view.tsx
"use client";
import * as React from "react";
import {
  Search,
  Upload,
  Trash2,
  Loader2,
  Inbox,
  MapPin,
  Sparkles,
  Lock,
  FileSpreadsheet,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

type Lead = {
  id: number;
  email: string;
  firstName: string | null;
  company: string | null;
  niche: string | null;
  source: string;
  status: string;
  createdAt: string;
};

type ImportReport = {
  added: number;
  duplicatesInFile: number;
  alreadyLeads: number;
  alreadySent: number;
  invalid: number;
  total: number;
};

const WHATSAPP_SUPPORT =
  "https://wa.me/919662106793?text=" + encodeURIComponent("Hi trishulhub team");

export function LeadsView({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [importNiche, setImportNiche] = React.useState("");
  const searchController = React.useRef<AbortController | null>(null);

  async function search(q: string) {
    setQuery(q);
    setLoading(true);
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    try {
      const res = await fetch(`/api/leads?q=${encodeURIComponent(q)}&limit=100`, { signal: controller.signal });
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setResult({ ok: false, msg: "Could not search leads. Please try again." });
      }
    } finally {
      if (searchController.current === controller) setLoading(false);
    }
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("niche", importNiche);
      const res = await fetch("/api/leads/import", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        const r = data.report as ImportReport;
        setResult({
          ok: true,
          msg: `Imported ${r.added} new lead${r.added === 1 ? "" : "s"} from ${file.name}. · ${r.alreadySent} already sent · ${r.alreadyLeads} duplicates · ${r.invalid} invalid.`,
        });
        await refresh();
      } else {
        setResult({ ok: false, msg: data.error || "Import failed." });
      }
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Import failed." });
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function refresh() {
    const res = await fetch(`/api/leads?q=${encodeURIComponent(query)}&limit=100`);
    const data = await res.json();
    setLeads(data.leads || []);
  }

  async function deleteLead(id: number) {
    if (!confirm("Delete this lead?")) return;
    await fetch("/api/leads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refresh();
  }

  return (
    <div className="space-y-4">
      {/* Import — primary acquisition method */}
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card/95 shadow-[0_16px_50px_rgba(79,70,229,0.08)]">
        <div className="relative overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/[0.12] via-primary/[0.05] to-violet-500/[0.04] p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="flex items-start gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-lg shadow-primary/20">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Import your leads</h2>
                <Badge variant="outline" className="bg-card/60">CSV · Excel · TXT</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Upload your contact list and we’ll clean, de-duplicate, and add every valid address to your outreach pool.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="import-niche" className="text-xs">Default niche (optional)</Label>
              <Input
                id="import-niche"
                placeholder="e.g. SaaS, Dental clinics, Agencies"
                value={importNiche}
                onChange={(e) => setImportNiche(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Applied to every lead in this import. Detected columns: email, first_name, company.
              </p>
            </div>
            <input
              id="lead-file-import"
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.txt"
              onChange={doImport}
              className="hidden"
              aria-label="Import lead file"
            />
            <Button
              size="lg"
              className="w-full lg:w-auto"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              aria-controls="lead-file-import"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {importing ? "Importing…" : "Choose file to import"}
            </Button>
          </div>
        </div>
      </div>

      {/* Result banner */}
      {result && <Alert variant={result.ok ? "success" : "error"}>{result.msg}</Alert>}

      {/* Discover businesses — premium locked */}
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-muted/20 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <MapPin className="h-5 w-5" />
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                <Lock className="h-3 w-3" />
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Discover businesses near you</h2>
                <Badge variant="warning" className="gap-1">
                  <Sparkles className="h-3 w-3" /> Premium
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Find verified local businesses by location and category, then auto-collect their public emails — no
                list needed. Available on the premium plan.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <Button disabled className="cursor-not-allowed opacity-90" aria-disabled="true">
              <Lock className="h-4 w-4" />
              Upgrade to unlock
            </Button>
            <a
              href={WHATSAPP_SUPPORT}
              target="_blank"
              rel="noreferrer"
              className="text-center text-xs font-medium text-primary underline-offset-2 hover:underline sm:text-right"
            >
              Contact the Trishulhub team for more →
            </a>
          </div>
        </div>
      </div>

      {/* Search + table */}
      <div className="overflow-hidden rounded-xl border bg-card/95 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Lead directory</h3>
            <p className="text-xs text-muted-foreground">Your latest 100 outreach-ready contacts</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search leads"
              placeholder="Search email, name, company…"
              value={query}
              onChange={(e) => search(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={loading ? "Searching your leads…" : query ? "No matching leads" : "No leads yet"}
            description={
              loading
                ? "This will only take a moment."
                : query
                  ? "Try a different search term."
                  : "Import a CSV, Excel, or TXT contact list above to get started."
            }
            className="m-4 border-0"
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Niche</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="max-w-[16rem] truncate font-medium" title={lead.email}>{lead.email}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.firstName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.company || "—"}</TableCell>
                      <TableCell>
                        {lead.niche && <Badge variant="secondary">{lead.niche}</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{lead.source}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(lead.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => deleteLead(lead.id)}
                          aria-label={`Delete ${lead.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="divide-y divide-border/60 md:hidden">
              {leads.map((lead) => (
                <div key={lead.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{lead.email}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[lead.firstName, lead.company].filter(Boolean).join(" · ") || "No additional details"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {lead.niche && <Badge variant="secondary">{lead.niche}</Badge>}
                        <Badge variant="outline" className="capitalize">{lead.source}</Badge>
                        <span className="text-[11px] text-muted-foreground">{timeAgo(lead.createdAt)}</span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteLead(lead.id)}
                      aria-label={`Delete ${lead.email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
