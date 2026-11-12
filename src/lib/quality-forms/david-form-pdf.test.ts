import { decodePDFRawStream, PDFArray, PDFDocument, PDFPage, PDFRawStream } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { buildDevelopmentInspectionPdf, extractDevelopmentInspectionPayload } from "./development-inspection-pdf";
import { buildAdhesionLeakTestPdf } from "./adhesion-leak-test-pdf";
import { createEmptyDevelopmentInspection } from "./development-inspection";
import { createEmptyAdhesionLeakTest } from "./adhesion-leak-test";
import { DavidFormPdf, directionalTextLayout, justifiedTextLayout } from "./david-form-pdf";

describe("David 12 export typography", () => {
  it("renders full PDF lines against both margins but does not stretch a paragraph's final line", async () => {
    const spy=vi.spyOn(PDFPage.prototype,"drawText");
    try {
      const form=await DavidFormPdf.create("בדיקת יישור","TEST");
      await form.table([[{text:"התאמה ABC DEF בהתאם לדרישות השרטוט ".repeat(12)+"\nסיום קצר",align:"justify"}]],[1]);
      const words=spy.mock.calls.filter(([text])=>text==="התאמה"); expect(words.length).toBeGreaterThan(0);
      const y=words[0][1]!.y;
      const row=spy.mock.calls.filter(([,options])=>options?.y===y);
      expect(Math.min(...row.map(([,options])=>options!.x!))).toBeCloseTo(42);
      expect(Math.max(...row.map(([text,options])=>options!.x!+options!.font!.widthOfTextAtSize(text,12)))).toBeCloseTo(553.28);
      const last=spy.mock.calls.find(([text])=>text==="סיום קצר")![1]!;
      expect(last.x).toBeGreaterThan(450); expect(last.x!+last.font!.widthOfTextAtSize("סיום קצר",12)).toBeCloseTo(553.28);
    } finally {spy.mockRestore();}
  });
  it("justifies actual word gaps to both edges without reversing mixed English phrases", () => {
    const measure=(value:string)=>Array.from(value).length*6;
    const words=justifiedTextLayout("בדיקה ABC DEF לפני השינוי",300,measure,"rtl")!;
    expect(words[0].x).toBe(0); expect(words.at(-1)!.x+words.at(-1)!.width).toBeCloseTo(300);
    const english=words.filter(word=>/ABC|DEF/.test(word.text)); expect(english.map(word=>word.text)).toEqual(["ABC","DEF"]);
    const numbered=justifiedTextLayout("1. הסבר ABC לאחר השינוי",300,measure,"rtl")!; expect(numbered.at(-1)!.text).toBe("1.");
    expect(justifiedTextLayout("מילה",300,measure)).toBeNull(); expect(justifiedTextLayout("מילה [X]",300,measure)).toBeNull();
    const englishOnly=justifiedTextLayout("FIRST SECOND THIRD",200,measure)!;expect(englishOnly.map(word=>word.text)).toEqual(["FIRST","SECOND","THIRD"]);
  });
  it("places Hebrew list markers on the right, including mixed English and wrapped list items", () => {
    for (const text of ["1. תיאור השינוי", "12) TEST-001 עדכון שרטוט", "2. בדיקה (ABC) לאחר שינוי"]) expect(directionalTextLayout(text).baseDirection).toBe("rtl");
    expect(directionalTextLayout("1. English description").baseDirection).toBe("ltr");
    expect(directionalTextLayout("12.50").baseDirection).toBe("ltr");
  });
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
