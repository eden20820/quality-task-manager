import { PDFDict, PDFDocument, PDFHexString, PDFName } from "pdf-lib";
import { DavidFormPdf, directionalTextLayout, type FormCell } from "./david-form-pdf";
import { getDevelopmentProducts, isDevelopmentInspectionPayload, type DevelopmentInspectionPayload } from "./development-inspection";
const payloadKey = PDFName.of("DevelopmentInspectionPayload");
export function developmentPdfTextLayout(value: string) {
  const layout = directionalTextLayout(value);
  return { ...layout, runs: layout.runs.map(run => ({ ...run, text: run.direction === "rtl" ? run.text.replace(/[()]/g, character => character === "(" ? ")" : "(") : run.text })) };
}
function formatDate(value: string) { const [y, m, d] = value.split("-"); return y && m && d ? `${d}.${m}.${y}` : ""; }
export async function extractDevelopmentInspectionPayload(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes); const infoRef = pdf.context.trailerInfo.Info;
  if (!infoRef) throw new Error("הקובץ אינו טופס ביקורת מוצרי פיתוח שנוצר במערכת");
  const encoded = pdf.context.lookup(infoRef, PDFDict).get(payloadKey);
  if (!(encoded instanceof PDFHexString)) throw new Error("הקובץ אינו כולל נתונים שניתן לערוך");
  const payload: unknown = JSON.parse(encoded.decodeText());
  if (!isDevelopmentInspectionPayload(payload)) throw new Error("נתוני הטופס בקובץ אינם תקינים");
  return payload;
}


