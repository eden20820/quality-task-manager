import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildSupplierPreview, parseSupplierWorkbook, type ExistingSupplier } from "./supplier-import";

const header = ["#", "Supplier Name", "Supplied product/service", "Supplier Name", "", "Status", "Certification type", "Date expiration", "עמידה בלו\"ז 30%", "איכות", "מקצועיות", "דרישות", "משוקלל", "הערות"];
const row = [1, "Supplier A", "CNC", "X", "X", "Approved", "ISO9001", 46865, 8, 9, 8, 9, 8.55, "note"];
function workbook(rows: unknown[][], sheetName = "Approved Supplier List 2026") { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["title"], [], header, ["", "", "", "Certification", "Experience"], ...rows]), sheetName); return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer; }

describe("supplier Excel import", () => {
  const fixture = process.env.SUPPLIER_FIXTURE;
  it.skipIf(!fixture)("parses the supplied active supplier list", () => { const parsed = parseSupplierWorkbook(readFileSync(fixture!)); const preview = buildSupplierPreview("APL CAELI 2026.xlsx", parsed, []); expect(preview.newCount).toBe(120); expect(preview.invalidCount).toBe(0); expect(preview.ignoredCount).toBe(1); expect(preview.rows[0].data).toMatchObject({ supplier_number: "1", supplier_name: "לייזר מודלינג", expiration_date: null }); expect(preview.rows[1].data?.expiration_date).toBe("2028-04-22"); expect(preview.rows.at(-1)?.data?.supplier_name).toBe("Dongguan Hongxia Precision Machinery"); });
  it("detects new and unchanged suppliers", () => { const parsed = parseSupplierWorkbook(workbook([row])); const fresh = buildSupplierPreview("test.xlsx", parsed, []); expect(fresh.newCount).toBe(1); const existing = { id: "1", ...fresh.rows[0].data } as ExistingSupplier; expect(buildSupplierPreview("test.xlsx", parsed, [existing]).unchangedCount).toBe(1); });
  it("shows changed expiration dates and keeps existing by default", () => { const parsed = parseSupplierWorkbook(workbook([row])); const data = buildSupplierPreview("test.xlsx", parsed, []).rows[0].data!; const preview = buildSupplierPreview("test.xlsx", parsed, [{ id: "1", ...data, expiration_date: "2027-01-01" }]); expect(preview.updatedCount).toBe(1); expect(preview.rows[0].resolution).toBe("keep"); expect(preview.rows[0].changes.map((change) => change.field)).toContain("תאריך תוקף"); });
  it("uses exact normalized names only when supplier number is missing", () => { const blankNumber = [...row]; blankNumber[0] = ""; const parsed = parseSupplierWorkbook(workbook([blankNumber])); const data = buildSupplierPreview("test.xlsx", parsed, []).rows[0].data!; expect(buildSupplierPreview("test.xlsx", parsed, [{ id: "1", ...data, supplier_name: " supplier a " }]).unchangedCount).toBe(1); });
  it("marks repeated supplier identities as duplicates", () => { expect(buildSupplierPreview("test.xlsx", parseSupplierWorkbook(workbook([row, row])), []).duplicateCount).toBe(2); });
  it("rejects workbooks without the approved supplier sheet", () => { expect(() => parseSupplierWorkbook(workbook([row], "Other"))).toThrow(/Approved Supplier List/); });
});
