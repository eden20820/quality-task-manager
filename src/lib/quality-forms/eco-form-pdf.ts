import { PDFDict, PDFDocument, PDFHexString, PDFName } from "pdf-lib";
import { DavidFormPdf, type FormCell } from "./david-form-pdf";
import { ECO_ACTIONS, ECO_CATEGORIES, isEcoFormPayload, type EcoFormPayload, type EcoSignature } from "./eco-form";
const payloadKey = PDFName.of("EcoFormPayload");
const date = (value: string) => { const [y, m, d] = value.split("-"); return y && m && d ? `${d}.${m}.${y}` : value; };
const mark = (checked: boolean) => checked ? "[X]" : "[ ]";
const label = (text: string): FormCell => ({ text, bold: true, shade: true, align: "right" });
export async function buildEcoFormPdf(payload: EcoFormPayload) {
  const form = await DavidFormPdf.create("טופס בקשה לשינוי / Change Control", "8.5.6.1.0", { cellPadding: 7 });
  const paragraph = async (title: string, value: string, minHeight: number) => {
    form.gap(12); form.ensureSpace(29 + Math.min(minHeight, 150));
    await form.table([[{ text: title, bold: true, shade: true }]], [1]);
    await form.table([[{ text: value, align: "right", minHeight }]], [1]);
  };
  const signature = async (title: string, value: EcoSignature) => {
    form.gap(8); form.ensureSpace(96);
    await form.table([[{ text: title, bold: true, align: "right" }]], [1]);
    await form.table([[{ text: "", image: value.signature }, date(value.date), value.name]], [30, 30, 40], ["חתימה", "תאריך", "שם"]);
  };
  await form.table([[date(payload.date), label("תאריך"), payload.formNumber, label("מספר טופס")], [payload.initiatorRole, label("תפקיד"), payload.initiatorName, label("שם יוזם השינוי")]], [30, 20, 30, 20]);
  form.gap(12);
  const categories = ECO_CATEGORIES.map((name, index) => ({ text: `${mark(payload.categories[index])} ${name}${index === 5 && payload.otherCategory ? ` - ${payload.otherCategory}` : ""}`, align: "right" as const }));
  await form.table([[categories[2], categories[1], categories[0]], [categories[5], categories[4], categories[3]]], [1, 1, 1]);
  form.gap(12);
  await form.table(payload.products.map(p => [p.newRevision, p.currentRevision, p.catalogNumber, p.partName]), [14, 14, 30, 42], [label("גרסה חדשה"), label("גרסה אחרונה"), label("מק״ט"), label("שם/תיאור המוצר/פריט")]);
  await paragraph("תיאור השינוי - למילוי ע״י יוזם השינוי", payload.changeDescription, 90);
  for (const block of payload.illustrations ?? []) {
    form.gap(14); form.ensureSpace(245);
    if (block.title) await form.table([[{ text: block.title, bold: true, shade: true, align: "right" }]], [1]);
    const pair = block.mode === "pair";
    const weights = pair ? [1, 1] : [1];
    await form.table([[{ text: block.beforeLabel, bold: true, shade: true }, ...(pair ? [{ text: block.afterLabel, bold: true, shade: true }] : [])]], weights);
    await form.table([[{ text: "", image: block.beforeImage, imageHeight: 160, minHeight: 180 }, ...(pair ? [{ text: "", image: block.afterImage, imageHeight: 160, minHeight: 180 }] : [])]], weights);
    if (block.beforeCaption || (pair && block.afterCaption)) await form.table([[block.beforeCaption, ...(pair ? [block.afterCaption] : [])]], weights);
    if (block.notes) await form.table([[{ text: block.notes, align: "right", minHeight: 38 }]], [1]);
  }
  await paragraph("ההצדקה לשינוי - למילוי ע״י יוזם השינוי", payload.justification, 62);
  await signature("אישור ראשוני - הבטחת איכות", payload.initialApproval);
  form.gap(12); form.ensureSpace(175);
  await form.table([[{ text: "השפעת השינוי - למילוי ע״י הבטחת איכות", bold: true, shade: true }]], [1]);
  await form.table([[{ text: payload.productImpact, align: "right", minHeight: 42 }, label("על איכות המוצר")], [{ text: payload.qualitySystemImpact, align: "right", minHeight: 42 }, label("על מערכת האיכות")], [{ text: payload.regulatoryImpact, align: "right", minHeight: 42 }, label("על חוקים, תקנות רגולטוריות")]], [70, 30]);
  form.startPage();
  await form.table([[{ text: "אישורים נדרשים", bold: true, shade: true }]], [1]);
  await form.table(payload.approvals.map(a => [a.notes, date(a.date), { text: "", image: a.signature, minHeight: 32 }, a.name, a.role, mark(a.required)]), [22, 15, 14, 21, 18, 10], ["הערות", "תאריך", "חתימה", "שם מלא", "תפקיד", "נדרש אישור"]);
  form.startPage();
  await form.table([[{ text: "פעולות נלוות", bold: true, shade: true }], ["(בשינוי גרפיקה יש להתייחס לכל רמות האריזה)"]], [1]);
  const requirement = (value: string, completed: string) => `${mark(value === "required")} נדרש, בוצע בתאריך: ${date(completed)}    ${mark(value === "not-required")} לא נדרש`;
  await form.table([[{ text: `${requirement(payload.risk.requirement, payload.risk.date)}\nסקר סיכונים\n${payload.risk.survey}`, align: "right", minHeight: 70 }, label("ביצוע ניהול סיכונים")], [
    { text: `${mark(payload.inventory === "none")} אין   ${mark(payload.inventory === "use")} שימוש במלאי   ${mark(payload.inventory === "reject")} פסול   ${mark(payload.inventory === "other")} אחר (פרט): ${payload.inventoryOther}`, align: "right" }, label("מלאי נוכחי")], [
    { text: `${mark(payload.openOrders === "none")} אין   ${mark(payload.openOrders === "accept")} קבלה   ${mark(payload.openOrders === "cancel")} ביטול   ${mark(payload.openOrders === "other")} אחר (פרט): ${payload.openOrdersOther}`, align: "right" }, label("הזמנות פתוחות")],
    ...payload.actions.map((action, index): FormCell[] => [{ text: requirement(action.requirement, action.date), align: "right" }, label(ECO_ACTIONS[index])]),
    [{ text: payload.additionalTasks, align: "right", minHeight: 60 }, label("הערות + משימות נוספות לביצוע")],
  ], [76, 24]);
  form.ensureSpace(175);
  await form.section("סגירת הטופס ע״י מנהל איכות");
  await form.table([[{ text: `${mark(payload.closure.decision === "approved")} מאושר    ${mark(payload.closure.decision === "rejected")} נדחה. הסבר: ${payload.closure.reason}`, align: "right" }]], [1]);
  await signature("אישור מנהל איכות", payload.closure);
  form.pdf.context.lookup(form.pdf.context.trailerInfo.Info, PDFDict).set(payloadKey, PDFHexString.fromText(JSON.stringify(payload)));
  return form.finish();
}
export async function extractEcoFormPayload(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const ref = pdf.context.trailerInfo.Info;
  const encoded = ref ? pdf.context.lookup(ref, PDFDict).get(payloadKey) : null;
  if (!(encoded instanceof PDFHexString)) throw new Error("אפשר לפתוח לעריכה רק טופס ECO שהופק במערכת");
  const payload: unknown = JSON.parse(encoded.decodeText());
  if (!isEcoFormPayload(payload)) throw new Error("נתוני טופס ECO אינם תקינים");
  return payload;
}
