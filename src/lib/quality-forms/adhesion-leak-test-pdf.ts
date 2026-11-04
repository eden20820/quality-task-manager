import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFPage, rgb } from "pdf-lib";

import { isAdhesionLeakTestPayload, type AdhesionLeakTestPayload } from "./adhesion-leak-test";

const black = rgb(0, 0, 0);
const gray = rgb(0.94, 0.94, 0.94);
const payloadKey = PDFName.of("QualityFormPayload");

function display(value: string) { return value.trim() || "N/A"; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}.${month}.${year}` : "N/A"; }
function yesNo(value: string) { return value === "yes" ? "כן" : value === "no" ? "לא" : "N/A"; }
function option(value: string, labels: Record<string, string>) { return labels[value] ?? "N/A"; }

function fitSize(font: PDFFont, text: string, maxWidth: number, preferred = 8, minimum = 5.7) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.2;
  return size;
}

function drawText(page: PDFPage, font: PDFFont, value: string, x: number, y: number, width: number, options: { align?: "left" | "center" | "right"; size?: number } = {}) {
  const text = display(value);
  const size = fitSize(font, text, width - 8, options.size ?? 8);
  const textWidth = font.widthOfTextAtSize(text, size);
  const align = options.align ?? "center";
  const textX = align === "right" ? x + width - textWidth - 4 : align === "left" ? x + 4 : x + Math.max(4, (width - textWidth) / 2);
  page.drawText(text, { x: textX, y: y + 4.1, size, font, color: black });
}

function drawCell(page: PDFPage, font: PDFFont, value: string, x: number, y: number, width: number, height: number, options: { fill?: boolean; align?: "left" | "center" | "right"; size?: number } = {}) {
  page.drawRectangle({ x, y, width, height, borderColor: black, borderWidth: 0.75, color: options.fill ? gray : undefined });
  drawText(page, font, value, x, y + Math.max(0, (height - 14) / 2), width, { align: options.align, size: options.size });
}

function drawRow(page: PDFPage, font: PDFFont, y: number, label: string, value: string, height = 18) {
  drawCell(page, font, label, 365, y, 180, height, { fill: true, align: "right" });
  drawCell(page, font, value, 50, y, 315, height);
}

function drawSectionRow(page: PDFPage, font: PDFFont, y: number, section: string, label: string, value: string, height = 18) {
  drawCell(page, font, section, 445, y, 100, height, { fill: true, align: "right" });
  drawCell(page, font, label, 285, y, 160, height, { fill: true, align: "right" });
  drawCell(page, font, value, 50, y, 235, height);
}

async function drawSignature(page: PDFPage, pdf: PDFDocument, dataUrl: string, x: number, y: number, width: number, height: number, font: PDFFont) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) { drawText(page, font, "N/A", x, y + (height - 14) / 2, width); return; }
  const image = await pdf.embedPng(Buffer.from(match[1], "base64"));
  const ratio = image.width / image.height;
  const imageHeight = Math.min(height - 4, 18);
  const imageWidth = Math.min(width - 8, imageHeight * ratio);
  page.drawImage(image, { x: x + (width - imageWidth) / 2, y: y + (height - imageHeight) / 2, width: imageWidth, height: imageHeight });
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
  const page = pdf.addPage([595.28, 841.89]);

  page.drawImage(logo, { x: 36, y: 775, width: 78, height: 50 });
  drawText(page, font, "טופס בדיקת אטימות הדבקה", 150, 787, 395, { size: 15 });
  page.drawLine({ start: { x: 230, y: 786 }, end: { x: 465, y: 786 }, thickness: 0.8, color: black });

  let y = 758;
  const firstRows: Array<[string, string]> = [
    ["תאריך", formatDate(payload.testDate)], ["שם הבודק", payload.testerName], ["מיקום הבדיקה", payload.testLocation],
    ["תיאור הפעולה", payload.operationDescription], ["המוצר הנבדק", payload.testedProduct], ["חומר המוצר המודבק", payload.bondedProductMaterial],
    ["אזור ההדבקה", payload.bondingArea], ["חומר המוצר הנדבק", payload.adheringProductMaterial], ["שטח / אורך תפר ההדבקה", payload.seamAreaOrLength], ["כמות", payload.quantity],
  ];
  for (const [label, value] of firstRows) { y -= 17; drawRow(page, font, y, label, value, 17); }

  y -= 10;
  const method = option(payload.curingMethod, { epoxy: "אפוקסי", uv: "UV" });
  const testMethod = option(payload.testMethod, { "air-pressure": "בדיקת לחץ אוויר", vacuum: "בדיקת וואקום", bubbles: "בדיקת בועות (מים / סבון)", "dye-penetration": "בדיקת חדירות צבע" });
  const decision = option(payload.decision, { pass: "תקין", fail: "לא תקין", repair: "נדרש תיקון ובדיקה חוזרת" });
  const rows: Array<[string, string, string]> = [
    ["פרטי הדבק", "סוג הדבק", payload.adhesiveType], ["פרטי הדבק", "יצרן ודגם", payload.adhesiveManufacturerModel],
    ["פרטי הדבק", "תאריך תפוגה", formatDate(payload.adhesiveExpiryDate)], ["פרטי הדבק", "שיטת הקשיה", method],
    ["פרטי הדבק", "זמן חשיפה", payload.exposureTime], ["פרטי הדבק", "זמן המתנה לפני בדיקה", payload.waitingTime],
    ["תנאי סביבה", "טמפרטורה", payload.temperature], ["תנאי סביבה", "לחות", payload.humidity],
    ["תנאי סביבה", "עבודה תחת מנדף", yesNo(payload.underHood)], ["תנאי סביבה", "הערות", payload.environmentNotes],
    ["שיטת בדיקה", "שיטת בדיקת האטימות", testMethod], ["בדיקה ויזואלית", "סדקים", yesNo(payload.cracks)],
    ["בדיקה ויזואלית", "בועות", yesNo(payload.bubbles)], ["בדיקה ויזואלית", "היפרדות חומר", yesNo(payload.materialSeparation)],
    ["תוצאות בדיקה", "נצפתה דליפה", yesNo(payload.leakObserved)], ["תוצאות בדיקה", "מיקום הדליפה", payload.leakLocation],
    ["תוצאות בדיקה", "ממצאים", payload.findings], ["סיכום והחלטות", "החלטה", decision],
  ];
  for (const [section, label, value] of rows) { y -= 17; drawSectionRow(page, font, y, section, label, value, 17); }

  y -= 22;
  drawCell(page, font, "חתימה", 50, y, 110, 18, { fill: true });
  drawCell(page, font, "תאריך", 160, y, 105, 18, { fill: true });
  drawCell(page, font, "שם", 265, y, 170, 18, { fill: true });
  drawCell(page, font, "אישור", 435, y, 110, 18, { fill: true });
  y -= 24;
  for (const row of [
    [payload.checkedBySignature, formatDate(payload.checkedByDate), payload.checkedByName, "נבדק על ידי"],
    [payload.approvedBySignature, formatDate(payload.approvedByDate), payload.approvedByName, "אושר על ידי"],
  ] as const) {
    page.drawRectangle({ x: 50, y, width: 110, height: 24, borderColor: black, borderWidth: 0.75 });
    await drawSignature(page, pdf, row[0], 50, y, 110, 24, font);
    drawCell(page, font, row[1], 160, y, 105, 24);
    drawCell(page, font, row[2], 265, y, 170, 24);
    drawCell(page, font, row[3], 435, y, 110, 24, { fill: true, align: "right" });
    y -= 24;
  }

  drawText(page, font, "נספח", 38, 17, 44, { align: "left", size: 8 });
  drawText(page, font, "8.4.2.4.0", 78, 17, 66, { align: "left", size: 8 });
  pdf.setTitle("טופס בדיקת אטימות הדבקה");
  pdf.setSubject("נספח 8.4.2.4.0");
  storePayload(pdf, payload);
  return Buffer.from(await pdf.save());
}
