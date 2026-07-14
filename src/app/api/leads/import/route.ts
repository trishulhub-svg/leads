// src/app/api/leads/import/route.ts
// Import leads from an uploaded CSV, Excel (.xlsx), or TXT file.
// Parses the file server-side, extracts emails (+ optional name/company columns),
// and runs the dedup-aware bulk insert.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { importLeads, type ImportRow } from "@/lib/dedup";
import { extractEmails, isValidEmail } from "@/lib/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const niche = (formData.get("niche") as string) || undefined;
  if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let rows: ImportRow[] = [];
  try {
    if (name.endsWith(".csv")) {
      rows = await parseCsv(buf);
    } else if (name.endsWith(".xlsx")) {
      rows = await parseExcel(buf);
    } else if (name.endsWith(".txt")) {
      // Treat as text: extract every email-looking string.
      const text = buf.toString("utf-8");
      rows = extractEmails(text).map((email) => ({ email }));
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload CSV, XLSX, or TXT." },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to parse file: ${err?.message ?? err}` }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found in the file." }, { status: 400 });
  }

  const report = await importLeads(rows, "csv", niche);
  return NextResponse.json({ ok: true, report });
}

/** Parse CSV with PapaParse. Detects email/name/company columns by header. */
async function parseCsv(buf: Buffer): Promise<ImportRow[]> {
  const Papa = (await import("papaparse")).default;
  const text = buf.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return result.data
    .map((row) => {
      const email = findColumn(row, ["email", "e-mail", "mail", "email address"]) || "";
      const firstName =
        findColumn(row, ["first_name", "firstname", "first", "name", "full name", "contact"]) || "";
      const company = findColumn(row, ["company", "organization", "organisation", "business", "website"]) || "";
      return { email, firstName: firstName || null, company: company || null };
    })
    .filter((r) => isValidEmail(r.email));
}

/** Parse modern XLSX files with read-excel-file. */
async function parseExcel(buf: Buffer): Promise<ImportRow[]> {
  const { readSheet } = await import("read-excel-file/node");
  const sheet = await readSheet(buf);
  const headers = (sheet[0] || []).map((cell) => String(cell || "").trim().toLowerCase());
  return sheet
    .slice(1)
    .map((cells) => {
      const lower: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (header) lower[header] = String(cells[index] || "").trim();
      });
      const email =
        findColumn(lower, ["email", "e-mail", "mail", "email address"]) || "";
      const firstName =
        findColumn(lower, ["first_name", "firstname", "first", "name", "full name", "contact"]) || "";
      const company =
        findColumn(lower, ["company", "organization", "organisation", "business", "website"]) || "";
      return { email, firstName: firstName || null, company: company || null };
    })
    .filter((r) => isValidEmail(r.email));
}

function findColumn(row: Record<string, string>, candidates: string[]): string | undefined {
  for (const c of candidates) {
    if (row[c] && String(row[c]).trim()) return String(row[c]).trim();
  }
  return undefined;
}
