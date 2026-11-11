import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildDevelopmentInspectionPdf, extractDevelopmentInspectionPayload } from "./development-inspection-pdf";
import { buildAdhesionLeakTestPdf } from "./adhesion-leak-test-pdf";
import { createEmptyDevelopmentInspection } from "./development-inspection";
import { createEmptyAdhesionLeakTest } from "./adhesion-leak-test";
import { directionalTextLayout } from "./david-form-pdf";

describe("David 12 export typography", () => {
  it("keeps paired parentheses in the same direction around mixed Hebrew and numbers", () => {
    const layout = directionalTextLayout("תיקון (מהדורה 01).");
    expect(layout.runs.find(run => run.text.includes("("))?.direction).toBe("rtl");
    expect(layout.runs.find(run => run.text.includes(")"))?.direction).toBe("rtl");
    expect(layout.runs.find(run => run.text.includes("01"))?.direction).toBe("ltr");
  });
  it.each(["development", "adhesion"])("uses embedded David and exactly 12pt for every %s PDF text operation", async (kind) => {
    const bytes = kind === "development" ? await buildDevelopmentInspectionPdf(createEmptyDevelopmentInspection("2026-11-11")) : await buildAdhesionLeakTestPdf(createEmptyAdhesionLeakTest("2026-11-11"));
    const pdf = await PDFDocument.load(bytes);
    const objects = pdf.context.enumerateIndirectObjects().map(([, object]) => object.toString()).join("\n");
    const fonts = Array.from(objects.matchAll(/\/BaseFont \/([^\s]+)/g), match => match[1]);
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.every(font => font.startsWith("David"))).toBe(true);
    for (const page of pdf.getPages()) {
      const contents = page.node.Contents();
      const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
      const operators = streams.filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream).map(stream => Buffer.from(decodePDFRawStream(stream).decode()).toString()).join("\n");
      const sizes = Array.from(operators.matchAll(/\/[^\s]+\s+([\d.]+)\s+Tf/g), match => Number(match[1]));
      expect(sizes.length).toBeGreaterThan(0);
      expect(new Set(sizes)).toEqual(new Set([12]));
    }
  });
  it("paginates long values without losing editable content", async () => {
    const payload = createEmptyDevelopmentInspection("2026-11-11");
    payload.visualNotes = "בדיקה ABC (תקינה) ".repeat(400);
    const bytes = await buildDevelopmentInspectionPdf(payload);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
    expect(await extractDevelopmentInspectionPayload(bytes)).toEqual(payload);
  });
});
