import * as XLSX from "xlsx";
import type { EcoImportAction, EcoImportChange, EcoImportResolution } from "./eco-import";

export type SupplierImportData = {
  supplier_number: string | null; supplier_name: string; product_service: string | null; has_certification: boolean; has_experience: boolean;
  status: string; certification_type: string | null; expiration_date: string | null; delivery_score: number | null; quality_score: number | null;
  professionalism_score: number | null; requirements_score: number | null; weighted_score: number | null; notes: string | null;
};
export type ExistingSupplier = SupplierImportData & { id: string };
export type SupplierImportRow = { key: string; rowNumber: number; label: string; action: EcoImportAction; resolution: EcoImportResolution; changes: EcoImportChange[]; error?: string; existingId?: string; data?: SupplierImportData };
export type SupplierImportPreview = { fileName: string; rows: SupplierImportRow[]; newCount: number; updatedCount: number; duplicateCount: number; unchangedCount: number; invalidCount: number; ignoredCount: number };

const clean = (value: unknown) => String(value ?? "").replace(/[\u200e\u200f\u202a-\u202e]/g, "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const comparable = (value: unknown) => clean(value).toLocaleLowerCase("he-IL");
const display = (value: unknown) => typeof value === "boolean" ? (value ? "כן" : "לא") : clean(value) || "ריק";
const identity = (data: Pick<SupplierImportData, "supplier_number" | "supplier_name">) => data.supplier_number ? `number:${clean(data.supplier_number)}` : `name:${comparable(data.supplier_name)}`;
function number(value: unknown) { const text = clean(value); if (!text) return null; const parsed = Number(text); return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? parsed : NaN; }
function date(value: unknown) { if (!clean(value) || /^n\/?a$/i.test(clean(value))) return null; if (typeof value === "number") { const parsed = XLSX.SSF.parse_date_code(value); return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}` : null; } const match = clean(value).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/); if (!match) return null; const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]); return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`; }

export function parseSupplierWorkbook(buffer: ArrayBuffer | Uint8Array) {
  const workbook = XLSX.read(buffer, { cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => /approved supplier/i.test(name));
  if (!sheetName) throw new Error("לא נמצאה לשונית Approved Supplier List בקובץ");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true, range: "A1:N1000" });
  const headerIndex = rows.findIndex((row) => clean(row[0]) === "#" && /supplier\s+name/i.test(clean(row[1])) && /supplied product/i.test(clean(row[2])));
  if (headerIndex < 0) throw new Error("מבנה הקובץ אינו תקין. לא נמצאו עמודות רשימת הספקים הנדרשות");
  const header = rows[headerIndex];
  const subHeader = rows[headerIndex + 1] ?? [];
  if (!/status/i.test(clean(header[5])) || !/certification type/i.test(clean(header[6])) || !/date expiration/i.test(clean(header[7])) || !/certification/i.test(clean(subHeader[3]))) {
    throw new Error("מבנה הקובץ אינו תקין. חסרות עמודות חובה ברשימת הספקים");
  }
  const candidates: Array<{ rowNumber: number; data?: SupplierImportData; error?: string }> = [];
  let ignoredCount = 0;
  for (let i = headerIndex + 2; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.every((value) => !clean(value))) continue;
    const supplierName = clean(row[1]);
    if (!supplierName || /^עודכן ביום/.test(clean(row[0]))) { ignoredCount += 1; continue; }
    const expirationRaw = clean(row[7]);
    const expirationDate = date(row[7]);
    const scores = [number(row[8]), number(row[9]), number(row[10]), number(row[11]), number(row[12])];
    const errors: string[] = [];
    if (expirationRaw && !/^n\/?a$/i.test(expirationRaw) && !expirationDate) errors.push("תאריך התוקף אינו תקין");
    if (scores.some((score) => Number.isNaN(score))) errors.push("אחד הציונים אינו בין 0 ל־10");
    if (errors.length) { candidates.push({ rowNumber: i + 1, error: errors.join("; ") }); continue; }
    candidates.push({ rowNumber: i + 1, data: { supplier_number: clean(row[0]) || null, supplier_name: supplierName, product_service: clean(row[2]) || null, has_certification: clean(row[3]).toUpperCase() === "X", has_experience: clean(row[4]).toUpperCase() === "X", status: clean(row[5]) || "Approved", certification_type: clean(row[6]) || null, expiration_date: expirationDate, delivery_score: scores[0], quality_score: scores[1], professionalism_score: scores[2], requirements_score: scores[3], weighted_score: scores[4], notes: clean(row[13]).replace(/^\\/, "") || null } });
  }
  return { candidates, ignoredCount };
}

export function buildSupplierPreview(fileName: string, parsed: ReturnType<typeof parseSupplierWorkbook>, existing: ExistingSupplier[]): SupplierImportPreview {
  const existingByIdentity = new Map(existing.map((row) => [identity(row), row]));
  const occurrences = new Map<string, number>();
  for (const candidate of parsed.candidates) if (candidate.data) { const key = identity(candidate.data); occurrences.set(key, (occurrences.get(key) ?? 0) + 1); }
  const fields: Array<[keyof SupplierImportData, string]> = [["supplier_name", "שם ספק"], ["product_service", "מוצר / שירות"], ["has_certification", "הסמכה"], ["has_experience", "ניסיון"], ["status", "סטטוס"], ["certification_type", "סוג הסמכה"], ["expiration_date", "תאריך תוקף"], ["delivery_score", "עמידה בלו״ז"], ["quality_score", "איכות"], ["professionalism_score", "מקצועיות"], ["requirements_score", "עמידה בדרישות"], ["weighted_score", "ציון משוקלל"], ["notes", "הערות"]];
  const rows: SupplierImportRow[] = parsed.candidates.map((candidate) => {
    if (!candidate.data) return { key: `row-${candidate.rowNumber}`, rowNumber: candidate.rowNumber, label: `שורה ${candidate.rowNumber}`, action: "invalid", resolution: "skip", changes: [], error: candidate.error };
    const data = candidate.data; const key = identity(data); const label = data.supplier_number ? `${data.supplier_number} — ${data.supplier_name}` : data.supplier_name;
    if ((occurrences.get(key) ?? 0) > 1) return { key: `${key}-${candidate.rowNumber}`, rowNumber: candidate.rowNumber, label, action: "duplicate", resolution: "skip", changes: [], error: "הספק מופיע יותר מפעם אחת בקובץ", data };
    const old = existingByIdentity.get(key);
    if (!old) return { key, rowNumber: candidate.rowNumber, label, action: "new", resolution: "import", changes: [], data };
    const changes = fields.flatMap(([field, fieldLabel]) => comparable(old[field]) === comparable(data[field]) ? [] : [{ field: fieldLabel, before: display(old[field]), after: display(data[field]) }]);
    if (!changes.length) return { key, rowNumber: candidate.rowNumber, label, action: "unchanged", resolution: "skip", changes: [], existingId: old.id, data };
    return { key, rowNumber: candidate.rowNumber, label, action: "update", resolution: "keep", changes, existingId: old.id, data };
  });
  return { fileName, rows, newCount: rows.filter((r) => r.action === "new").length, updatedCount: rows.filter((r) => r.action === "update").length, duplicateCount: rows.filter((r) => r.action === "duplicate").length, unchangedCount: rows.filter((r) => r.action === "unchanged").length, invalidCount: rows.filter((r) => r.action === "invalid").length, ignoredCount: parsed.ignoredCount };
}