export async function buildDevelopmentInspectionPdf(payload: DevelopmentInspectionPayload) {
  const form = await DavidFormPdf.create("טופס ביקורת קבלה - מוצרי פיתוח", "8.4.2.3.2", { titleSize: 19, tableWidth: 475, compactRows: true });
  const mark = (checked: boolean) => checked ? "[X]" : "[ ]";
  const label = (text: string): FormCell => ({ text, bold: true, shade: true, align: "right" });
  const pair = (a: [string, string], b: [string, string]): FormCell[] => [b[1].trim(), label(b[0]), a[1].trim(), label(a[0])];
  const choices = (items: Array<[string, boolean]>) => items.map(([text, checked]) => mark(checked) + " " + text).join("    ");
  const products = getDevelopmentProducts(payload);
  await form.table([pair(["שם הספק", payload.supplierName], ["תאריך", formatDate(payload.date)])], [23, 17, 43, 17]);
  if (products.length === 1) {
    const p = products[0];
    await form.table([
      pair(["תיאור פריט", p.itemDescription], ["מק״ט", p.catalogNumber]),
      pair(["מספר שרטוט", p.drawingNumber], ["גרסה", p.revision]),
    ], [23, 17, 43, 17]);
    await form.table([[{ text: "כמות שנבדקה: " + p.inspectedQuantity, align: "right" }, { text: "כמות שהתקבלה: " + p.receivedQuantity, align: "right" }]], [1, 1]);
  } else {
    await form.section("מוצרים שהתקבלו");
    await form.table(products.map((p, i) => [p.inspectedQuantity, p.receivedQuantity, p.revision, p.drawingNumber, p.catalogNumber, p.itemDescription, String(i + 1)]), [62, 68, 46, 72, 73, 124, 30], ["כמות שנבדקה", "כמות שהתקבלה", "גרסה", "מספר שרטוט", "מק״ט", "תיאור פריט", "#"]);
  }
  form.gap(5);
  await form.table([
    [{ text: choices([["התקבל COC", payload.documents.coc], ["התקבל דו״ח בדיקה", payload.documents.inspectionReport], ["אין מסמכים נלווים", payload.documents.none]]), align: "right" }, label("בדיקת מסמכים")],
    [{ text: choices([["שלמות האריזה", payload.visualChecks.packageIntegrity], ["סימון/זיהוי", payload.visualChecks.marking], ["תוקף (אם רלוונטי)", payload.visualChecks.validity]]), align: "right" }, label("בדיקה ויזואלית")],
    [{ text: payload.visualNotes, align: "right" }, label("הערות")],
  ], [78, 22]);
  await form.section("בדיקת התאמה לשרטוט / דרישה");
  await form.table(payload.drawingRows.map((r, i) => [r.conformity === "pass" ? "תקין" : r.conformity === "fail" ? "לא תקין" : "", r.actualResult, r.inspectionMethod, r.requirement, r.characteristic, String(i + 1)]), [65, 90, 85, 115, 140, 28], ["תקין/לא תקין", "תוצאה בפועל", "אמצעי בדיקה", "דרישה/טולרנס", "מאפיין שנבדק", "#"]);
  await form.table([
    [{ text: choices([["תואם לדרישה ההנדסית", payload.generalConformity === "conforms"], ["קיים פער", payload.generalConformity === "gap"]]), align: "right" }],
    [{ text: "פרטי הפער: " + payload.gapDetails, align: "right" }],
  ], [1]);
  form.gap(5);
  const statuses: Array<[string, DevelopmentInspectionPayload["finalStatus"]]> = [["מאושר לשימוש בפיתוח", "approved"], ["מאושר לשימוש בפיתוח בכפוף לחריגה מאושרת", "approved-deviation"], ["נדרש תיקון או עיבוד חוזר", "rework"], ["בהמתנה לבירור / On Hold", "on-hold"], ["נדרש שיפור תכן פנימי", "design-improvement"], ["אחר", "other"]];
  await form.table([[label("סטטוס סופי"), label("תיעוד חריגות")]], [1, 1]);
  const deviations = [
    "נמצאה אי התאמה? " + choices([["כן", payload.nonconformityFound === "yes"], ["לא", payload.nonconformityFound === "no"]]),
    ...([["מאושר לשימוש בפיתוח למרות חריגה", payload.deviationActions.developmentUse], ["נדרש תיקון/עיבוד חוזר", payload.deviationActions.rework], ["להחזיר לספק", payload.deviationActions.returnToSupplier], ["נפתחה אי-התאמה", payload.deviationActions.nonconformityOpened]] as Array<[string, boolean]>).map(item => choices([item])),
    "מספר אי-התאמה: " + payload.nonconformityNumber,
  ].join("\n");
  await form.table([[{ text: statuses.map(([text, status]) => choices([[text, payload.finalStatus === status]])).join("\n"), align: "right" }, { text: deviations, align: "right" }]], [1, 1]);
  await form.table([[{ text: "פירוט אחר: " + payload.otherStatusDetails, align: "right" }, { text: "פירוט שיפור תכן: " + payload.designImprovementDetails, align: "right" }]], [1, 1]);
  await form.section("הצהרה");
  await form.table([[{ text: "הפריט נבדק ואושר לשימוש במסגרת פעילויות פיתוח בלבד, בהתאם לסטטוס ולמגבלות המפורטים בטופס זה. אין באישור זה כדי להוות שחרור לייצור סדרתי, להתקנה במוצר משוחרר, למסירה ללקוח או לשימוש מבצעי.", align: "right" }]], [1]);
  form.ensureSpace(90);
  await form.section("חתימות");
  await form.table([
    [{ text: "", image: payload.checkedBySignature }, formatDate(payload.checkedByDate), payload.checkedByName, "נבדק ע״י"],
    [{ text: "", image: payload.approvedBySignature }, formatDate(payload.approvedByDate), payload.approvedByName, "אושר ע״י"],
  ], [20, 24, 36, 20], ["חתימה", "תאריך", "שם", "אישור"]);
  form.pdf.context.lookup(form.pdf.context.trailerInfo.Info, PDFDict).set(payloadKey, PDFHexString.fromText(JSON.stringify(payload)));
  return form.finish();
}
