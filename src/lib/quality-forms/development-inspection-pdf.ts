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
  const form = await DavidFormPdf.create("טופס ביקורת קבלה - מוצרי פיתוח", "8.4.2.3.2");
  const field = (name: string, value: string): FormCell[] => [value.trim(), { text: name, bold: true, shade: true }];
  const fields = (rows: Array<[string, string]>) => form.table(rows.map(([name, value]) => field(name, value)), [70, 30]);
  const mark = (checked: boolean) => checked ? "[X]" : "[ ]";
  const choices = (rows: Array<[string, boolean]>) => form.table([[rows.map(([text, checked]) => `${mark(checked)} ${text}`).join("\n")]], [1]);
  const products = getDevelopmentProducts(payload);
  await fields([["תאריך", formatDate(payload.date)], ["שם הספק", payload.supplierName]]);
  if (products.length === 1) {
    const p = products[0];
    await fields([["מק״ט", p.catalogNumber], ["תיאור פריט", p.itemDescription], ["מספר שרטוט", p.drawingNumber], ["גרסה", p.revision], ["כמות שהתקבלה", p.receivedQuantity], ["כמות שנבדקה", p.inspectedQuantity]]);
  } else {
    await form.section("מוצרים שהתקבלו");
    await form.table(products.map((p, i) => [p.inspectedQuantity, p.receivedQuantity, p.revision, p.drawingNumber, p.catalogNumber, p.itemDescription, String(i + 1)]), [60, 60, 40, 80, 75, 180, 28], ["כמות שנבדקה", "כמות שהתקבלה", "גרסה", "מספר שרטוט", "מק״ט", "תיאור פריט", "#"]);
  }
  await form.section("בדיקת מסמכים");
  await choices([["התקבל COC", payload.documents.coc], ["התקבל דו״ח בדיקה", payload.documents.inspectionReport], ["אין מסמכים נלווים", payload.documents.none]]);
  await form.section("בדיקות ויזואליות בסיסיות");
  await choices([["שלמות האריזה", payload.visualChecks.packageIntegrity], ["סימון/זיהוי", payload.visualChecks.marking], ["תוקף (אם רלוונטי)", payload.visualChecks.validity]]);
  await fields([["הערות", payload.visualNotes]]);
  await form.section("בדיקת התאמה לשרטוט / דרישה");
  await form.table(payload.drawingRows.map((r, i) => [r.conformity === "pass" ? "תקין" : r.conformity === "fail" ? "לא תקין" : "", r.actualResult, r.inspectionMethod, r.requirement, r.characteristic, String(i + 1)]), [65, 90, 85, 115, 140, 28], ["תקין/לא תקין", "תוצאה בפועל", "אמצעי בדיקה", "דרישה/טולרנס", "מאפיין שנבדק", "#"]);
  await choices([["תואם לדרישה ההנדסית", payload.generalConformity === "conforms"], ["קיים פער", payload.generalConformity === "gap"]]);
  await fields([["פרטי הפער", payload.gapDetails]]);
  await form.section("תיעוד חריגות");
  await form.table([[`נמצאה אי התאמה?  ${mark(payload.nonconformityFound === "yes")} כן   ${mark(payload.nonconformityFound === "no")} לא`]], [1]);
  await choices([["מאושר לשימוש בפיתוח למרות חריגה", payload.deviationActions.developmentUse], ["נדרש תיקון/עיבוד חוזר", payload.deviationActions.rework], ["להחזיר לספק", payload.deviationActions.returnToSupplier], ["נפתחה אי-התאמה", payload.deviationActions.nonconformityOpened]]);
  await fields([["מספר אי-התאמה", payload.nonconformityNumber]]);
  await form.section("סטטוס סופי");
  const statuses: Array<[string, DevelopmentInspectionPayload["finalStatus"]]> = [["מאושר לשימוש בפיתוח", "approved"], ["מאושר לשימוש בפיתוח בכפוף לחריגה מאושרת", "approved-deviation"], ["נדרש תיקון או עיבוד חוזר", "rework"], ["בהמתנה לבירור / On Hold", "on-hold"], ["נדרש שיפור תכן פנימי", "design-improvement"], ["אחר", "other"]];
  await choices(statuses.map(([text, status]) => [text, payload.finalStatus === status]));
  await fields([["פירוט שיפור תכן", payload.designImprovementDetails], ["פירוט אחר", payload.otherStatusDetails]]);
  await form.section("הצהרה");
  await form.table([["הפריט נבדק ואושר לשימוש במסגרת פעילויות פיתוח בלבד, בהתאם לסטטוס ולמגבלות המפורטים בטופס זה. אין באישור זה כדי להוות שחרור לייצור סדרתי, להתקנה במוצר משוחרר, למסירה ללקוח או לשימוש מבצעי."]], [1]);
  await form.section("חתימות");
  await form.table([
    [{ text: "", image: payload.checkedBySignature }, formatDate(payload.checkedByDate), payload.checkedByName, "נבדק ע״י"],
    [{ text: "", image: payload.approvedBySignature }, formatDate(payload.approvedByDate), payload.approvedByName, "אושר ע״י"],
  ], [20, 24, 36, 20], ["חתימה", "תאריך", "שם", "אישור"]);
  form.pdf.context.lookup(form.pdf.context.trailerInfo.Info, PDFDict).set(payloadKey, PDFHexString.fromText(JSON.stringify(payload)));
  return form.finish();
}
