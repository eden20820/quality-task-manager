import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFPage, rgb } from "pdf-lib";

import { isAdhesionLeakTestPayload, type AdhesionLeakTestPayload } from "./adhesion-leak-test";

const black = rgb(0, 0, 0);
const gray = rgb(0.94, 0.94, 0.94);
const payloadKey = PDFName.of("QualityFormPayload");
const pageHeight = 841.89;

function display(value: string) { return value.trim() || "N/A"; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}.${month}.${year}` : "N/A"; }
function yesNo(value: string) { return value === "yes" ? "כן" : value === "no" ? "לא" : "N/A"; }

function fitSize(font: PDFFont, text: string, maxWidth: number, preferred = 8, minimum = 5.8) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.2;
  return size;
}

function drawText(page: PDFPage, font: PDFFont, value: string, options: { x: number; top: number; width: number; height?: number; size?: number; align?: "left" | "center" | "right"; bold?: boolean }) {
  const text = display(value);
  const size = fitSize(font, text, options.width - 6, options.size ?? 8);
  const height = options.height ?? 12;
  const textWidth = font.widthOfTextAtSize(text, size);
  const align = options.align ?? "center";
  const x = align === "right" ? options.x + options.width - textWidth - 3 : align === "left" ? options.x + 3 : options.x + (options.width - textWidth) / 2;
  const y = pageHeight - options.top - (height + size) / 2 + 1;
  page.drawText(text, { x, y, size, font, color: black });
  if (options.bold) page.drawText(text, { x: x + 0.22, y, size, font, color: black });
}

function rect(page: PDFPage, x: number, top: number, width: number, height: number, fill = false, borderWidth = 0.65) {
  page.drawRectangle({ x, y: pageHeight - top - height, width, height, color: fill ? gray : undefined, borderColor: black, borderWidth });
}

function line(page: PDFPage, x1: number, x2: number, top: number, thickness = 0.55) {
  page.drawLine({ start: { x: x1, y: pageHeight - top }, end: { x: x2, y: pageHeight - top }, thickness, color: black });
}

function checkbox(page: PDFPage, checked: boolean, x: number, top: number, size = 8) {
  rect(page, x, top, size, size, false, 0.7);
  if (!checked) return;
  const inset = 1.6;
  const yTop = pageHeight - top;
  page.drawLine({ start: { x: x + inset, y: yTop - inset }, end: { x: x + size - inset, y: yTop - size + inset }, thickness: 1, color: black });
  page.drawLine({ start: { x: x + inset, y: yTop - size + inset }, end: { x: x + size - inset, y: yTop - inset }, thickness: 1, color: black });
}

function fieldLine(page: PDFPage, font: PDFFont, top: number, label: string, value: string, options: { valueX?: number; valueWidth?: number; labelX?: number; labelWidth?: number } = {}) {
  const valueX = options.valueX ?? 92;
  const valueWidth = options.valueWidth ?? 132;
  const labelX = options.labelX ?? 224;
  const labelWidth = options.labelWidth ?? 94;
  drawText(page, font, label, { x: labelX, top: top - 0.8, width: labelWidth, height: 11, align: "right", size: 7.8 });
  drawText(page, font, value, { x: valueX, top: top - 0.8, width: valueWidth, height: 11, size: 7.8 });
  line(page, valueX + 4, valueX + valueWidth - 4, top + 10.5, 0.45);
}

function sectionTitle(page: PDFPage, font: PDFFont, top: number, height: number, title: string) {
  rect(page, 321, top, 200, height, true);
  drawText(page, font, title, { x: 329, top: top + 4, width: 184, height: 13, align: "right", size: 9, bold: true });
}

function choiceRow(page: PDFPage, font: PDFFont, top: number, label: string, checked: boolean, x = 305) {
  checkbox(page, checked, x, top + 2, 8);
  drawText(page, font, label, { x: 126, top, width: x - 134, height: 12, align: "right", size: 8 });
}

async function signature(page: PDFPage, pdf: PDFDocument, font: PDFFont, dataUrl: string, x: number, top: number, width: number, height: number) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) { drawText(page, font, "N/A", { x, top, width, height, size: 7.5 }); return; }
  const image = await pdf.embedPng(Buffer.from(match[1], "base64"));
  const imageHeight = Math.min(height - 3, 10);
  const imageWidth = Math.min(width - 8, imageHeight * image.width / image.height);
  page.drawImage(image, { x: x + (width - imageWidth) / 2, y: pageHeight - top - (height + imageHeight) / 2, width: imageWidth, height: imageHeight });
}

function storePayload(pdf: PDFDocument, payload: AdhesionLeakTestPayload) {
  const info = pdf.context.lookup(pdf.context.trailerInfo.Info, PDFDict);
  info.set(payloadKey, PDFHexString.fromText(JSON.stringify(payload)));
}

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
  const [fontBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/DejaVuSans.ttf")),
    readFile(path.join(process.cwd(), "public/caeli-logo.png")),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const logo = await pdf.embedPng(logoBytes);
  const page = pdf.addPage([595.28, pageHeight]);

  page.drawImage(logo, { x: 29, y: pageHeight - 68, width: 74, height: 52 });
  drawText(page, font, "טופס בדיקת אטימות - הדבקה", { x: 190, top: 68, width: 220, height: 20, size: 15, bold: true });
  line(page, 192, 408, 88, 0.9);

  const topRows: Array<[string, string]> = [
    ["תאריך", formatDate(payload.testDate)], ["שם הבודק", payload.testerName], ["מיקום הבדיקה", payload.testLocation],
    ["תיאור הפעולה", payload.operationDescription], ["המוצר הנבדק", payload.testedProduct], ["חומר המוצר המודבק", payload.bondedProductMaterial],
    ["אזור ההדבקה", payload.bondingArea], ["חומר המוצר הנדבק", payload.adheringProductMaterial], ["שטח / אורך תפר ההדבקה", payload.seamAreaOrLength], ["כמות", payload.quantity],
  ];
  topRows.forEach(([label, value], index) => {
    const top = 101 + index * 12.3;
    rect(page, 88, top, 233, 12.3);
    rect(page, 321, top, 200, 12.3, true);
    drawText(page, font, value, { x: 91, top, width: 227, height: 12.3, size: 7.5 });
    drawText(page, font, label, { x: 328, top, width: 186, height: 12.3, align: "right", size: 8, bold: true });
  });

  rect(page, 88, 252, 233, 104);
  sectionTitle(page, font, 252, 104, "פרטי הדבק");
  fieldLine(page, font, 254, "סוג הדבק", payload.adhesiveType);
  fieldLine(page, font, 267, "יצרן ודגם", payload.adhesiveManufacturerModel);
  fieldLine(page, font, 280, "תאריך תפוגה", formatDate(payload.adhesiveExpiryDate));
  drawText(page, font, "שיטת הקשיה", { x: 224, top: 293, width: 94, height: 12, align: "right", size: 7.8 });
  choiceRow(page, font, 307, "אפוקסי", payload.curingMethod === "epoxy");
  choiceRow(page, font, 320, "UV", payload.curingMethod === "uv");
  if (!payload.curingMethod) drawText(page, font, "N/A", { x: 94, top: 307, width: 65, height: 24, size: 7.5 });
  fieldLine(page, font, 333, "זמן חשיפה", payload.exposureTime);
  fieldLine(page, font, 342.5, "זמן המתנה לפני בדיקה", payload.waitingTime, { valueWidth: 116, labelX: 208, labelWidth: 110 });

  rect(page, 88, 356, 233, 48);
  sectionTitle(page, font, 356, 48, "תנאי סביבה");
  fieldLine(page, font, 357, "טמפרטורה", payload.temperature);
  fieldLine(page, font, 369, "לחות", payload.humidity);
  fieldLine(page, font, 381, "עבודה תחת מנדף", yesNo(payload.underHood), { valueWidth: 105, labelX: 197, labelWidth: 121 });
  fieldLine(page, font, 390.5, "הערות", payload.environmentNotes);

  rect(page, 88, 404, 233, 59);
  sectionTitle(page, font, 404, 59, "שיטת בדיקת האטימות");
  const methods = [
    ["בדיקת לחץ אוויר", "air-pressure"], ["בדיקת וואקום", "vacuum"],
    ["בדיקת בועות )מים/סבון(", "bubbles"], ["בדיקת חדירות צבע", "dye-penetration"],
  ] as const;
  methods.forEach(([label, value], index) => choiceRow(page, font, 407 + index * 13, label, payload.testMethod === value));
  if (!payload.testMethod) drawText(page, font, "N/A", { x: 94, top: 425, width: 55, height: 12, size: 7.5 });

  rect(page, 88, 463, 233, 60);
  sectionTitle(page, font, 463, 60, "בדיקה ויזואלית");
  const visualGroups = [
    ["סדקים", payload.cracks], ["בועות", payload.bubbles], ["היפרדות חומר", payload.materialSeparation],
  ] as const;
  visualGroups.forEach(([label, value], index) => {
    const top = 466 + index * 18;
    drawText(page, font, label, { x: 221, top, width: 96, height: 14, align: "right", size: 8 });
    checkbox(page, value === "yes", 190, top + 3, 8);
    drawText(page, font, "כן", { x: 166, top, width: 21, height: 14, align: "right", size: 7.5 });
    checkbox(page, value === "no", 137, top + 3, 8);
    drawText(page, font, "לא", { x: 113, top, width: 21, height: 14, align: "right", size: 7.5 });
    if (!value) drawText(page, font, "N/A", { x: 91, top, width: 25, height: 14, size: 6.8 });
  });

  rect(page, 88, 523, 233, 46);
  sectionTitle(page, font, 523, 46, "תוצאות בדיקה");
  drawText(page, font, "נצפתה דליפה", { x: 220, top: 524, width: 98, height: 12, align: "right", size: 7.8 });
  checkbox(page, payload.leakObserved === "yes", 197, 526, 8);
  drawText(page, font, "כן", { x: 176, top: 524, width: 20, height: 12, align: "right", size: 7.5 });
  checkbox(page, payload.leakObserved === "no", 147, 526, 8);
  drawText(page, font, "לא", { x: 126, top: 524, width: 20, height: 12, align: "right", size: 7.5 });
  if (!payload.leakObserved) drawText(page, font, "N/A", { x: 94, top: 524, width: 35, height: 12, size: 7 });
  fieldLine(page, font, 537.5, "מיקום הדליפה", payload.leakLocation, { valueWidth: 112, labelX: 204, labelWidth: 114 });
  fieldLine(page, font, 552, "ממצאים", payload.findings);

  rect(page, 88, 569, 233, 22);
  sectionTitle(page, font, 569, 22, "סיכום והחלטות");
  const decisions = [
    ["נדרש תיקון ובדיקה חוזרת", "repair", 94, 102, 198],
    ["לא תקין", "fail", 211, 45, 258],
    ["תקין", "pass", 271, 30, 303],
  ] as const;
  decisions.forEach(([label, value, x, width, boxX]) => {
    drawText(page, font, label, { x, top: 573, width, height: 12, align: "right", size: value === "repair" ? 6.3 : 6.8 });
    checkbox(page, payload.decision === value, boxX, 575, 8);
  });
  if (!payload.decision) drawText(page, font, "N/A", { x: 89, top: 573, width: 28, height: 12, size: 6.5 });

  rect(page, 88, 625, 433, 42);
  rect(page, 88, 625, 433, 13, true);
  drawText(page, font, "חתימות", { x: 88, top: 625, width: 433, height: 13, size: 9, bold: true });
  line(page, 88, 521, 652, 0.65);
  for (const x of [166, 284, 441]) page.drawLine({ start: { x, y: pageHeight - 638 }, end: { x, y: pageHeight - 667 }, thickness: 0.65, color: black });
  const signatureRows = [
    { top: 638, label: "נבדק ע״י", name: payload.checkedByName, date: formatDate(payload.checkedByDate), image: payload.checkedBySignature },
    { top: 652, label: "אושר ע״י", name: payload.approvedByName, date: formatDate(payload.approvedByDate), image: payload.approvedBySignature },
  ];
  for (const row of signatureRows) {
    drawText(page, font, row.label, { x: 441, top: row.top, width: 80, height: 14, align: "right", size: 7.5, bold: true });
    drawText(page, font, "שם", { x: 407, top: row.top, width: 28, height: 14, align: "right", size: 7 });
    drawText(page, font, ":", { x: 399, top: row.top, width: 8, height: 14, size: 7 });
    drawText(page, font, row.name, { x: 290, top: row.top, width: 108, height: 14, align: "right", size: 7 });
    drawText(page, font, "תאריך", { x: 245, top: row.top, width: 34, height: 14, align: "right", size: 7 });
    drawText(page, font, ":", { x: 237, top: row.top, width: 8, height: 14, size: 7 });
    drawText(page, font, row.date, { x: 168, top: row.top, width: 68, height: 14, align: "right", size: 7 });
    await signature(page, pdf, font, row.image, 88, row.top, 78, 14);
  }

  drawText(page, font, "8.4.2.4.0", { x: 88, top: 793, width: 58, height: 12, align: "left", size: 8, bold: true });
  drawText(page, font, "נספח", { x: 148, top: 793, width: 35, height: 12, align: "left", size: 8, bold: true });
  pdf.setTitle("טופס בדיקת אטימות הדבקה");
  pdf.setSubject("נספח 8.4.2.4.0");
  storePayload(pdf, payload);
  return Buffer.from(await pdf.save());
}
