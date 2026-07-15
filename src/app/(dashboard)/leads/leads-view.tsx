// src/app/(dashboard)/leads/leads-view.tsx
"use client";
import * as React from "react";
import {
  Search,
  Upload,
  Trash2,
  Loader2,
  Inbox,
  FileSpreadsheet,
  Mail,
  MapPin,
  Building2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { PremiumGate } from "@/components/premium-gate";
import type { PlanLimits } from "@/lib/plan-constants";

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

type ImportSummary = {
  report: ImportReport;
  fileName: string;
  mapping: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    niche: string | null;
  };
  sample: { email: string; firstName?: string | null; company?: string | null }[];
  parsedRows: number;
  format: string;
};

type DiscoveredBusiness = {
  id: string;
  name: string;
  category: string;
  address: string;
  distanceKm: number;
  website: string | null;
  phone: string | null;
  emails: string[];
  relevanceReason?: string;
};

export function LeadsView({
  initialLeads,
  plan,
}: {
  initialLeads: Lead[];
  plan: PlanLimits;
}) {
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [importNiche, setImportNiche] = React.useState("");
  const [importSummary, setImportSummary] = React.useState<ImportSummary | null>(null);
  const searchController = React.useRef<AbortController | null>(null);
  const [location, setLocation] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [radiusKm, setRadiusKm] = React.useState("10");
  const [discovering, setDiscovering] = React.useState(false);
  const [discovered, setDiscovered] = React.useState<DiscoveredBusiness[]>([]);
  const [resolvedLocation, setResolvedLocation] = React.useState("");
  const [aiUsed, setAiUsed] = React.useState(false);

  async function discover() {
    if (!location.trim() || !category.trim()) return;
    setDiscovering(true);
    setResult(null);
    setDiscovered([]);
    try {
      const response = await fetch("/api/leads/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          category,
          radiusKm: Number(radiusKm),
          maxBusinesses: 20,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lead discovery failed.");
      const report = data.report as ImportReport;
      setDiscovered(data.discovery.businesses || []);
      setResolvedLocation(data.discovery.location?.label || location);
      setAiUsed(Boolean(data.discovery.aiUsed));
      setResult({
        ok: true,
        msg: `Scanned ${data.discovery.businessesScanned} businesses and ${data.discovery.websitesScanned} websites. Found ${data.emailsFound} emails and added ${report.added} new leads.${data.discovery.warning ? ` ${data.discovery.warning}` : ""}`,
      });
      await refresh();
    } catch (error) {
      setResult({
        ok: false,
        msg: error instanceof Error ? error.message : "Lead discovery failed.",
      });
    } finally {
      setDiscovering(false);
    }
  }

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
    setImportSummary(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("niche", importNiche);
      const res = await fetch("/api/leads/import", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        const r = data.report as ImportReport;
        setImportSummary({
          report: r,
          fileName: data.fileName || file.name,
          mapping: data.mapping || { email: null, firstName: null, lastName: null, company: null, niche: null },
          sample: data.sample || [],
          parsedRows: data.parsedRows ?? r.total,
          format: data.format || "file",
        });
        setResult({
          ok: true,
          msg: `Imported ${r.added} new lead${r.added === 1 ? "" : "s"} from ${file.name}.`,
        });
        await refresh();
      } else {
        setResult({ ok: false, msg: data.error || "Import failed." });
      }
    } catch (err: unknown) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : "Import failed." });
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
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card/95 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
        <div className="relative overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/[0.12] via-primary/[0.05] to-transparent p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="flex items-start gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(226_72%_38%)] text-primary-foreground shadow-lg shadow-primary/20">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Smart lead importer</h2>
                <Badge variant="outline" className="bg-card/60">CSV · Excel · TXT</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Auto-detects email, name, and company columns — even messy headers — then de-duplicates before adding.
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
                Used when the file has no niche/category column. Recognizes Email, Name, Company, and many aliases.
              </p>
            </div>
            <input
              id="lead-file-import"
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              onChange={doImport}
              className="hidden"
              aria-label="Import lead file"
            />
            <Button
              size="lg"
              className="w-full min-h-11 lg:w-auto"
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

      {result && <Alert variant={result.ok ? "success" : "error"}>{result.msg}</Alert>}

      {importSummary && (
        <div className="space-y-3 rounded-2xl border bg-card/95 p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Import results · {importSummary.fileName}</h3>
              <p className="text-xs text-muted-foreground">
                Parsed {importSummary.parsedRows} row{importSummary.parsedRows === 1 ? "" : "s"} as {importSummary.format.toUpperCase()}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setImportSummary(null)}>
              Dismiss
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <ImportStat label="Added" value={importSummary.report.added} tone="success" />
            <ImportStat label="Already leads" value={importSummary.report.alreadyLeads} />
            <ImportStat label="Already sent" value={importSummary.report.alreadySent} />
            <ImportStat label="Dupes in file" value={importSummary.report.duplicatesInFile} />
            <ImportStat label="Invalid" value={importSummary.report.invalid} tone="danger" />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <MappingChip label="Email" value={importSummary.mapping.email} />
            <MappingChip label="Name" value={importSummary.mapping.firstName} />
            <MappingChip label="Company" value={importSummary.mapping.company} />
            {importSummary.mapping.niche && <MappingChip label="Niche" value={importSummary.mapping.niche} />}
          </div>

          {importSummary.sample.length > 0 && (
            <div className="overflow-hidden rounded-xl border">
              <div className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sample of cleaned rows
              </div>
              <div className="divide-y">
                {importSummary.sample.map((row) => (
                  <div key={row.email} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[1.2fr_1fr_1fr]">
                    <span className="truncate font-medium">{row.email}</span>
                    <span className="truncate text-muted-foreground">{row.firstName || "—"}</span>
                    <span className="truncate text-muted-foreground">{row.company || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Discover businesses — free: upgrade gate · premium: live discovery */}
      {!plan.leadIntelligence ? (
        <PremiumGate
          title="Discover businesses near you"
          description="Find verified local businesses by location and category, then auto-collect their public emails — no list needed."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card/95 shadow-sm">
            <div className="relative overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/[0.12] via-primary/[0.05] to-amber-500/[0.04] p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="flex items-start gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-lg shadow-primary/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Discover businesses near you</h2>
                    <Badge variant="warning" className="gap-1">
                      <Sparkles className="h-3 w-3" /> Premium
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Choose a location, business type, and radius. We find verified map listings, scan public websites, and add emails to your pool.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_150px_auto]">
                <div>
                  <Label htmlFor="discovery-location" className="mb-1.5 text-xs">City, locality, or PIN code</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="discovery-location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Indiranagar, Bengaluru"
                      className="pl-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") discover();
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="discovery-category" className="mb-1.5 text-xs">Business type</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="discovery-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. dental clinics"
                      className="pl-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") discover();
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="discovery-radius" className="mb-1.5 text-xs">Search radius</Label>
                  <select
                    id="discovery-radius"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {[2, 5, 10, 20, 30, 50].map((radius) => (
                      <option key={radius} value={radius}>
                        {radius} km
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full md:w-auto"
                    onClick={discover}
                    disabled={discovering || !location.trim() || !category.trim()}
                  >
                    {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {discovering ? "Finding leads…" : "Find leads"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {discovered.length > 0 && (
            <div className="overflow-hidden rounded-xl border bg-card/95 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold">Discovery results</h3>
                  <p className="max-w-2xl truncate text-xs text-muted-foreground">{resolvedLocation}</p>
                </div>
                {aiUsed && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" /> Ranked by DeepSeek
                  </Badge>
                )}
              </div>
              <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
                {discovered.map((business) => (
                  <div key={business.id} className="min-w-0 bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{business.name}</p>
                        <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                          {business.category} · {business.distanceKm} km
                        </p>
                      </div>
                      {business.website && (
                        <a
                          href={business.website}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${business.name} website`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    {business.address && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{business.address}</p>}
                    <div className="mt-3">
                      {business.emails.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {business.emails.slice(0, 3).map((email) => (
                            <Badge key={email} variant="success" className="max-w-full truncate font-normal">
                              {email}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No public email found</span>
                      )}
                    </div>
                    {business.relevanceReason && (
                      <p className="mt-2 text-xs text-primary">{business.relevanceReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

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

function ImportStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={
          tone === "success"
            ? "mt-1 text-lg font-semibold tabular-nums text-success"
            : tone === "danger"
              ? "mt-1 text-lg font-semibold tabular-nums text-destructive"
              : "mt-1 text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}

function MappingChip({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border bg-muted/30 px-2 py-1">
      <span className="font-semibold text-muted-foreground">{label}:</span>
      <span className="font-medium">{value || "auto-detected / scanned"}</span>
    </span>
  );
}
