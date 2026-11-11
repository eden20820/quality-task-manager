import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { ECO_MEDIA_BUDGET, ecoAttachmentSize, ecoFileType, validEcoAttachment } from "./eco-files";
import { createEmptyEcoForm, isEcoFormPayload } from "./eco-form";
import { buildEcoFormPdf, extractEcoFormPayload } from "./eco-form-pdf";
const file = { id: "example", name: "BOM-example.xlsx", mimeType: ecoFileType("BOM-example.xlsx")!, data: Buffer.from("PK-test-attachment").toString("base64") };
describe("ECO action files", () => {
  it("allows supported types and validates file names, bytes, bounds and MIME", () => {
    expect(validEcoAttachment(file)).toBe(true); expect(ecoAttachmentSize(file)).toBe(18);
    for (const bad of [{ ...file, name: "../test.xlsx" }, { ...file, name: "file.exe" }, { ...file, mimeType: "text/html" }, { ...file, data: "!invalid!" }, { ...file, data: "A".repeat(2_700_000) }]) expect(validEcoAttachment(bad)).toBe(false);
    expect(ecoFileType("TEST.PDF")).toBe("application/pdf"); expect(ecoFileType("bad.xlsm")).toBeNull();
  });
  it("keeps old drafts valid, limits file count and enforces combined media budget", () => {
    const payload = createEmptyEcoForm("2026-11-11"); expect(isEcoFormPayload(payload)).toBe(true);
    payload.actions[0].attachments = [file]; expect(isEcoFormPayload(payload)).toBe(true);
    payload.actions[1].attachments = [file]; expect(isEcoFormPayload(payload)).toBe(false); payload.actions[1].attachments = [];
    payload.actions[0].attachments = Array(7).fill(file); expect(isEcoFormPayload(payload)).toBe(false);
    payload.actions[0].attachments = [{ ...file, data: "A".repeat(2_000_000) }]; payload.actions[1].attachments = [{ ...file, data: "A".repeat(2_000_000) }];
    expect(ECO_MEDIA_BUDGET).toBeLessThan(4_000_000); expect(isEcoFormPayload(payload)).toBe(false);
  });
  it("preserves exact attachment bytes, annotations and editability through PDF round-trip", async () => {
    const payload = createEmptyEcoForm("2026-11-11"); payload.actions[0].attachments = [file]; payload.actions[0].requirement = "required";
    payload.risk.attachments = [{ ...file, id: "risk", name: "סקר סיכונים.txt", mimeType: "text/plain" }];
    const bytes = await buildEcoFormPdf(payload); expect(await extractEcoFormPayload(bytes)).toEqual(payload);
    const pdf = await PDFDocument.load(bytes); let count = 0;
    for (const page of pdf.getPages()) {
      const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      for (const ref of annots?.asArray() ?? []) {
        const annotation = pdf.context.lookup(ref, PDFDict);
        expect(annotation.lookup(PDFName.of("Subtype"))).toEqual(PDFName.of("FileAttachment"));
        const spec = annotation.lookup(PDFName.of("FS"), PDFDict), ef = spec.lookup(PDFName.of("EF"), PDFDict);
        const stream = ef.lookup(PDFName.of("F"));
        if (!(stream instanceof PDFRawStream)) throw new Error("Missing file stream");
        const data = decodePDFRawStream(stream).decode();
        expect(Buffer.from(data).toString()).toBe("PK-test-attachment"); count++;
      }
    }
    expect(count).toBe(2);
    expect(pdf.catalog.lookup(PDFName.of("Names"), PDFDict).lookup(PDFName.of("EmbeddedFiles"), PDFDict).lookup(PDFName.of("Names"), PDFArray).size()).toBe(4);
  });
});
