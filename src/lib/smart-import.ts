// src/lib/smart-import.ts
// Smart lead-file parsing: fuzzy column detection, BOM/delimiter handling,
// headerless email extraction, and a clear mapping report for the UI.
import { extractEmails, isUsableLeadEmail, isValidEmail, normalizeEmail } from "./normalize";
import type { ImportRow } from "./dedup";

export type ColumnMapping = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  niche: string | null;
};

export type SmartImportResult = {
  rows: ImportRow[];
  mapping: ColumnMapping;
  headers: string[];
  sample: ImportRow[];
  parsedRows: number;
  format: "csv" | "xlsx" | "txt" | "unknown";
};

const EMAIL_HEADERS = [
  "email",
  "e-mail",
  "e mail",
  "mail",
  "email address",
  "emailaddress",
  "email id",
  "emailid",
  "contact email",
  "work email",
  "business email",
  "primary email",
  "email_address",
  "courriel",
];

const FIRST_HEADERS = [
  "first_name",
  "firstname",
  "first name",
  "first",
  "given name",
  "given_name",
  "fname",
  "contact first name",
];

const LAST_HEADERS = [
  "last_name",
  "lastname",
  "last name",
  "last",
  "surname",
  "family name",
  "lname",
];

const FULL_NAME_HEADERS = [
  "name",
  "full name",
  "fullname",
  "contact",
  "contact name",
  "contact_name",
  "person",
  "lead name",
  "owner",
  "owner name",
];

const COMPANY_HEADERS = [
  "company",
  "company name",
  "company_name",
  "organization",
  "organisation",
  "org",
  "business",
  "business name",
  "firm",
  "brand",
  "account",
  "account name",
  "website",
  "domain",
];

const NICHE_HEADERS = ["niche", "category", "industry", "segment", "vertical", "type", "tag"];

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ");
}

function findHeader(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const c of candidates) {
    const hit = normalized.find((h) => h.norm === c);
    if (hit) return hit.raw;
  }
  // Fuzzy contains match (prefer shorter headers to avoid over-matching).
  for (const c of candidates) {
    const hit = normalized
      .filter((h) => h.norm.includes(c) || c.includes(h.norm))
      .sort((a, b) => a.norm.length - b.norm.length)[0];
    if (hit) return hit.raw;
  }
  return null;
}

function pick(row: Record<string, string>, key: string | null): string {
  if (!key) return "";
  return String(row[key] ?? "").trim();
}

function mapRows(headers: string[], dataRows: Record<string, string>[]): SmartImportResult {
  const mapping: ColumnMapping = {
    email: findHeader(headers, EMAIL_HEADERS),
    firstName: findHeader(headers, FIRST_HEADERS),
    lastName: findHeader(headers, LAST_HEADERS),
    company: findHeader(headers, COMPANY_HEADERS),
    niche: findHeader(headers, NICHE_HEADERS),
  };
  const fullNameHeader =
    !mapping.firstName && !mapping.lastName ? findHeader(headers, FULL_NAME_HEADERS) : null;

  const rows: ImportRow[] = [];
  for (const row of dataRows) {
    let email = pick(row, mapping.email);
    if (!email) {
      // Scan every cell for an email if the mapped column is empty/missing.
      for (const value of Object.values(row)) {
        const found = extractEmails(String(value || ""));
        if (found[0]) {
          email = found[0];
          break;
        }
      }
    }
    if (!email || !isValidEmail(email) || !isUsableLeadEmail(email)) continue;

    let firstName = pick(row, mapping.firstName) || null;
    const lastName = pick(row, mapping.lastName) || null;
    if (!firstName && fullNameHeader) {
      firstName = pick(row, fullNameHeader) || null;
    } else if (firstName && lastName) {
      firstName = `${firstName} ${lastName}`.trim();
    }

    const company = pick(row, mapping.company) || null;
    const niche = pick(row, mapping.niche) || null;

    rows.push({
      email: normalizeEmail(email),
      firstName,
      company,
      ...(niche ? { niche } : {}),
    });
  }

  // If no email column and almost nothing mapped, fall back to raw email scrape.
  if (rows.length === 0) {
    const blob = dataRows.map((r) => Object.values(r).join(" ")).join("\n");
    for (const email of extractEmails(blob)) {
      rows.push({ email, firstName: null, company: null });
    }
  }

  return {
    rows,
    mapping: {
      ...mapping,
      firstName: mapping.firstName || fullNameHeader,
    },
    headers,
    sample: rows.slice(0, 5),
    parsedRows: dataRows.length,
    format: "csv",
  };
}

