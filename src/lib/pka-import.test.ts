import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildPkaPreview, parsePkaWorkbook, type ExistingPka } from "./pka-import";

const headers = ["מס פק\"ע", "תאריך פתיחה ", "שם לקוח / מספר הזמנה ", "מק\"ט/מס שרטוט", "גרסה", "שם מוצר ", "תיאור ההרכבה", "שם המכלול/ מערכת", "מוצר סופי ", "כמות נדרשת", "כמות שיוצרה", "סטטוס (פתוחה/בתהליך/הושלמה/מבוטלת)", "תאריך יעד ", "תאריך סגירה בפועל", "הערות "];
const row = ["2601-001", "13/01/2026", "IWTSD", "ASY-001", "00", "ריאות", "הרכבת ריאה", "ריאה", "Crusoe", 10, 5, "בתהליך", "20/01/2026", "", "הערה"];
function workbook(rows: unknown[][], customHeaders = headers) { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([customHeaders, ...rows]), "מעקב"); return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer; }

describe("PKA Excel import", () => {
  const fixture = process.env.PKA_FIXTURE;
  it.skipIf(!fixture)("parses the supplied real workbook", () => { const preview = buildPkaPreview("מעקב פקעות.xlsx", parsePkaWorkbook(readFileSync(fixture!)), []); expect(preview.rows).toHaveLength(105); expect(preview.newCount).toBe(102); expect(preview.invalidCount).toBe(3); expect(preview.rows[0].data).toMatchObject({ reference_number: "2508-001", opened_at: "2025-08-14", required_quantity: 225 }); });
  it("detects new and unchanged records", () => { const parsed = parsePkaWorkbook(workbook([row])); const fresh = buildPkaPreview("test.xlsx", parsed, []); expect(fresh.newCount).toBe(1); expect(buildPkaPreview("test.xlsx", parsed, [{ id: "1", ...fresh.rows[0].data } as ExistingPka]).unchangedCount).toBe(1); });
  it("shows changed quantities and defaults to keeping existing", () => { const parsed = parsePkaWorkbook(workbook([row])); const data = buildPkaPreview("test.xlsx", parsed, []).rows[0].data!; const preview = buildPkaPreview("test.xlsx", parsed, [{ id: "1", ...data, produced_quantity: 2 }]); expect(preview.updatedCount).toBe(1); expect(preview.rows[0].resolution).toBe("keep"); expect(preview.rows[0].changes[0].field).toBe("כמות שיוצרה"); });
  it("marks duplicates in the workbook", () => { expect(buildPkaPreview("test.xlsx", parsePkaWorkbook(workbook([row, row])), []).duplicateCount).toBe(2); });
  it("rejects a workbook missing required columns", () => { expect(() => parsePkaWorkbook(workbook([row], headers.slice(0, -1)))).toThrow(/15 עמודות/); });
});
