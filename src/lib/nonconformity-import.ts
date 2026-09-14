import * as XLSX from "xlsx";
import type { EcoImportAction, EcoImportChange, EcoImportResolution } from "./eco-import";

export type NonconformityImportData = {
  reference_number: string;
  name: string;
  opened_at: string;
  status: "open" | "waiting" | "closed";
  closed_at: string | null;
  supplier_complaint: string | null;
  customer_complaint: string | null;
  effectiveness_due: string | null;
  effectiveness_actual: string | null;
};
export type ExistingNonconformity = NonconformityImportData & { id: string };
export type NonconformityImportRow = { key: string; rowNumber: number; label: string; action: EcoImportAction; resolution: EcoImportResolution; changes: EcoImportChange[]; error?: string; existingId?: string; data?: NonconformityImportData };
export type NonconformityImportPreview = { fileName: string; rows: NonconformityImportRow[]; newCount: number; updatedCount: number; duplicateCount: number; unchangedCount: number; invalidCount: number; ignoredCount: number };

const headers = {
  number: "מספר אי התאמה", opened: "תאריך פתיחה", description: "תיאור אי ההתאמה", supplier: "תלונת ספק",
  customer: "תלונת לקוח", status: "סטטוס", closed: "תאריך סגירה", due: "תאריך יעד לבדיקת אפקטיביות", actual: "תאריך בדיקת אפקטיביות בפועל",
} as const;
const PREFIX = "NONCONFORMITY_IMPORT_JSON:";
const clean = (value: unknown) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalized = (value: unknown) => clean(value).replace(/[:.]/g, "").trim();
const ref = (value: unknown) => clean(value).toUpperCase().replace(/[–—/]/g, "-").replace(/\s+/g, "");
const display = (value: unknown) => clean(value) || "ריק";

