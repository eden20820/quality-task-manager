import * as XLSX from "xlsx";
import type { EcoImportAction, EcoImportChange, EcoImportResolution } from "./eco-import";

export type PkaImportData = {
  reference_number: string; opened_at: string; customer_order: string | null; part_number: string | null; revision: string | null;
  product_name: string; assembly_description: string | null; assembly_name: string | null; final_product: string | null;
  required_quantity: number; produced_quantity: number | null; status: "open" | "closed"; due_date: string | null; closed_at: string | null; notes: string | null;
};
export type ExistingPka = PkaImportData & { id: string };
export type PkaImportRow = { key: string; rowNumber: number; label: string; action: EcoImportAction; resolution: EcoImportResolution; changes: EcoImportChange[]; error?: string; existingId?: string; data?: PkaImportData };
export type PkaImportPreview = { fileName: string; rows: PkaImportRow[]; newCount: number; updatedCount: number; duplicateCount: number; unchangedCount: number; invalidCount: number; ignoredCount: number };

const PREFIX = "PKA_IMPORT_JSON:";
const clean = (value: unknown) => String(value ?? "").replace(/[\u200e\u200f\u202a-\u202e]/g, "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalized = (value: unknown) => clean(value).replace(/["׳״:()./]/g, "").replace(/\s+/g, "").toLocaleLowerCase("he-IL");
const reference = (value: unknown) => clean(value).toUpperCase().replace(/[–—/]/g, "-").replace(/\s+/g, "");
const display = (value: unknown) => clean(value) || "ריק";

function excelDate(value: unknown) {
  if (!clean(value)) return null;
  let year: number; let month: number; let day: number;
  if (typeof value === "number") { const parsed = XLSX.SSF.parse_date_code(value); if (!parsed) return null; ({ y: year, m: month, d: day } = parsed); }
  else { const match = clean(value).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/); if (!match) return null; day = Number(match[1]); month = Number(match[2]); year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]); }
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function quantity(value: unknown) { const text = clean(value); if (!text) return null; const parsed = Number(text); return Number.isInteger(parsed) && parsed >= 0 ? parsed : NaN; }
function status(value: unknown): PkaImportData["status"] | null { const text = clean(value); if (!text || /פתוח|בתהליך/.test(text)) return "open"; if (/הושל|נושל|מבוטל|סגור/.test(text)) return "closed"; return null; }

const requiredHeaders = ["מספקע", "תאריךפתיחה", "שםלקוחמספרהזמנה", "מקטמסשרטוט", "גרסה", "שםמוצר", "תיאורההרכבה", "שםהמכלולמערכת", "מוצרסופי", "כמותנדרשת", "כמותשיוצרה", "סטטוספתוחהבתהליךהושלמהמבוטלת", "תאריךיעד", "תאריךסגירהבפועל", "הערות"];

export function parsePkaWorkbook(buffer: ArrayBuffer | Uint8Array) {
  const workbook = XLSX.read(buffer, { cellDates: false });
  const candidates: Array<{ rowNumber: number; data?: PkaImportData; error?: string }> = [];
  let ignoredCount = 0; let found = false;
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true, range: "A1:O2000" });
    const headerIndex = rows.findIndex((row) => requiredHeaders.every((header) => row.some((cell) => normalized(cell) === header)));
    if (headerIndex < 0) continue;
    found = true;
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index]; if (row.every((cell) => !clean(cell))) continue;
      const ref = reference(row[0]);
      if (!/^\d{4}-\d{3}$/.test(ref)) { ignoredCount += 1; continue; }
      const openedAt = excelDate(row[1]); const dueDate = excelDate(row[12]); const closedAt = excelDate(row[13]);
      const requiredQuantity = quantity(row[9]); const producedQuantity = quantity(row[10]); const state = status(row[11]);
      const errors: string[] = [];
      if (!openedAt) errors.push("תאריך הפתיחה חסר או לא תקין");
      if (!clean(row[5]) && !clean(row[6])) errors.push("שם המוצר ותיאור ההרכבה חסרים");
      if (requiredQuantity === null || Number.isNaN(requiredQuantity)) errors.push("הכמות הנדרשת חסרה או לא תקינה");
      if (Number.isNaN(producedQuantity)) errors.push("הכמות שיוצרה אינה תקינה");
      if (!state) errors.push("הסטטוס אינו מוכר");
      if (clean(row[12]) && !dueDate) errors.push("תאריך היעד אינו תקין");
      if (clean(row[13]) && !closedAt) errors.push("תאריך הסגירה אינו תקין");
      if (errors.length || !openedAt || requiredQuantity === null || Number.isNaN(requiredQuantity) || !state) { candidates.push({ rowNumber: index + 1, error: errors.join("; ") }); continue; }
      candidates.push({ rowNumber: index + 1, data: { reference_number: ref, opened_at: openedAt, customer_order: clean(row[2]) || null, part_number: clean(row[3]) || null, revision: clean(row[4]) || null, product_name: clean(row[5]) || clean(row[6]), assembly_description: clean(row[6]) || null, assembly_name: clean(row[7]) || null, final_product: clean(row[8]) || null, required_quantity: requiredQuantity, produced_quantity: producedQuantity, status: state, due_date: dueDate, closed_at: closedAt, notes: clean(row[14]).replace(/^\/$/, "") || null } });
    }
  }
  if (!found) throw new Error("מבנה הקובץ אינו תקין. לא נמצאו כל 15 עמודות מעקב הפק״ע הנדרשות");
  return { candidates, ignoredCount };
}

