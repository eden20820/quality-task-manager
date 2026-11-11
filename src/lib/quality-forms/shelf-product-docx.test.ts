import { writeFile } from "node:fs/promises";

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildShelfProductInspectionDocx } from "./shelf-product-docx";
import { parseShelfProductInspectionDocx } from "./shelf-product-docx-import";
import type { ShelfProductInspectionPayload } from "./shelf-product-inspection";

const sample: ShelfProductInspectionPayload = {
  products: [{ productName: "מוצר בדיקה", catalogNumber: "TEST-100", quantity: "5" }],
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
    const footerXml = await zip.file("word/footer1.xml")?.async("string");
    const styles = await zip.file("word/styles.xml")?.async("string");
    const fontTable = await zip.file("word/fontTable.xml")?.async("string");
    expect(`${xml}${footerXml}${styles}`).not.toContain("Arial");
    expect(xml).toContain('w:cs="David"');
    expect(xml).toContain('w:ascii="David"');
    expect(styles).toContain('w:cs="David"');
    expect(fontTable).toContain('w:name="David"');
    expect(fontTable).toContain("w:embedRegular");
    expect(fontTable).toContain("w:embedBold");
    const plainText = xml?.replace(/<[^>]*>/g, "");
    expect(xml).toContain("TEST-100");
    expect(xml).toContain("מוצר בדיקה");
    expect(xml).toContain("15.01.2026");
    expect(xml).toContain("המסמך נוצר בהצלחה.");
    expect(xml).toContain("יש לצרף טופס זה למסמכי הקליטה של החומר");
    expect(xml).toContain("מאושר מותנה (לפרטים בהערות)");
    expect((xml?.match(/<w:tbl>/g) ?? []).length).toBe(6);
    expect(footerXml).toContain("נספח 8.4.2.1.0");
    expect(xml).toContain("Sergey Dror");
    expect(xml).not.toContain("שם הספק:");
    expect(xml).not.toContain("אישור לשימוש:");
    expect(plainText).toContain("תפקיד: QC");
    expect(xml).toContain("תפקיד: משנה למנכ״ל");
    expect(plainText).toContain("שם: Sergey Dror");
    expect(plainText).toContain("שם: Uzi Barzilay");
    expect(xml).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    if (process.env.SHELF_DOCX_SAMPLE_PATH) await writeFile(process.env.SHELF_DOCX_SAMPLE_PATH, buffer);
  });

  it("loads an exported document back into an editable form", async () => {
    const restored = await parseShelfProductInspectionDocx(await buildShelfProductInspectionDocx(sample));
    expect(restored).toEqual(sample);
  });

  it("separates Hebrew and Latin direction without changing editable values", async () => {
    const productName = "BAR תוספת מגלים מאוורר 300";
    const source = { ...sample, products: [{ ...sample.products[0], productName }], productName, notes: "", inspectorName: "Eden Aharon" as const, usageApproval: "conditional" as const };
    const buffer = await buildShelfProductInspectionDocx(source);
    const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml")!.async("string");
    expect(xml).toContain('<w:rtl/>');
    expect(xml).toContain('<w:rtl w:val="false"/>');
    expect(xml).toMatch(/<w:jc w:val="center"\/>[^]*?<w:t[^>]*>N\/A<\/w:t>/);
    expect(await parseShelfProductInspectionDocx(buffer)).toEqual(source);
    if (process.env.SHELF_BIDI_DOCX_SAMPLE_PATH) await writeFile(process.env.SHELF_BIDI_DOCX_SAMPLE_PATH, buffer);
  });

  it("keeps multiple numbered products when a document is reopened", async () => {
    const source: ShelfProductInspectionPayload = {
      ...sample,
      products: [
        sample.products[0],
        { productName: "מוצר נוסף", catalogNumber: "TEST-200", quantity: "12" },
        { productName: "מוצר שלישי עם שם ארוך", catalogNumber: "LONG-CATALOG-300", quantity: "24" },
      ],
    };
    const buffer = await buildShelfProductInspectionDocx(source);
    expect(await parseShelfProductInspectionDocx(buffer)).toEqual(source);
    if (process.env.SHELF_MULTI_DOCX_SAMPLE_PATH) await writeFile(process.env.SHELF_MULTI_DOCX_SAMPLE_PATH, buffer);
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
