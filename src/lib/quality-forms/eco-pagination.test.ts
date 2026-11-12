import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, PDFPage } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { DavidFormPdf } from "./david-form-pdf";
import { buildEcoFormPdf, extractEcoFormPayload } from "./eco-form-pdf";
import { createEmptyEcoForm } from "./eco-form";
import { changeEcoText, insertEcoBlock } from "./eco-layout";

const lines = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}_${String(i).padStart(3, "0")} בדיקה של טקסט רציף בעברית ABC`).join("\n");
describe("continuous ECO narrative pagination", () => {
  it("starts a long description on page one, keeps every line once, and continues within page bounds", async () => {
    const p = createEmptyEcoForm("2026-11-12");
    p.products = Array.from({ length: 3 }, (_, i) => ({ partName: `Test product ${i}`, catalogNumber: `TEST-${i}`, currentRevision: "00", newRevision: "01" }));
    p.changeDescription = lines("FLOW", 70);
    const spy = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await buildEcoFormPdf(p), pdf = await PDFDocument.load(bytes);
      const firstPage = spy.mock.contexts[0];
      const entries = spy.mock.calls.map(([text, options], i) => ({ text, options, page: spy.mock.contexts[i] }));
      const body = entries.filter(entry => /^FLOW_\d{3}$/.test(entry.text));
      expect(body).toHaveLength(70); expect(new Set(body.map(entry => entry.text)).size).toBe(70);
      expect(body[0].page).toBe(firstPage); expect(body[body.length - 1].page).not.toBe(firstPage);
      for (const entry of body) { expect(entry.options?.y).toBeGreaterThanOrEqual(64); expect(entry.options?.y).toBeLessThan(746); }
      expect(await extractEcoFormPayload(bytes)).toEqual(p); expect(pdf.getPageCount()).toBeGreaterThan(2);
      if (process.env.ECO_FLOW_SAMPLE_DIR) { await mkdir(process.env.ECO_FLOW_SAMPLE_DIR, { recursive: true }); await writeFile(`${process.env.ECO_FLOW_SAMPLE_DIR}/continuous-description.pdf`, bytes); }
      if (process.env.ECO_FLOW_SAMPLE_DIR) {
        p.changeDescription = Array.from({ length: 10 }, () => "תיאור השינוי כולל שיפור מבנה המוצר, התאמת רכיבים לתהליך הייצור והגדרת דרישות בדיקה. המכלול נבדק לפי שרטוט ABC במהדורה 01, תוך שמירה על תפקוד תקין, אמינות ובטיחות. השינוי מאפשר הרכבה פשוטה יותר ובקרה על איכות החלקים.").join("\n\n");
        await writeFile(`${process.env.ECO_FLOW_SAMPLE_DIR}/continuous-hebrew.pdf`, await buildEcoFormPdf(p));
      }
    } finally { spy.mockRestore(); }
  });
  it("splits large minimum-height cells in remaining space and keeps short atomic rows in other forms unchanged", async () => {
    for (const flowTextRows of [true, false]) {
      const form = await DavidFormPdf.create("TEST", "TEST", { flowTextRows, cellPadding: 7 });
      form.gap(430);
      const spy = vi.spyOn(PDFPage.prototype, "drawText");
      try {
        await form.table([[{ text: lines("MIN", 20), minHeight: 450 }]], [1]);
        const pdf = await PDFDocument.load(await form.finish());
        const body = spy.mock.calls.map(([text], i) => ({ text, page: spy.mock.contexts[i] })).filter(entry => /^MIN_/.test(entry.text));
        expect(body).toHaveLength(20);
        expect(new Set(body.map(entry => entry.page)).size).toBe(flowTextRows ? 2 : 1);
        expect(pdf.getPageCount()).toBe(2);
      } finally { spy.mockRestore(); }
    }
  });
  it("preserves custom paragraphs, impacts, image notes, risk attachments and final explanation across many pages", async () => {
    let p = insertEcoBlock(createEmptyEcoForm("2026-11-12"), "text", "custom", "section-description");
    p = changeEcoText(p, "custom", { title: "הסבר נוסף", text: lines("CUSTOM", 60) });
    p.productImpact = lines("IMPACT", 55); p.additionalTasks = lines("TASKS", 55); p.closure.reason = lines("FINAL", 55);
    p.risk.survey = lines("RISK", 55);
    p.risk.attachments = [{ id: "risk-file", name: "risk.txt", mimeType: "text/plain", data: "VGVzdA==" }];
    p.illustrations = [{ id: "picture", mode: "single", title: "כותרת תמונה", beforeLabel: "תמונה", afterLabel: "", beforeImage: "", afterImage: "", beforeCaption: "", afterCaption: "", notes: lines("NOTES", 55) }];
    p.layout!.push({ id: "image-picture", kind: "illustration", illustrationId: "picture" });
    const spy = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await buildEcoFormPdf(p);
      expect(await extractEcoFormPayload(bytes)).toEqual(p);
      for (const [prefix, count] of [["CUSTOM", 60], ["IMPACT", 55], ["TASKS", 55], ["FINAL", 55], ["RISK", 55], ["NOTES", 55]] as const) {
        const entries = spy.mock.calls.filter(([text]) => text.startsWith(`${prefix}_`));
        expect(entries).toHaveLength(count);
        for (const [, options] of entries) expect(options?.y).toBeGreaterThanOrEqual(64);
      }
    } finally { spy.mockRestore(); }
  });
});
