import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream } from "pdf-lib";
import { inflateSync } from "node:zlib";
import { ECO_MAX_ATTACHMENT_BYTES, type EcoAttachment } from "./eco-files";
import { DavidFormPdf, type FormCell } from "./david-form-pdf";
import { ECO_ACTIONS, ECO_CATEGORIES, isEcoFormPayload, type EcoFormPayload, type EcoSignature, type EcoIllustration } from "./eco-form";
import { getEcoLayout, type EcoSection } from "./eco-layout";
const payloadKey = PDFName.of("EcoFormPayload");
const date = (value: string) => { const [y, m, d] = value.split("-"); return y && m && d ? `${d}.${m}.${y}` : value; };
const mark = (checked: boolean) => checked ? "[X]" : "[ ]";
const label = (text: string): FormCell => ({ text, bold: true, shade: true, align: "right" });
export async function buildEcoFormPdf(payload: EcoFormPayload) {
  const form = await DavidFormPdf.create("טופס בקשה לשינוי / Change Control", "8.5.6.1.0", { cellPadding: 7, titleSize: 20 });
  const paragraph = async (title: string, value: string, minHeight: number) => {
    form.gap(12); form.ensureSpace(29 + Math.min(minHeight, 150));
    if (title.trim()) await form.table([[{ text: title, bold: true, shade: true }]], [1]);
    await form.table([[{ text: value, align: "justify", minHeight }]], [1]);
  };
  const signature = async (title: string, value: EcoSignature) => {
    form.gap(8); form.ensureSpace(96);
    await form.table([[{ text: title, bold: true, align: "right" }]], [1]);
    await form.table([[{ text: "", image: value.signature }, date(value.date), value.name]], [30, 30, 40], ["חתימה", "תאריך", "שם"]);
  };
  const illustration = async (block: EcoIllustration) => {
    form.gap(14); form.ensureSpace(245);
    if (block.title) await form.table([[{ text: block.title, bold: true, shade: true, align: "right" }]], [1]);
    const pair = block.mode === "pair";
    const weights = pair ? [1, 1] : [1];
    await form.table([[{ text: block.beforeLabel, bold: true, shade: true }, ...(pair ? [{ text: block.afterLabel, bold: true, shade: true }] : [])]], weights);
    await form.table([[{ text: "", image: block.beforeImage, imageHeight: 160, minHeight: 180 }, ...(pair ? [{ text: "", image: block.afterImage, imageHeight: 160, minHeight: 180 }] : [])]], weights);
    if (block.beforeCaption || (pair && block.afterCaption)) await form.table([[block.beforeCaption, ...(pair ? [block.afterCaption] : [])]], weights);
    if (block.notes) await form.table([[{ text: block.notes, align: "justify", minHeight: 38 }]], [1]);

  };
  const sections: Record<EcoSection, () => Promise<void>> = {
details: async () => {
  await form.table([[date(payload.date), label("תאריך"), payload.formNumber, label("מספר טופס")], [payload.initiatorRole, label("תפקיד"), payload.initiatorName, label("שם יוזם השינוי")]], [30, 20, 30, 20]);
  form.gap(12);
  const categories = ECO_CATEGORIES.map((name, index) => ({ text: `${mark(payload.categories[index])} ${name}${index === 5 && payload.otherCategory ? ` - ${payload.otherCategory}` : ""}`, align: "right" as const }));
  await form.table([[categories[2], categories[1], categories[0]], [categories[5], categories[4], categories[3]]], [1, 1, 1]);

},
products: async () => {
  form.gap(12);
  await form.table(payload.products.map(p => [p.newRevision, p.currentRevision, p.catalogNumber, p.partName]), [14, 14, 30, 42], [label("גרסה חדשה"), label("גרסה אחרונה"), label("מק״ט"), label("שם/תיאור המוצר/פריט")]);

},
description: async () => {
  await paragraph("תיאור השינוי - למילוי ע״י יוזם השינוי", payload.changeDescription, 90);

},
justification: async () => {
  await paragraph("ההצדקה לשינוי - למילוי ע״י יוזם השינוי", payload.justification, 62);

},
initialApproval: async () => {
  await signature("אישור ראשוני - הבטחת איכות", payload.initialApproval);

},
impact: async () => {
  form.gap(12); form.ensureSpace(175);
  await form.table([[{ text: "השפעת השינוי - למילוי ע״י הבטחת איכות", bold: true, shade: true }]], [1]);
  await form.table([[{ text: payload.productImpact, align: "justify", minHeight: 42 }, label("על איכות המוצר")], [{ text: payload.qualitySystemImpact, align: "justify", minHeight: 42 }, label("על מערכת האיכות")], [{ text: payload.regulatoryImpact, align: "justify", minHeight: 42 }, label("על חוקים, תקנות רגולטוריות")]], [70, 30]);

},
approvals: async () => {
  if (!payload.layout) form.startPage(); else { form.gap(12); form.ensureSpace(95); }
  await form.table([[{ text: "אישורים נדרשים", bold: true, shade: true }]], [1]);
  await form.table(payload.approvals.map(a => [a.notes, date(a.date), { text: "", image: a.signature, minHeight: 32 }, a.name, a.role, mark(a.required)]), [22, 15, 14, 21, 18, 10], ["הערות", "תאריך", "חתימה", "שם מלא", "תפקיד", "נדרש אישור"]);

},
actions: async () => {
  if (!payload.layout) form.startPage(); else { form.gap(12); form.ensureSpace(95); }
  await form.table([[{ text: "פעולות נלוות", bold: true, shade: true }], ["(בשינוי גרפיקה יש להתייחס לכל רמות האריזה)"]], [1]);
  const requirement = (value: string, completed: string) => `${mark(value === "required")} נדרש, בוצע בתאריך: ${date(completed)}    ${mark(value === "not-required")} לא נדרש`;
  await form.table([[{ text: `${requirement(payload.risk.requirement, payload.risk.date)}\nסקר סיכונים\n${payload.risk.survey}`, align: "justify", minHeight: 70, attachments: payload.risk.attachments }, label("ביצוע ניהול סיכונים")], [
    { text: `${mark(payload.inventory === "none")} אין   ${mark(payload.inventory === "use")} שימוש במלאי   ${mark(payload.inventory === "reject")} פסול   ${mark(payload.inventory === "other")} אחר (פרט): ${payload.inventoryOther}`, align: "right" }, label("מלאי נוכחי")], [
    { text: `${mark(payload.openOrders === "none")} אין   ${mark(payload.openOrders === "accept")} קבלה   ${mark(payload.openOrders === "cancel")} ביטול   ${mark(payload.openOrders === "other")} אחר (פרט): ${payload.openOrdersOther}`, align: "right" }, label("הזמנות פתוחות")],
    ...payload.actions.map((action, index): FormCell[] => [{ text: requirement(action.requirement, action.date), align: "right", attachments: action.attachments }, label(ECO_ACTIONS[index])]),
    [{ text: payload.additionalTasks, align: "justify", minHeight: 60 }, label("הערות + משימות נוספות לביצוע")],
  ], [76, 24]);

},
closure: async () => {
  form.ensureSpace(175);
  await form.section("סגירת הטופס ע״י מנהל איכות");
  await form.table([[{ text: `${mark(payload.closure.decision === "approved")} מאושר    ${mark(payload.closure.decision === "rejected")} נדחה. הסבר: ${payload.closure.reason}`, align: "justify" }]], [1]);
  await signature("אישור מנהל איכות", payload.closure);

},
  };
  for (const block of getEcoLayout(payload)) {
    if (block.kind === "section") await sections[block.section]();
    else if (block.kind === "text") await paragraph(block.title, block.text, 60);
    else { const image = payload.illustrations?.find(image => image.id === block.illustrationId); if (image) await illustration(image); }
  }
  // File bytes already exist as PDF embedded streams: don't duplicate them in metadata.
  const refsOnly = (files?: EcoAttachment[]) => files?.map(file => ({ ...file, data: "" }));
  const metadata = { ...payload, risk: { ...payload.risk, attachments: refsOnly(payload.risk.attachments) }, actions: payload.actions.map(action => ({ ...action, attachments: refsOnly(action.attachments) })) };
  form.pdf.context.lookup(form.pdf.context.trailerInfo.Info, PDFDict).set(payloadKey, PDFHexString.fromText(JSON.stringify(metadata)));
  return form.finish();
}
export async function extractEcoFormPayload(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const ref = pdf.context.trailerInfo.Info;
  const encoded = ref ? pdf.context.lookup(ref, PDFDict).get(payloadKey) : null;
  if (!(encoded instanceof PDFHexString)) throw new Error("אפשר לפתוח לעריכה רק טופס ECO שהופק במערכת");
  const payload: unknown = JSON.parse(encoded.decodeText());
  if (payload && typeof payload === "object") {
    const draft = payload as EcoFormPayload;
    const expected = [...(Array.isArray(draft.actions) ? draft.actions : []), draft.risk].flatMap(action => Array.isArray(action?.attachments) ? action.attachments : []);
    if (expected.length > 60) throw new Error("מספר הקבצים בטופס אינו תקין");
    const names = pdf.catalog.lookupMaybe(PDFName.of("Names"), PDFDict)?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict)?.lookupMaybe(PDFName.of("Names"), PDFArray);
    let total = 0;
    for (let i = 1; names && i < names.size(); i += 2) {
      const spec = pdf.context.lookup(names.get(i), PDFDict), id = spec.get(PDFName.of("EcoAttachmentId"));
      if (!(id instanceof PDFHexString)) continue;
      const file = expected.find(file => file && file.id === id.decodeText() && file.data === "");
      if (!file) continue;
      const stream = spec.lookup(PDFName.of("EF"), PDFDict).lookup(PDFName.of("F"));
      if (!(stream instanceof PDFRawStream)) throw new Error("קובץ מצורף אינו תקין");
      const filter = stream.dict.get(PDFName.of("Filter"));
      if (filter?.toString() !== "/FlateDecode") throw new Error("קובץ מצורף אינו תקין");
      const decoded = inflateSync(stream.getContents(), { maxOutputLength: ECO_MAX_ATTACHMENT_BYTES });
      total += decoded.byteLength; if (total > 2_500_000) throw new Error("הקבצים המצורפים גדולים מדי");
      file.data = decoded.toString("base64");
    }
  }
  if (!isEcoFormPayload(payload)) throw new Error("נתוני טופס ECO אינם תקינים");
  return payload;
}