export function packPkaNotes(data: PkaImportData) { return `${PREFIX}${JSON.stringify(data)}`; }
export function unpackPkaNotes(notes: string | null) { if (!notes?.startsWith(PREFIX)) return null; try { return JSON.parse(notes.slice(PREFIX.length)) as PkaImportData; } catch { return null; } }

export function buildPkaPreview(fileName: string, parsed: ReturnType<typeof parsePkaWorkbook>, existing: ExistingPka[]): PkaImportPreview {
  const existingByReference = new Map(existing.map((row) => [reference(row.reference_number), row]));
  const occurrences = new Map<string, number>();
  for (const candidate of parsed.candidates) if (candidate.data) occurrences.set(candidate.data.reference_number, (occurrences.get(candidate.data.reference_number) ?? 0) + 1);
  const fields: Array<[keyof PkaImportData, string]> = [["opened_at", "תאריך פתיחה"], ["customer_order", "לקוח / הזמנה"], ["part_number", "מק״ט / שרטוט"], ["revision", "גרסה"], ["product_name", "שם מוצר"], ["assembly_description", "תיאור הרכבה"], ["assembly_name", "מכלול / מערכת"], ["final_product", "מוצר סופי"], ["required_quantity", "כמות נדרשת"], ["produced_quantity", "כמות שיוצרה"], ["status", "סטטוס"], ["due_date", "תאריך יעד"], ["closed_at", "תאריך סגירה"], ["notes", "הערות"]];
  const rows: PkaImportRow[] = parsed.candidates.map((candidate) => {
    if (!candidate.data) return { key: `row-${candidate.rowNumber}`, rowNumber: candidate.rowNumber, label: `שורה ${candidate.rowNumber}`, action: "invalid", resolution: "skip", changes: [], error: candidate.error };
    const data = candidate.data;
    if ((occurrences.get(data.reference_number) ?? 0) > 1) return { key: `${data.reference_number}-${candidate.rowNumber}`, rowNumber: candidate.rowNumber, label: data.reference_number, action: "duplicate", resolution: "skip", changes: [], error: "מספר הפק״ע מופיע יותר מפעם אחת בקובץ", data };
    const old = existingByReference.get(data.reference_number);
    if (!old) return { key: data.reference_number, rowNumber: candidate.rowNumber, label: `${data.reference_number} — ${data.product_name}`, action: "new", resolution: "import", changes: [], data };
    const changes = fields.flatMap(([field, label]) => normalized(old[field]) === normalized(data[field]) ? [] : [{ field: label, before: display(old[field]), after: display(data[field]) }]);
    if (!changes.length) return { key: data.reference_number, rowNumber: candidate.rowNumber, label: data.reference_number, action: "unchanged", resolution: "skip", changes: [], existingId: old.id, data };
    return { key: data.reference_number, rowNumber: candidate.rowNumber, label: data.reference_number, action: "update", resolution: "keep", changes, existingId: old.id, data };
  });
  return { fileName, rows, newCount: rows.filter((row) => row.action === "new").length, updatedCount: rows.filter((row) => row.action === "update").length, duplicateCount: rows.filter((row) => row.action === "duplicate").length, unchangedCount: rows.filter((row) => row.action === "unchanged").length, invalidCount: rows.filter((row) => row.action === "invalid").length, ignoredCount: parsed.ignoredCount };
}
