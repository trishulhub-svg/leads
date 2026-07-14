// src/app/(dashboard)/leads/leads-view.tsx
"use client";
import * as React from "react";
import { Search, Globe, Upload, Trash2, Loader2, CheckCircle2, AlertCircle, Inbox } from "lucide-react";
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
      {/* Acquisition tools */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scrape */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Scrape emails from a URL</h3>
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
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" onChange={doImport} className="hidden" />
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
            <p className="text-sm">{loading ? "Loading…" : "No leads yet. Scrape a URL or import a file above."}</p>
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
