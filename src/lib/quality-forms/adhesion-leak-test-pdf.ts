import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import bidiFactory from "bidi-js";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

import type { AdhesionLeakTestPayload } from "./adhesion-leak-test";

const bidi = bidiFactory();
const black = rgb(0, 0, 0);
const white = rgb(1, 1, 1);

function display(value: string) {
  return value.trim() || "N/A";
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : display(value);
}

function visualText(value: string) {
  const text = display(value);
  if (!/[\u0590-\u05ff]/.test(text)) return text;
  return bidi.getReorderedString(text, bidi.getEmbeddingLevels(text, "rtl"));
}

function fitSize(font: PDFFont, text: string, maxWidth: number, preferred = 8.3, minimum = 6.2) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.2;
  return size;
}

function drawValue(page: PDFPage, font: PDFFont, value: string, options: { x: number; top: number; width: number; size?: number; align?: "left" | "center"; clear?: boolean }) {
  const text = visualText(value);
  const size = fitSize(font, text, options.width, options.size ?? 8.3);
  if (options.clear) page.drawRectangle({ x: options.x - 2, y: page.getHeight() - options.top - 11, width: options.width + 4, height: 12, color: white });
  const textWidth = font.widthOfTextAtSize(text, size);
  const x = options.align === "left" ? options.x : options.x + Math.max(0, (options.width - textWidth) / 2);
  page.drawText(text, { x, y: page.getHeight() - options.top - size, size, font, color: black });
}

function mark(page: PDFPage, font: PDFFont, active: boolean, x: number, top: number) {
  if (!active) return;
  page.drawText("X", { x, y: page.getHeight() - top - 8.2, size: 8.2, font, color: black });
}

async function drawSignature(page: PDFPage, pdf: PDFDocument, dataUrl: string, top: number) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return;
  const image = await pdf.embedPng(Buffer.from(match[1], "base64"));
  const ratio = image.width / image.height;
  const height = 9;
  const width = Math.min(96, height * ratio);
  page.drawImage(image, { x: 103 + (96 - width) / 2, y: page.getHeight() - top - height, width, height });
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
  firstRows.forEach(([value, top]) => drawValue(page, font, value, { x: 94, top, width: 235, align: "center" }));

  drawValue(page, font, payload.adhesiveType, { x: 140, top: 252.4, width: 124, align: "center", clear: true });
  drawValue(page, font, payload.adhesiveManufacturerModel, { x: 140, top: 264.2, width: 148, align: "center", clear: true });
  drawValue(page, font, formatDate(payload.adhesiveExpiryDate), { x: 140, top: 276, width: 138, align: "center", clear: true });
  mark(page, font, payload.curingMethod === "epoxy", 313, 303.5);
  mark(page, font, payload.curingMethod === "uv", 313, 319.5);
  drawValue(page, font, payload.exposureTime, { x: 140, top: 331.6, width: 148, align: "center", clear: true });
  drawValue(page, font, payload.waitingTime, { x: 140, top: 343.3, width: 98, align: "center", clear: true });

  drawValue(page, font, payload.temperature, { x: 138, top: 355.7, width: 105, align: "center", clear: true });
  drawValue(page, font, payload.humidity, { x: 138, top: 367.4, width: 105, align: "center", clear: true });
  drawValue(page, font, payload.underHood === "yes" ? "כן" : payload.underHood === "no" ? "לא" : "", { x: 138, top: 379.2, width: 72, align: "center", clear: true });
  drawValue(page, font, payload.environmentNotes, { x: 140, top: 391.1, width: 78, align: "center", clear: true });

  mark(page, font, payload.testMethod === "air-pressure", 313, 407.4);
  mark(page, font, payload.testMethod === "vacuum", 313, 423.4);
  mark(page, font, payload.testMethod === "bubbles", 313, 439.4);
  mark(page, font, payload.testMethod === "dye-penetration", 313, 451.2);
  mark(page, font, payload.cracks === "yes", 313, 479.5);
  mark(page, font, payload.cracks === "no", 313, 495.5);
  mark(page, font, payload.bubbles === "yes", 313, 523.3);
  mark(page, font, payload.bubbles === "no", 313, 539.3);
  mark(page, font, payload.materialSeparation === "yes", 313, 567);
  mark(page, font, payload.materialSeparation === "no", 313, 583);
  mark(page, font, payload.leakObserved === "yes", 245, 599.2);
  mark(page, font, payload.leakObserved === "no", 220, 599.2);
  drawValue(page, font, payload.leakLocation, { x: 140, top: 611.2, width: 70, align: "center", clear: true });
  drawValue(page, font, payload.findings, { x: 140, top: 623.1, width: 100, align: "center", clear: true });
  mark(page, font, payload.decision === "pass", 313, 639.4);
  mark(page, font, payload.decision === "fail", 276, 639.4);
  mark(page, font, payload.decision === "repair", 224, 639.4);

  drawValue(page, font, payload.checkedByName, { x: 326, top: 700.1, width: 82, align: "center" });
  drawValue(page, font, formatDate(payload.checkedByDate), { x: 220, top: 700.1, width: 58, align: "center" });
  drawValue(page, font, payload.approvedByName, { x: 326, top: 712.3, width: 82, align: "center" });
  drawValue(page, font, formatDate(payload.approvedByDate), { x: 220, top: 712.3, width: 58, align: "center" });
  await drawSignature(page, pdf, payload.checkedBySignature, 701.3);
  await drawSignature(page, pdf, payload.approvedBySignature, 713.5);

  pdf.setTitle("טופס בדיקת אטימות הדבקה");
  pdf.setSubject("נספח 8.4.2.4.0");
  return Buffer.from(await pdf.save());
}
