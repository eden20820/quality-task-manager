import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { buildEcoPreview, parseEcoWorkbook, type EcoImportData, type ExistingEco } from "./eco-import";

const headers = ["No.", "Project", "Name", "Description", "Opened", "Status", "Closing / Cancellation Date", "Comments "];
const baseRow = ["001-2026", "CRUSOE Hybrid", "Dor Dei", "PCB update", 46146, "פתוח", "", "note"];

function workbook(rows: unknown[][], customHeaders = headers) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Engineering Change Order List"], [], customHeaders, ...rows]), "ECO");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function parse(rows: unknown[][], customHeaders = headers) {
  return parseEcoWorkbook(workbook(rows, customHeaders));
}

function existing(overrides: Partial<ExistingEco> = {}): ExistingEco {
  const data = buildEcoPreview("test.xlsx", parse([baseRow]), []).rows[0].data as EcoImportData;
  return { id: "11111111-1111-1111-1111-111111111111", ...data, ...overrides };
}

describe("ECO Excel import", () => {
  const fixture = process.env.ECO_FIXTURE;

  it.skipIf(!fixture)("parses the supplied real ECO workbook", () => {
    const file = readFileSync(fixture!);
    const parsed = parseEcoWorkbook(file);
    const preview = buildEcoPreview("מעקב ECO.xlsx", parsed, []);
    expect(preview.newCount).toBe(24);
    expect(preview.invalidCount).toBe(0);
    expect(preview.ignoredCount).toBe(3);
    expect(preview.rows[0].data?.reference_number).toBe("001-2026");
    expect(preview.rows[0].data?.opened_at).toBe("2026-05-04");
    expect(preview.rows.at(-1)?.data?.reference_number).toBe("024-2026");
  });

  it("A: detects a new ECO", () => {
    const preview = buildEcoPreview("test.xlsx", parse([baseRow]), []);
    expect(preview.newCount).toBe(1);
    expect(preview.rows[0].resolution).toBe("import");
  });

  it("B: detects an identical existing ECO", () => {
    const preview = buildEcoPreview("test.xlsx", parse([baseRow]), [existing()]);
    expect(preview.unchangedCount).toBe(1);
    expect(preview.rows[0].resolution).toBe("skip");
  });

  it("C: detects a status change", () => {
    const changed = [...baseRow]; changed[5] = "סגור"; changed[6] = 46147;
    const preview = buildEcoPreview("test.xlsx", parse([changed]), [existing()]);
    expect(preview.updatedCount).toBe(1);
    expect(preview.rows[0].changes.map((change) => change.field)).toContain("Status");
    expect(preview.rows[0].resolution).toBe("keep");
  });

  it("D: lists multiple changed fields", () => {
    const changed = [...baseRow]; changed[1] = "New project"; changed[2] = "New owner"; changed[3] = "New description";
    const preview = buildEcoPreview("test.xlsx", parse([changed]), [existing()]);
    expect(preview.rows[0].changes).toHaveLength(3);
  });

  it("E: ignores approval and signature rows", () => {
    const parsed = parse([baseRow, ["Approved By:", "", "QA"], ["Date:", 46147], ["Signature:"]]);
    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.ignoredCount).toBe(3);
  });

  it("F: skips an empty row in the table", () => {
    const parsed = parse([baseRow, [], ["002-2026", "P", "Owner", "Description", 46147, "פתוח", "", ""]]);
    expect(parsed.candidates).toHaveLength(2);
  });

  it("G: marks every repeated ECO number inside the Excel file as duplicate", () => {
    const preview = buildEcoPreview("test.xlsx", parse([baseRow, baseRow]), []);
    expect(preview.duplicateCount).toBe(2);
    expect(preview.rows.every((row) => row.resolution === "skip")).toBe(true);
  });

  it("H: rejects a workbook missing a required column", () => {
    expect(() => parse([baseRow], headers.filter((header) => header !== "Status"))).toThrow(/נדרשות העמודות/);
  });

  it("I: classifies a mixed import", () => {
    const changed = [...baseRow]; changed[0] = "002-2026"; changed[3] = "Updated";
    const unchanged = [...baseRow]; unchanged[0] = "003-2026";
    const fresh = [...baseRow]; fresh[0] = "004-2026";
    const preview = buildEcoPreview("test.xlsx", parse([changed, unchanged, fresh, ["bad", "", "", "", "", ""]]), [
      existing({ reference_number: "002-2026" }),
      existing({ reference_number: "003-2026" }),
    ]);
    expect({ new: preview.newCount, update: preview.updatedCount, unchanged: preview.unchangedCount, invalid: preview.invalidCount }).toEqual({ new: 1, update: 1, unchanged: 1, invalid: 1 });
  });
});