function date(value: unknown) {
  if (value === null || value === undefined || clean(value) === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  if (typeof value === "number") { const parsed = XLSX.SSF.parse_date_code(value); return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}` : null; }
  const match = clean(value).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return null;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function status(value: unknown): NonconformityImportData["status"] | null {
  const text = clean(value);
  if (/סגור/.test(text)) return "closed";
  if (/ממתין/.test(text)) return "waiting";
  if (/פתוח|נפתח/.test(text)) return "open";
  return null;
}

export function parseNonconformityWorkbook(buffer: ArrayBuffer | Uint8Array) {
  const workbook = XLSX.read(buffer, { cellDates: false });
  const candidates: Array<{ rowNumber: number; data?: NonconformityImportData; error?: string }> = [];
  let ignoredCount = 0;
  let found = false;
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerIndex = rows.findIndex((row) => Object.values(headers).every((header) => row.some((cell) => normalized(cell) === header)));
    if (headerIndex < 0) continue;
    found = true;
    const header = rows[headerIndex].map(normalized);
    const index = Object.fromEntries(Object.entries(headers).map(([key, label]) => [key, header.indexOf(label)])) as Record<keyof typeof headers, number>;
    for (let i = headerIndex + 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (row.every((value) => !clean(value))) continue;
      const number = ref(row[index.number]);
      if (!/^\d{3}-\d{4}$/.test(number)) { ignoredCount += 1; continue; }
      const opened = date(row[index.opened]);
      const state = status(row[index.status]);
      const closedRaw = clean(row[index.closed]);
      const closed = date(row[index.closed]);
      const name = clean(row[index.description]);
      const errors: string[] = [];
      if (!opened) errors.push("תאריך פתיחה חסר או לא תקין");
      if (!name) errors.push("תיאור אי ההתאמה חסר");
      if (!state) errors.push("סטטוס לא תקין");
      if (state === "closed" && (!closedRaw || !closed)) errors.push("לרשומה סגורה חסר תאריך סגירה תקין");
      if (errors.length || !opened || !state) candidates.push({ rowNumber: i + 1, error: errors.join("; ") });
      else candidates.push({ rowNumber: i + 1, data: { reference_number: number, name, opened_at: opened, status: state, closed_at: closed, supplier_complaint: clean(row[index.supplier]) || null, customer_complaint: clean(row[index.customer]) || null, effectiveness_due: date(row[index.due]) ?? (clean(row[index.due]) || null), effectiveness_actual: date(row[index.actual]) ?? (clean(row[index.actual]) || null) } });
    }
  }
  if (!found) throw new Error(`מבנה הקובץ אינו תקין. נדרשות העמודות: ${Object.values(headers).join(", ")}`);
  return { candidates, ignoredCount };
}

export function packNonconformityNotes(data: Pick<NonconformityImportData, "supplier_complaint" | "customer_complaint" | "effectiveness_due" | "effectiveness_actual">, notes: string | null = null, openedByName: string | null = null) {
  return `${PREFIX}${JSON.stringify({ ...data, notes, opened_by_name: openedByName })}`;
}
export function unpackNonconformityNotes(notes: string | null) {
  if (!notes?.startsWith(PREFIX)) return null;
  try { return JSON.parse(notes.slice(PREFIX.length)) as { supplier_complaint: string | null; customer_complaint: string | null; effectiveness_due: string | null; effectiveness_actual: string | null; notes: string | null; opened_by_name?: string | null }; } catch { return null; }
}

export function buildNonconformityPreview(fileName: string, parsed: ReturnType<typeof parseNonconformityWorkbook>, existing: ExistingNonconformity[]): NonconformityImportPreview {
  const existingByRef = new Map(existing.map((row) => [ref(row.reference_number), row]));
  const counts = new Map<string, number>();
  for (const candidate of parsed.candidates) if (candidate.data) counts.set(candidate.data.reference_number, (counts.get(candidate.data.reference_number) ?? 0) + 1);
  const fields: Array<[keyof NonconformityImportData, string]> = [["name", "תיאור"], ["opened_at", "תאריך פתיחה"], ["status", "סטטוס"], ["closed_at", "תאריך סגירה"], ["supplier_complaint", "תלונת ספק"], ["customer_complaint", "תלונת לקוח"], ["effectiveness_due", "יעד אפקטיביות"], ["effectiveness_actual", "אפקטיביות בפועל"]];
  const rows: NonconformityImportRow[] = parsed.candidates.map((candidate) => {
    if (!candidate.data) return { key: `row-${candidate.rowNumber}`, rowNumber: candidate.rowNumber, label: `שורה ${candidate.rowNumber}`, action: "invalid", resolution: "skip", changes: [], error: candidate.error };
    const data = candidate.data;
    if ((counts.get(data.reference_number) ?? 0) > 1) return { key: `${data.reference_number}-${candidate.rowNumber}`, rowNumber: candidate.rowNumber, label: data.reference_number, action: "duplicate", resolution: "skip", changes: [], error: "מספר אי התאמה מופיע יותר מפעם אחת בקובץ", data };
    const old = existingByRef.get(data.reference_number);
    if (!old) return { key: data.reference_number, rowNumber: candidate.rowNumber, label: data.reference_number, action: "new", resolution: "import", changes: [], data };
    const changes = fields.flatMap(([field, label]) => clean(old[field]).toLocaleLowerCase("he-IL") === clean(data[field]).toLocaleLowerCase("he-IL") ? [] : [{ field: label, before: display(old[field]), after: display(data[field]) }]);
    if (!changes.length) return { key: data.reference_number, rowNumber: candidate.rowNumber, label: data.reference_number, action: "unchanged", resolution: "skip", changes: [], existingId: old.id, data };
    return { key: data.reference_number, rowNumber: candidate.rowNumber, label: data.reference_number, action: "update", resolution: "keep", changes, existingId: old.id, data };
  });
  return { fileName, rows, newCount: rows.filter((r) => r.action === "new").length, updatedCount: rows.filter((r) => r.action === "update").length, duplicateCount: rows.filter((r) => r.action === "duplicate").length, unchangedCount: rows.filter((r) => r.action === "unchanged").length, invalidCount: rows.filter((r) => r.action === "invalid").length, ignoredCount: parsed.ignoredCount };
}
