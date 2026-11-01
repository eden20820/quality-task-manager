import { writeFile } from "node:fs/promises";

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildShelfProductInspectionDocx } from "./shelf-product-docx";
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
  inspectorDate: "2026-01-15",
  approverDate: "2026-01-15",
};

describe("shelf product inspection DOCX", () => {
  it("creates a complete two-page inspection document", async () => {
    const buffer = await buildShelfProductInspectionDocx(sample);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("TEST-100");
    expect(xml).toContain("מוצר בדיקה");
    expect(xml).toContain("15.01.2026");
    expect(xml).toContain("המסמך נוצר בהצלחה.");
    expect(xml).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    if (process.env.SHELF_DOCX_SAMPLE_PATH) await writeFile(process.env.SHELF_DOCX_SAMPLE_PATH, buffer);
  });
});
