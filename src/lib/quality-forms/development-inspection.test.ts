import { writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildDevelopmentInspectionPdf, developmentPdfTextLayout, extractDevelopmentInspectionPayload } from "./development-inspection-pdf";
import { createEmptyDevelopmentInspection, isDevelopmentInspectionPayload } from "./development-inspection";

describe("development inspection form", () => {
  it("mirrors parentheses only in Hebrew paint runs", () => {
    expect(developmentPdfTextLayout("תוקף (אם רלוונטי)").runs[0].text).toBe("תוקף )אם רלוונטי(");
    expect(developmentPdfTextLayout("ABC (test)").runs[0].text).toBe("ABC (test)");
  });
  it("keeps blank fields blank when exporting and reopening", async () => {
    const payload = createEmptyDevelopmentInspection("");
    const bytes = await buildDevelopmentInspectionPdf(payload);
    expect(await extractDevelopmentInspectionPayload(bytes)).toEqual(payload);
    if (process.env.DEVELOPMENT_EMPTY_PDF_SAMPLE_PATH) await writeFile(process.env.DEVELOPMENT_EMPTY_PDF_SAMPLE_PATH, bytes);
  });
  it("creates a valid empty payload", () => { const payload = createEmptyDevelopmentInspection("2026-11-04"); expect(payload.date).toBe("2026-11-04"); expect(payload.drawingRows).toHaveLength(3); expect(isDevelopmentInspectionPayload(payload)).toBe(true); });
  it("rejects malformed rows", () => { const payload = { ...createEmptyDevelopmentInspection("2026-11-04"), drawingRows: [] }; expect(isDevelopmentInspectionPayload(payload)).toBe(false); });
  it("creates a one-page editable PDF with mixed Hebrew and English", async () => {
    const payload = { ...createEmptyDevelopmentInspection("2026-11-04"), supplierName: "Nautec נאותק", catalogNumber: "DEV-204", itemDescription: "מכלול פיתוח AL-6061", drawingNumber: "DG-DEV-204", revision: "01", receivedQuantity: "12", inspectedQuantity: "3", documents: { coc: true, inspectionReport: true, none: false }, visualChecks: { packageIntegrity: true, marking: true, validity: false }, drawingRows: [{ characteristic: "קוטר", requirement: "6.00 ± 0.10", inspectionMethod: "Caliper", actualResult: "6.02", conformity: "pass" as const }, { characteristic: "חומר", requirement: "AL-6061", inspectionMethod: "COC", actualResult: "תקין", conformity: "pass" as const }, { characteristic: "", requirement: "", inspectionMethod: "", actualResult: "", conformity: "" as const }], generalConformity: "conforms" as const, nonconformityFound: "no" as const, finalStatus: "approved" as const, checkedByName: "עדן אהרון", approvedByName: "גל פסו" };
    const bytes = await buildDevelopmentInspectionPdf(payload); const document = await PDFDocument.load(bytes); expect(document.getPageCount()).toBe(1); expect(bytes.subarray(0, 4).toString()).toBe("%PDF"); expect(await extractDevelopmentInspectionPayload(bytes)).toEqual(payload);
    const fontObjects = document.context.enumerateIndirectObjects().map(([, object]) => object.toString()).join("\n");
    expect(fontObjects).toMatch(/\/BaseFont \/David-\d+/);
    expect(fontObjects).toMatch(/\/BaseFont \/David-Bold-\d+/);
    if (process.env.DEVELOPMENT_INSPECTION_PDF_SAMPLE_PATH) await writeFile(process.env.DEVELOPMENT_INSPECTION_PDF_SAMPLE_PATH, bytes);
  });
});
