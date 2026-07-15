// src/app/(dashboard)/leads/leads-view.tsx
"use client";
import * as React from "react";
import {
  Search,
  Globe,
  Upload,
  Trash2,
  Loader2,
  Inbox,
  MapPin,
  Sparkles,
  Building2,
  ExternalLink,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
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

export function LeadsView({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [scrapeUrl, setScrapeUrl] = React.useState("");
  const [scrapeNiche, setScrapeNiche] = React.useState("");
  const [scraping, setScraping] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [location, setLocation] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [radiusKm, setRadiusKm] = React.useState("10");
  const [discovering, setDiscovering] = React.useState(false);
  const [discovered, setDiscovered] = React.useState<DiscoveredBusiness[]>([]);
  const [resolvedLocation, setResolvedLocation] = React.useState("");
  const [aiUsed, setAiUsed] = React.useState(false);
  const searchController = React.useRef<AbortController | null>(null);

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

  async function doScrape() {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setResult(null);
    try {
      const res = await fetch("/api/leads/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl, niche: scrapeNiche || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        const r = data.report as ImportReport;
        setResult({
          ok: true,
          msg: `Found ${data.found} emails. Added ${r.added} new leads · ${r.alreadySent} already sent · ${r.alreadyLeads} duplicates · ${r.invalid} invalid.`,
        });
        refresh();
      } else {
        setResult({ ok: false, msg: data.error || "Scrape failed." });
      }
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Scrape failed." });
    }
    setScraping(false);
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("niche", scrapeNiche);
      const res = await fetch("/api/leads/import", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        const r = data.report as ImportReport;
        setResult({
          ok: true,
          msg: `Imported ${r.added} new leads from ${file.name}. · ${r.alreadySent} already sent · ${r.alreadyLeads} duplicates · ${r.invalid} invalid.`,
        });
        refresh();
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
      {/* Guided location discovery */}
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card/95 shadow-[0_16px_50px_rgba(79,70,229,0.08)]">
        <div className="relative overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/[0.12] via-primary/[0.05] to-violet-500/[0.04] p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="flex items-start gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Discover businesses near you</h2>
                <Badge variant="outline" className="bg-card/60">India · Live search</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                No website link needed. Choose a location, business type, and radius. We find verified map listings,
                scan their public websites, and add discovered emails to your lead pool.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_150px_auto]">
            <div>
              <label htmlFor="discovery-location" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                City, locality, or PIN code
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="discovery-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="e.g. Indiranagar, Bengaluru"
                  className="pl-9"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") discover();
                  }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="discovery-category" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Business type
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="discovery-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="e.g. dental clinics"
                  className="pl-9"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") discover();
                  }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="discovery-radius" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Search radius
              </label>
              <Select
                id="discovery-radius"
                value={radiusKm}
                onChange={(event) => setRadiusKm(event.target.value)}
              >
                {[2, 5, 10, 20, 30, 50].map((radius) => (
                  <option key={radius} value={radius}>
                    {radius} km
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full px-5 lg:w-auto"
                onClick={discover}
                disabled={discovering || !location.trim() || !category.trim()}
              >
                {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {discovering ? "Finding leads…" : "Find leads"}
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              © OpenStreetMap contributors
            </a>
            <span>Website and contact-page scanning</span>
            <span>Optional DeepSeek relevance ranking</span>
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
          <div className="grid gap-px bg-border/70 sm:grid-cols-2 xl:grid-cols-3">
            {discovered.map((business) => (
              <div key={business.id} className="group min-w-0 bg-card p-4 transition-colors hover:bg-muted/25">
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
                  <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">{business.relevanceReason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acquisition tools */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scrape */}
        <div className="rounded-xl border bg-card/90 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Scan a known website</h3>
              <p className="text-xs text-muted-foreground">Extract public contacts from a specific page.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scrape-url" className="text-xs">Website URL</Label>
            <Input
              id="scrape-url"
              placeholder="https://example.com/contact"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                aria-label="Lead niche"
                placeholder="Niche (optional)"
                value={scrapeNiche}
                onChange={(e) => setScrapeNiche(e.target.value)}
                className="flex-1"
              />
              <Button onClick={doScrape} disabled={scraping || !scrapeUrl.trim()}>
                {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                Scrape
              </Button>
            </div>
          </div>
        </div>

        {/* Import */}
        <div className="rounded-xl border bg-card/90 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Upload className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Import your own list</h3>
              <p className="text-xs text-muted-foreground">Bring contacts from CSV, XLSX, or TXT.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-niche" className="text-xs">Default niche</Label>
            <Input
              id="import-niche"
              placeholder="Niche (optional, applies to scrape + import)"
              value={scrapeNiche}
              onChange={(e) => setScrapeNiche(e.target.value)}
            />
            <input id="lead-file-import" ref={fileRef} type="file" accept=".csv,.xlsx,.txt" onChange={doImport} className="hidden" aria-label="Import lead file" />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              aria-controls="lead-file-import"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Choose CSV / Excel / TXT
            </Button>
            <p className="text-xs text-muted-foreground">
              CSV/Excel: detected columns are email, first_name, company. TXT: extracts all emails.
            </p>
          </div>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <Alert variant={result.ok ? "success" : "error"}>{result.msg}</Alert>
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
            title={loading ? "Searching your leads…" : "No leads in your directory"}
            description={loading ? "This will only take a moment." : "Discover nearby businesses or import a contact list to begin."}
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
