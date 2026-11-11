import { writeFile } from "node:fs/promises";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildEcoFormPdf, extractEcoFormPayload } from "./eco-form-pdf";
import { createEmptyEcoForm, ecoFormIsSigned, isEcoFormPayload, nextEcoRevision, updateEcoProduct } from "./eco-form";
describe("online ECO form", () => {
  it("increments numeric revisions, preserves zero padding and permits manual overrides", () => {
    for (const [old, next] of [["00", "01"], ["03", "04"], ["9", "10"], ["09", "10"], ["99", "100"], [" 003 ", "004"], ["", ""], ["A", ""], ["1.2", ""]]) expect(nextEcoRevision(old)).toBe(next);
    const product = { partName: "", catalogNumber: "", currentRevision: "00", newRevision: "01" };
    expect(updateEcoProduct(product, "currentRevision", "03").newRevision).toBe("04");
    expect(updateEcoProduct(product, "newRevision", "07").newRevision).toBe("07");
    expect(updateEcoProduct(product, "partName", "Cover", { partName: "Cover", catalogNumber: "TEST", revision: "09" })).toMatchObject({ currentRevision: "09", newRevision: "10", catalogNumber: "TEST" });
  });
  it("validates optional illustration blocks while keeping old saved forms compatible", () => {
    const payload = createEmptyEcoForm("2026-11-11");
    const block = { id: "test", mode: "pair" as const, title: "", beforeLabel: "לפני", afterLabel: "אחרי", beforeImage: "", afterImage: "", beforeCaption: "", afterCaption: "", notes: "" };
    expect(isEcoFormPayload(payload)).toBe(true);
    expect(isEcoFormPayload({ ...payload, illustrations: [block] })).toBe(true);
    for (const illustrations of [null, [null], [{ ...block, beforeImage: "https://example.com/image.jpg" }], [{ ...block, beforeImage: "data:image/svg+xml;base64,AAAA" }], Array(11).fill(block), [{ ...block, beforeImage: "x".repeat(420001) }]]) expect(isEcoFormPayload({ ...payload, illustrations })).toBe(false);
    expect(isEcoFormPayload({ ...payload, illustrations: Array(10).fill({ ...block, beforeImage: `data:image/jpeg;base64,${"A".repeat(300000)}` }) })).toBe(false);
  });
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
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
    const objects = pdf.context.enumerateIndirectObjects().map(([, object]) => object.toString()).join("\n");
    expect(objects).toMatch(/\/BaseFont \/David-/); expect(objects).not.toMatch(/Arial|DejaVu/);
    for (const page of pdf.getPages()) {
      const contents = page.node.Contents(); const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
      const operators = streams.filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream).map(stream => Buffer.from(decodePDFRawStream(stream).decode()).toString()).join("\n");
      const sizes = Array.from(operators.matchAll(/\/[^\s]+\s+([\d.]+)\s+Tf/g), match => Number(match[1]));
      expect(new Set(sizes)).toEqual(new Set([12, 20]));
      expect(sizes.filter(size => size === 20).length).toBeGreaterThan(0);
    }
    if (process.env.ECO_PDF_SAMPLE_PATH) await writeFile(process.env.ECO_PDF_SAMPLE_PATH, bytes);
  });
  it("embeds images and preserves captions and editable comparison blocks on reopen", async () => {
    const payload = createEmptyEcoForm("2026-11-11");
    const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    const jpeg = "data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKWAaI//2Q==";
    payload.illustrations = [{ id: "comparison", mode: "pair", title: "מכסה (ABC)", beforeLabel: "לפני", afterLabel: "אחרי", beforeImage: image, afterImage: jpeg, beforeCaption: "PN-001 Rev00", afterCaption: "PN-001 Rev01", notes: "החלפת המכסה ושיפור ההרכבה" }, { id: "single", mode: "single", title: "פרט נוסף", beforeLabel: "תמונה", afterLabel: "", beforeImage: image, afterImage: "", beforeCaption: "פרט A", afterCaption: "", notes: "" }];
    const bytes = await buildEcoFormPdf(payload);
    expect(await extractEcoFormPayload(bytes)).toEqual(payload);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.context.enumerateIndirectObjects().filter(([, object]) => object.toString().includes("/Subtype /Image")).length).toBeGreaterThan(1);
  });
  it("preserves long paragraphs and extra products across continuation pages", async () => {
    const payload = createEmptyEcoForm("2026-11-11"); payload.changeDescription = "שינוי ABC לבדיקה ".repeat(200);
    payload.products = Array.from({ length: 20 }, (_, i) => ({ partName: `Product ${i + 1}`, catalogNumber: `PN-${i + 1}`, currentRevision: "00", newRevision: "01" }));
    const bytes = await buildEcoFormPdf(payload);
    expect(await extractEcoFormPayload(bytes)).toEqual(payload);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(3);
  });
});
