import { PDFDict, PDFDocument, PDFHexString, PDFName } from "pdf-lib";
import { DavidFormPdf, type FormCell } from "./david-form-pdf";
export { directionalTextLayout } from "./david-form-pdf";
import { isAdhesionLeakTestPayload, type AdhesionLeakTestPayload } from "./adhesion-leak-test";
const payloadKey = PDFName.of("QualityFormPayload");
function display(value: string) { return value.trim() || "N/A"; }
function formatDate(value: string) { const [y, m, d] = value.split("-"); return y && m && d ? `${d}.${m}.${y}` : "N/A"; }
export async function extractAdhesionLeakTestPayload(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const infoRef = pdf.context.trailerInfo.Info;
  if (!infoRef) throw new Error("הקובץ אינו טופס אטימות שנוצר במערכת");
  const info = pdf.context.lookup(infoRef, PDFDict);
  const encoded = info.get(payloadKey);
  if (!(encoded instanceof PDFHexString)) throw new Error("הקובץ אינו כולל נתונים שניתן לערוך");
  const payload: unknown = JSON.parse(encoded.decodeText());
  if (!isAdhesionLeakTestPayload(payload)) throw new Error("נתוני הטופס בקובץ אינם תקינים");
  return payload;
}


export async function buildAdhesionLeakTestPdf(payload: AdhesionLeakTestPayload) {
  const form = await DavidFormPdf.create("טופס בדיקת אטימות - הדבקה", "8.4.2.4.0");
  const field = (name: string, value: string): FormCell[] => [display(value), { text: name, bold: true, shade: true }];
  const fields = (rows: Array<[string, string]>) => form.table(rows.map(([name, value]) => field(name, value)), [65, 35]);
  const mark = (checked: boolean) => checked ? "[X]" : "[ ]";
  const yesNo = (value: string) => `${mark(value === "yes")} כן    ${mark(value === "no")} לא`;
  await fields([
    ["תאריך", formatDate(payload.testDate)], ["שם הבודק", payload.testerName], ["מיקום הבדיקה", payload.testLocation],
    ["תיאור הפעולה", payload.operationDescription], ["המוצר הנבדק", payload.testedProduct], ["חומר המוצר המודבק", payload.bondedProductMaterial],
    ["אזור ההדבקה", payload.bondingArea], ["חומר המוצר הנדבק", payload.adheringProductMaterial], ["שטח / אורך תפר ההדבקה", payload.seamAreaOrLength], ["כמות", payload.quantity],
  ]);
  await form.section("פרטי הדבק");
  await fields([["סוג הדבק", payload.adhesiveType], ["יצרן ודגם", payload.adhesiveManufacturerModel], ["תאריך תפוגה", formatDate(payload.adhesiveExpiryDate)],
    ["שיטת הקשיה", `${mark(payload.curingMethod === "epoxy")} אפוקסי    ${mark(payload.curingMethod === "uv")} UV`],
    ["זמן חשיפה", payload.exposureTime], ["זמן המתנה לפני בדיקה", payload.waitingTime]]);
  await form.section("תנאי סביבה");
  await fields([["טמפרטורה", payload.temperature], ["לחות", payload.humidity], ["עבודה תחת מנדף", yesNo(payload.underHood)], ["הערות", payload.environmentNotes]]);
  await form.section("שיטת בדיקת האטימות");
  const methods = [["בדיקת לחץ אוויר", "air-pressure"], ["בדיקת וואקום", "vacuum"], ["בדיקת בועות (מים/סבון)", "bubbles"], ["בדיקת חדירות צבע", "dye-penetration"]] as const;
  await form.table([[methods.map(([name, value]) => `${mark(payload.testMethod === value)} ${name}`).join("\n")]], [1]);
  await form.section("בדיקה ויזואלית");
  await fields([["סדקים", yesNo(payload.cracks)], ["בועות", yesNo(payload.bubbles)], ["היפרדות חומר", yesNo(payload.materialSeparation)]]);
  await form.section("תוצאות בדיקה");
  await fields([["נצפתה דליפה", yesNo(payload.leakObserved)], ["מיקום הדליפה", payload.leakLocation], ["ממצאים", payload.findings]]);
  await form.section("סיכום והחלטות");
  await form.table([[[
    `${mark(payload.decision === "pass")} תקין`, `${mark(payload.decision === "fail")} לא תקין`, `${mark(payload.decision === "repair")} נדרש תיקון ובדיקה חוזרת`,
  ].join("\n")]], [1]);
  await form.section("חתימות");
  await form.table([
    [{ text: "", image: payload.checkedBySignature }, formatDate(payload.checkedByDate), payload.checkedByName.trim(), "נבדק ע״י"],
    [{ text: "", image: payload.approvedBySignature }, formatDate(payload.approvedByDate), payload.approvedByName.trim(), "אושר ע״י"],
  ], [20, 24, 36, 20], ["חתימה", "תאריך", "שם", "אישור"]);
  form.pdf.context.lookup(form.pdf.context.trailerInfo.Info, PDFDict).set(payloadKey, PDFHexString.fromText(JSON.stringify(payload)));
  return form.finish();
}