export async function parseLeadCsv(buf: Buffer): Promise<SmartImportResult> {
  const Papa = (await import("papaparse")).default;
  const text = buf.toString("utf-8").replace(/^\uFEFF/, "");

  // Detect delimiter from the first non-empty line.
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const comma = (firstLine.match(/,/g) || []).length;
  const semi = (firstLine.match(/;/g) || []).length;
  const tab = (firstLine.match(/\t/g) || []).length;
  const delimiter = tab >= comma && tab >= semi ? "\t" : semi > comma ? ";" : ",";

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });

  const headers = (result.meta.fields || []).map((h) => String(h || "").trim()).filter(Boolean);
  const dataRows = (result.data || []).filter((row) =>
    Object.values(row || {}).some((v) => String(v || "").trim())
  );

  // Headerless file: first row looks like data with emails.
  if (headers.length === 0 || (!findHeader(headers, EMAIL_HEADERS) && extractEmails(firstLine).length > 0)) {
    const emails = extractEmails(text);
    return {
      rows: emails.map((email) => ({ email, firstName: null, company: null })),
      mapping: { email: null, firstName: null, lastName: null, company: null, niche: null },
      headers: [],
      sample: emails.slice(0, 5).map((email) => ({ email, firstName: null, company: null })),
      parsedRows: emails.length,
      format: "csv",
    };
  }

  return { ...mapRows(headers, dataRows), format: "csv" };
}

export async function parseLeadExcel(buf: Buffer): Promise<SmartImportResult> {
  const { readSheet } = await import("read-excel-file/node");
  const sheet = await readSheet(buf);
  if (!sheet.length) {
    return {
      rows: [],
      mapping: { email: null, firstName: null, lastName: null, company: null, niche: null },
      headers: [],
      sample: [],
      parsedRows: 0,
      format: "xlsx",
    };
  }

  const headerCells = (sheet[0] || []).map((cell) => String(cell ?? "").replace(/^\uFEFF/, "").trim());
  const headers = headerCells.filter(Boolean);
  const hasEmailHeader = Boolean(findHeader(headers, EMAIL_HEADERS));

  if (!hasEmailHeader) {
    // Treat as headerless matrix — extract emails from every cell.
    const blob = sheet.map((row) => row.map((c) => String(c ?? "")).join(" ")).join("\n");
    const emails = extractEmails(blob);
    return {
      rows: emails.map((email) => ({ email, firstName: null, company: null })),
      mapping: { email: null, firstName: null, lastName: null, company: null, niche: null },
      headers: [],
      sample: emails.slice(0, 5).map((email) => ({ email, firstName: null, company: null })),
      parsedRows: sheet.length,
      format: "xlsx",
    };
  }

  const dataRows: Record<string, string>[] = sheet.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headerCells.forEach((header, index) => {
      if (!header) return;
      row[header] = String(cells[index] ?? "").trim();
    });
    return row;
  });

  return { ...mapRows(headers, dataRows), format: "xlsx" };
}

export function parseLeadTxt(buf: Buffer): SmartImportResult {
  const text = buf.toString("utf-8").replace(/^\uFEFF/, "");
  const emails = extractEmails(text);
  const rows = emails.map((email) => ({ email, firstName: null, company: null }));
  return {
    rows,
    mapping: { email: null, firstName: null, lastName: null, company: null, niche: null },
    headers: [],
    sample: rows.slice(0, 5),
    parsedRows: emails.length,
    format: "txt",
  };
}
