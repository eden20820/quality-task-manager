import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFPage, rgb } from "pdf-lib";

import { isAdhesionLeakTestPayload, type AdhesionLeakTestPayload } from "./adhesion-leak-test";

const black = rgb(0, 0, 0);
const white = rgb(1, 1, 1);
const payloadKey = PDFName.of("QualityFormPayload");

function display(value: string) { return value.trim() || "N/A"; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}.${month}.${year}` : "N/A"; }
function yesNo(value: string) { return value === "yes" ? "כן" : value === "no" ? "לא" : "N/A"; }

function fitSize(font: PDFFont, text: string, maxWidth: number, preferred = 8.3, minimum = 5.8) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.2;
  return size;
}

function cover(page: PDFPage, x: number, top: number, width: number, height = 12) {
  page.drawRectangle({ x, y: page.getHeight() - top - height + 1, width, height, color: white });
}

function drawValue(page: PDFPage, font: PDFFont, value: string, options: { x: number; top: number; width: number; size?: number; align?: "left" | "center" | "right"; clear?: boolean }) {
  const text = display(value);
  const size = fitSize(font, text, options.width - 4, options.size ?? 8.3);
  if (options.clear) cover(page, options.x, options.top, options.width);
  const textWidth = font.widthOfTextAtSize(text, size);
  const align = options.align ?? "center";
  const x = align === "right" ? options.x + options.width - textWidth - 2 : align === "left" ? options.x + 2 : options.x + Math.max(2, (options.width - textWidth) / 2);
  page.drawText(text, { x, y: page.getHeight() - options.top - size, size, font, color: black });
}

function mark(page: PDFPage, font: PDFFont, active: boolean, x: number, top: number) {
  if (!active) return;
  page.drawText("X", { x, y: page.getHeight() - top - 8, size: 8.2, font, color: black });
}

function groupFallback(page: PDFPage, font: PDFFont, empty: boolean, x: number, top: number, width = 54) {
  if (empty) drawValue(page, font, "N/A", { x, top, width, size: 7.5 });
}

async function drawSignature(page: PDFPage, pdf: PDFDocument, dataUrl: string, x: number, top: number, width: number) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return;
  const image = await pdf.embedPng(Buffer.from(match[1], "base64"));
  const height = 9;
  const imageWidth = Math.min(width, height * image.width / image.height);
  page.drawImage(image, { x: x + (width - imageWidth) / 2, y: page.getHeight() - top - height, width: imageWidth, height });
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
  const [templateBytes, fontBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/templates/adhesion-leak-test-template.pdf")),
    readFile(path.join(process.cwd(), "public/fonts/DejaVuSans.ttf")),
  ]);
  const pdf = await PDFDocument.load(templateBytes);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const page = pdf.getPage(0);

  const firstRows: Array<[string, number]> = [
    [formatDate(payload.testDate), 103], [payload.testerName, 115.3], [payload.testLocation, 127.6],
    [payload.operationDescription, 139.9], [payload.testedProduct, 152.2], [payload.bondedProductMaterial, 164.5],
    [payload.bondingArea, 176.8], [payload.adheringProductMaterial, 189.1], [payload.seamAreaOrLength, 201.5],
    [payload.quantity, 213.7],
  ];
  firstRows.forEach(([value, top]) => drawValue(page, font, value, { x: 94, top, width: 235 }));

  drawValue(page, font, payload.adhesiveType, { x: 191, top: 252.4, width: 82, clear: true });
  drawValue(page, font, payload.adhesiveManufacturerModel, { x: 193, top: 264.2, width: 108, clear: true });
  drawValue(page, font, formatDate(payload.adhesiveExpiryDate), { x: 196, top: 276, width: 96, clear: true });
  mark(page, font, payload.curingMethod === "epoxy", 312, 303.5);
  mark(page, font, payload.curingMethod === "uv", 312, 319.5);
  groupFallback(page, font, payload.curingMethod === "", 180, 287.5);
  drawValue(page, font, payload.exposureTime, { x: 207, top: 331.6, width: 98, clear: true });
  drawValue(page, font, payload.waitingTime, { x: 136, top: 343.3, width: 116, clear: true });

  drawValue(page, font, payload.temperature, { x: 228, top: 355.7, width: 45, clear: true });
  drawValue(page, font, payload.humidity, { x: 219, top: 367.4, width: 104, clear: true });
  cover(page, 205, 378.8, 38);
  drawValue(page, font, yesNo(payload.underHood), { x: 202, top: 379.2, width: 42 });
  drawValue(page, font, payload.environmentNotes, { x: 226, top: 391.1, width: 98, clear: true });

  cover(page, 245, 423.2, 65);
  drawValue(page, font, "בדיקת וואקום", { x: 243, top: 423.3, width: 67, size: 7.7, align: "right" });
  mark(page, font, payload.testMethod === "air-pressure", 312, 407.4);
  mark(page, font, payload.testMethod === "vacuum", 312, 423.4);
  mark(page, font, payload.testMethod === "bubbles", 312, 439.4);
  mark(page, font, payload.testMethod === "dye-penetration", 312, 451.2);
  groupFallback(page, font, payload.testMethod === "", 146, 407.5);

  mark(page, font, payload.cracks === "yes", 312, 479.5);
  mark(page, font, payload.cracks === "no", 312, 495.5);
  groupFallback(page, font, payload.cracks === "", 238, 479.5, 48);
  mark(page, font, payload.bubbles === "yes", 312, 523.3);
  mark(page, font, payload.bubbles === "no", 312, 539.3);
  groupFallback(page, font, payload.bubbles === "", 238, 523.3, 48);
  mark(page, font, payload.materialSeparation === "yes", 312, 567);
  mark(page, font, payload.materialSeparation === "no", 312, 583);
  groupFallback(page, font, payload.materialSeparation === "", 238, 567, 48);

  mark(page, font, payload.leakObserved === "yes", 244, 599.2);
  mark(page, font, payload.leakObserved === "no", 219, 599.2);
  groupFallback(page, font, payload.leakObserved === "", 155, 599.2, 45);
  drawValue(page, font, payload.leakLocation, { x: 144, top: 611.2, width: 65, clear: true });
  drawValue(page, font, payload.findings, { x: 143, top: 623.1, width: 180, clear: true });

  mark(page, font, payload.decision === "pass", 312, 639.4);
  mark(page, font, payload.decision === "fail", 275, 639.4);
  mark(page, font, payload.decision === "repair", 223, 639.4);
  groupFallback(page, font, payload.decision === "", 54, 639.4, 48);

  drawValue(page, font, payload.checkedByName, { x: 326, top: 700.1, width: 92 });
  drawValue(page, font, formatDate(payload.checkedByDate), { x: 220, top: 700.1, width: 64 });
  drawValue(page, font, payload.approvedByName, { x: 326, top: 712.3, width: 92 });
  drawValue(page, font, formatDate(payload.approvedByDate), { x: 220, top: 712.3, width: 64 });
  if (payload.checkedBySignature) await drawSignature(page, pdf, payload.checkedBySignature, 104, 701.3, 92);
  else drawValue(page, font, "N/A", { x: 104, top: 700.1, width: 92 });
  if (payload.approvedBySignature) await drawSignature(page, pdf, payload.approvedBySignature, 104, 713.5, 92);
  else drawValue(page, font, "N/A", { x: 104, top: 712.3, width: 92 });

  pdf.setTitle("טופס בדיקת אטימות הדבקה");
  pdf.setSubject("נספח 8.4.2.4.0");
  storePayload(pdf, payload);
  return Buffer.from(await pdf.save());
}
