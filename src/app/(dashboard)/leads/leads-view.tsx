// src/app/(dashboard)/leads/leads-view.tsx
"use client";
import * as React from "react";
import {
  Search,
  Globe,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Inbox,
  MapPin,
  Sparkles,
  Building2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo } from "@/lib/utils";

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
    const res = await fetch(`/api/leads?q=${encodeURIComponent(q)}&limit=100`);
    const data = await res.json();
    setLeads(data.leads || []);
    setLoading(false);
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
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Discover businesses near you</h2>
                <Badge variant="secondary">India</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                No website link needed. Choose a location, business type, and radius. We find verified map listings,
                scan their public websites, and add discovered emails to your lead pool.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_150px_auto]">
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
              <select
                id="discovery-radius"
                value={radiusKm}
                onChange={(event) => setRadiusKm(event.target.value)}
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
        <div className="rounded-xl border bg-card">
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
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Already have a website?</h3>
          </div>
          <div className="space-y-2">
            <Input
              placeholder="https://example.com/contact"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
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
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Import from file</h3>
          </div>
          <div className="space-y-2">
            <Input
              placeholder="Niche (optional, applies to scrape + import)"
              value={scrapeNiche}
              onChange={(e) => setScrapeNiche(e.target.value)}
            />
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.txt" onChange={doImport} className="hidden" />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
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
        <div
          className={`flex items-start gap-2 rounded-md p-3 text-sm ${
            result.ok
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{result.msg}</span>
        </div>
      )}

      {/* Search + table */}
      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search email, name, company…"
              value={query}
              onChange={(e) => search(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p className="text-sm">{loading ? "Loading…" : "No leads yet. Discover nearby businesses or import a file above."}</p>
          </div>
        ) : (
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
                  <TableCell className="font-medium">{lead.email}</TableCell>
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
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
