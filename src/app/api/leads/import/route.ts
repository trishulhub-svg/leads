// src/app/api/leads/import/route.ts
// Smart import for CSV / Excel / TXT lead lists.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { importLeads } from "@/lib/dedup";
import { parseLeadCsv, parseLeadExcel, parseLeadTxt } from "@/lib/smart-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const niche = ((formData.get("niche") as string) || "").trim() || undefined;
  if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

  // Cap upload size before buffering to avoid OOM / timeout on huge files.
  const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB
  if (typeof file.size === "number" && file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Upload a list under 10 MB." },
      { status: 413 }
    );
  }

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_IMPORT_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Upload a list under 10 MB." },
      { status: 413 }
    );
  }

  let parsed;
  try {
    if (name.endsWith(".csv")) {
      parsed = await parseLeadCsv(buf);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      parsed = await parseLeadExcel(buf);
    } else if (name.endsWith(".txt")) {
      parsed = parseLeadTxt(buf);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload CSV, XLSX, or TXT." },
        { status: 400 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse file: ${message}` }, { status: 400 });
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "No valid email addresses found. Include an Email column, or paste emails into a TXT/CSV file.",
        mapping: parsed.mapping,
        headers: parsed.headers,
      },
      { status: 400 }
    );
  }

  // Apply default niche only when the row didn't carry one from the file.
  const rows = niche
    ? parsed.rows.map((row) => ({ ...row, niche: row.niche || niche }))
    : parsed.rows;

  const report = await importLeads(rows, "csv", niche);
  return NextResponse.json({
    ok: true,
    report,
    mapping: parsed.mapping,
    headers: parsed.headers,
    sample: parsed.sample,
    parsedRows: parsed.parsedRows,
    format: parsed.format,
    fileName: file.name,
  });
}
