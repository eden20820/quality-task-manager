import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildNonconformityPreview, parseNonconformityWorkbook, type ExistingNonconformity } from "./nonconformity-import";

const headers = ["מספר אי התאמה ", "תאריך פתיחה ", "תיאור אי ההתאמה ", "תלונת ספק", "תלונת לקוח", "סטטוס", "תאריך סגירה", "תאריך יעד לבדיקת אפקטיביות", "תאריך בדיקת אפקטיביות בפועל "];
const row = ["001-2026", new Date(2026, 0, 1), "תיאור", "כן", "N/A", "ממתין לאפקטיביות", "", "במשלוח הבא", ""];
function workbook(rows: unknown[][], customHeaders = headers) { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["שם טופס"], [], customHeaders, ...rows]), "2026"); return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer; }

describe("nonconformity Excel import", () => {
  const fixture = process.env.NONCONFORMITY_FIXTURE;
  it.skipIf(!fixture)("parses the supplied real workbook across both year sheets", () => { const parsed = parseNonconformityWorkbook(readFileSync(fixture!)); const preview = buildNonconformityPreview("לוג אי התאמות.xlsx", parsed, []); expect(preview.newCount).toBe(26); expect(preview.invalidCount).toBe(0); expect(preview.rows[0].data).toMatchObject({ reference_number: "001-2025", opened_at: "2025-08-28", closed_at: "2025-08-29" }); expect(preview.rows.at(-1)?.data?.reference_number).toBe("012-2026"); });
  it("detects new and unchanged records", () => { const parsed = parseNonconformityWorkbook(workbook([row])); const fresh = buildNonconformityPreview("test.xlsx", parsed, []); expect(fresh.newCount).toBe(1); const existing = { id: "1", ...fresh.rows[0].data } as ExistingNonconformity; expect(buildNonconformityPreview("test.xlsx", parsed, [existing]).unchangedCount).toBe(1); });
  it("shows changed fields and defaults to keep existing", () => { const parsed = parseNonconformityWorkbook(workbook([row])); const data = buildNonconformityPreview("test.xlsx", parsed, []).rows[0].data!; const preview = buildNonconformityPreview("test.xlsx", parsed, [{ id: "1", ...data, status: "open", supplier_complaint: "לא" }]); expect(preview.updatedCount).toBe(1); expect(preview.rows[0].resolution).toBe("keep"); expect(preview.rows[0].changes.map((change) => change.field)).toEqual(expect.arrayContaining(["סטטוס", "תלונת ספק"])); });
  it("marks repeated numbers inside the file as duplicates", () => { const preview = buildNonconformityPreview("test.xlsx", parseNonconformityWorkbook(workbook([row, row])), []); expect(preview.duplicateCount).toBe(2); });
  it("rejects a missing required column", () => { expect(() => parseNonconformityWorkbook(workbook([row], headers.slice(0, -1)))).toThrow(/נדרשות העמודות/); });
});
