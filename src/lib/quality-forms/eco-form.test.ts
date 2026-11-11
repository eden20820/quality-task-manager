import { writeFile } from "node:fs/promises";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildEcoFormPdf, extractEcoFormPayload } from "./eco-form-pdf";
import { createEmptyEcoForm, ecoFormIsSigned, isEcoFormPayload } from "./eco-form";
describe("online ECO form", () => {
  it("accepts an incomplete draft and rejects invalid rows and signatures", () => {
    const payload = createEmptyEcoForm("2026-11-11");
    expect(isEcoFormPayload(payload)).toBe(true);
    expect(ecoFormIsSigned(payload)).toBe(false);
    for (const bad of [{ ...payload, products: [] }, { ...payload, risk: null }, { ...payload, approvals: [] }, { ...payload, initialApproval: { name: "", date: "", signature: "bad" } }]) expect(isEcoFormPayload(bad)).toBe(false);
  });
  it("requires every requested approval as well as initial and closure signatures", () => {
    const payload = createEmptyEcoForm("2026-11-11");
    payload.initialApproval.signature = "signature"; payload.closure.signature = "signature"; payload.closure.decision = "approved";
    expect(ecoFormIsSigned(payload)).toBe(true);
    payload.approvals[0].required = true;
    expect(ecoFormIsSigned(payload)).toBe(false);
    payload.approvals[0].signature = "signature";
    expect(ecoFormIsSigned(payload)).toBe(true);
  });
  it("exports the original three-part structure in David 12 and reopens every field", async () => {
    const payload = createEmptyEcoForm("2026-11-11");
    payload.formNumber = "022-2026"; payload.initiatorName = "בודק לדוגמה"; payload.initiatorRole = "QC";
    payload.products = [{ partName: "מכלול ABC (פיתוח)", catalogNumber: "TEST-PART-001", currentRevision: "00", newRevision: "01" }, { partName: "Sample cover", catalogNumber: "TEST-PART-002", currentRevision: "02", newRevision: "03" }];
    payload.categories[0] = true; payload.changeDescription = "עדכון מכלול ABC ושיפור האטימה.\nשינוי מבוקר בהתאם לשרטוט (מהדורה 01).";
    payload.justification = "שיפור אמינות ותהליך הרכבה."; payload.productImpact = "לא צפויה פגיעה באיכות המוצר."; payload.risk.survey = "בוצע סקר סיכונים.";
    payload.actions[0] = { requirement: "required", date: "2026-11-11" }; payload.approvals[0].required = true;
    const bytes = await buildEcoFormPdf(payload);
    expect(await extractEcoFormPayload(bytes)).toEqual(payload);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(3);
    const objects = pdf.context.enumerateIndirectObjects().map(([, object]) => object.toString()).join("\n");
    expect(objects).toMatch(/\/BaseFont \/David-/); expect(objects).not.toMatch(/Arial|DejaVu/);
    for (const page of pdf.getPages()) {
      const contents = page.node.Contents(); const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
      const operators = streams.filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream).map(stream => Buffer.from(decodePDFRawStream(stream).decode()).toString()).join("\n");
      const sizes = Array.from(operators.matchAll(/\/[^\s]+\s+([\d.]+)\s+Tf/g), match => Number(match[1]));
      expect(new Set(sizes)).toEqual(new Set([12]));
    }
    if (process.env.ECO_PDF_SAMPLE_PATH) await writeFile(process.env.ECO_PDF_SAMPLE_PATH, bytes);
  });
  it("preserves long paragraphs and extra products across continuation pages", async () => {
    const payload = createEmptyEcoForm("2026-11-11"); payload.changeDescription = "שינוי ABC לבדיקה ".repeat(200);
    payload.products = Array.from({ length: 20 }, (_, i) => ({ partName: `Product ${i + 1}`, catalogNumber: `PN-${i + 1}`, currentRevision: "00", newRevision: "01" }));
    const bytes = await buildEcoFormPdf(payload);
    expect(await extractEcoFormPayload(bytes)).toEqual(payload);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(3);
  });
});
