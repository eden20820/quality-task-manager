import { writeFile } from "node:fs/promises";

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildShelfProductInspectionDocx } from "./shelf-product-docx";
import { parseShelfProductInspectionDocx } from "./shelf-product-docx-import";
import type { ShelfProductInspectionPayload } from "./shelf-product-inspection";

const sample: ShelfProductInspectionPayload = {
  productName: "מוצר בדיקה",
  catalogNumber: "TEST-100",
  supplierName: "ספק לדוגמה",
  quantity: "5",
  batchNumber: "BATCH-001",
  receiptDate: "2026-01-15",
  documents: { coc: true, coa: false, cot: true, other: false },
  otherDocument: "",
  inspections: [
    { result: "pass", comment: "אריזה שלמה" },
    { result: "pass", comment: "" },
    { result: "pass", comment: "" },
    { result: "pass", comment: "תואם להזמנה" },
  ],
  usageApproval: "approved",
  notes: "המסמך נוצר בהצלחה.",
  inspectorName: "Sergey Dror",
  inspectorDate: "2026-01-15",
  approverDate: "2026-01-15",
};

describe("shelf product inspection DOCX", () => {
  it("creates a complete single-page inspection document", async () => {
    const buffer = await buildShelfProductInspectionDocx(sample);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("TEST-100");
    expect(xml).toContain("מוצר בדיקה");
    expect(xml).toContain("15.01.2026");
    expect(xml).toContain("המסמך נוצר בהצלחה.");
    expect(xml).toContain("יש לצרף טופס זה למסמכי הקליטה של החומר");
    expect(xml).toContain("מאושר מותנה (לפרטים בהערות)");
    expect((xml?.match(/<w:tbl>/g) ?? []).length).toBe(6);
    expect(xml).toContain("Sergey Dror");
    expect(xml).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    if (process.env.SHELF_DOCX_SAMPLE_PATH) await writeFile(process.env.SHELF_DOCX_SAMPLE_PATH, buffer);
  });

  it("loads an exported document back into an editable form", async () => {
    const restored = await parseShelfProductInspectionDocx(await buildShelfProductInspectionDocx(sample));
    expect(restored).toEqual(sample);
  });

  it("restores failures, conditional approval, other documents and blank values", async () => {
    const source: ShelfProductInspectionPayload = {
      ...sample,
      batchNumber: "",
      documents: { coc: false, coa: true, cot: false, other: true },
      otherDocument: "Packing list",
      inspections: sample.inspections.map((inspection, index) => index === 1 ? { result: "fail", comment: "תווית חסרה" } : { ...inspection, result: "" }),
      usageApproval: "conditional",
      notes: "אישור לאחר השלמת תווית",
      inspectorName: "Eden Aharon",
    };
    expect(await parseShelfProductInspectionDocx(await buildShelfProductInspectionDocx(source))).toEqual(source);
  });
});
