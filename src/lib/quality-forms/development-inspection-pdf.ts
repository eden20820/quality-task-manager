import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFPage, rgb } from "pdf-lib";

import { directionalTextLayout } from "./adhesion-leak-test-pdf";
import { getDevelopmentProducts, isDevelopmentInspectionPayload, type DevelopmentInspectionPayload, type DevelopmentInspectionProduct } from "./development-inspection";

const black = rgb(0, 0, 0);
const gray = rgb(0.94, 0.94, 0.94);
const pageHeight = 841.89;
const payloadKey = PDFName.of("DevelopmentInspectionPayload");
type FormFonts = { regular: PDFFont; bold: PDFFont };

function display(value: string) { return value.trim(); }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}.${month}.${year}` : ""; }
// Fontkit reverses RTL glyph order but does not mirror paired punctuation.
// Mirror only RTL runs for painting; editable payload values stay untouched.
export function developmentPdfTextLayout(value: string) {
  const layout = directionalTextLayout(value);
  return { ...layout, runs: layout.runs.map((run) => ({ ...run, text: run.direction === "rtl" ? run.text.replace(/[()]/g, (character) => character === "(" ? ")" : "(") : run.text })) };
}
function fitSize(font: PDFFont, text: string, width: number, preferred = 7.4, minimum = 5.2) { let size = preferred; while (size > minimum && font.widthOfTextAtSize(text, size) > width) size -= 0.2; return size; }

function drawText(page: PDFPage, fonts: FormFonts, value: string, options: { x: number; top: number; width: number; height?: number; size?: number; align?: "left" | "center" | "right"; bold?: boolean; empty?: "na" | "blank" }) {
  const font = options.bold ? fonts.bold : fonts.regular;
  const text = options.empty === "blank" ? value.trim() : display(value);
  if (!text) return;
  const size = fitSize(font, text, options.width - 5, options.size ?? 7.4);
  const textWidth = font.widthOfTextAtSize(text, size);
  const align = options.align ?? "center";
  const x = align === "right" ? options.x + options.width - textWidth - 2.5 : align === "left" ? options.x + 2.5 : options.x + (options.width - textWidth) / 2;
  const y = pageHeight - options.top - ((options.height ?? 12) + size) / 2 + 1;
  const layout = developmentPdfTextLayout(text);
  const paint = (offset: number) => {
    if (layout.runs.length <= 1) return page.drawText(layout.runs[0]?.text ?? text, { x: x + offset, y, size, font, color: black });
    let cursor = layout.baseDirection === "rtl" ? x + textWidth : x;
    for (const run of layout.runs) {
      const runWidth = font.widthOfTextAtSize(run.text, size);
      const runX = layout.baseDirection === "rtl" ? cursor - runWidth : cursor;
      page.drawText(run.text, { x: runX + offset, y, size, font, color: black });
      cursor += layout.baseDirection === "rtl" ? -runWidth : runWidth;
    }
  };
  paint(0);
}

function rect(page: PDFPage, x: number, top: number, width: number, height: number, fill = false, borderWidth = 0.65) { page.drawRectangle({ x, y: pageHeight - top - height, width, height, color: fill ? gray : undefined, borderColor: black, borderWidth }); }
function line(page: PDFPage, x1: number, x2: number, top: number, thickness = 0.55) { page.drawLine({ start: { x: x1, y: pageHeight - top }, end: { x: x2, y: pageHeight - top }, thickness, color: black }); }
function checkbox(page: PDFPage, checked: boolean, x: number, top: number, size = 7.5) { rect(page, x, top, size, size, false, 0.65); if (!checked) return; const y = pageHeight - top; page.drawLine({ start: { x: x + 1.4, y: y - 1.4 }, end: { x: x + size - 1.4, y: y - size + 1.4 }, thickness: 0.9, color: black }); page.drawLine({ start: { x: x + 1.4, y: y - size + 1.4 }, end: { x: x + size - 1.4, y: y - 1.4 }, thickness: 0.9, color: black }); }
function choice(page: PDFPage, font: FormFonts, label: string, checked: boolean, x: number, top: number, width: number, size = 7.2) { checkbox(page, checked, x + width - 8, top + 1, 7); drawText(page, font, label, { x, top, width: width - 11, height: 10, align: "right", size, empty: "blank" }); }
function sectionTitle(page: PDFPage, font: FormFonts, title: string, top: number, height: number) { rect(page, 391, top, 130, height, true); drawText(page, font, title, { x: 397, top: top + (height - 14) / 2, width: 118, height: 14, align: "right", size: 8.5, bold: true }); }

async function signature(page: PDFPage, pdf: PDFDocument, dataUrl: string, x: number, top: number, width: number, height: number) { const match = dataUrl.match(/^data:image\/png;base64,(.+)$/); if (!match) return; const image = await pdf.embedPng(Buffer.from(match[1], "base64")); const imageHeight = Math.min(height - 3, 11); const imageWidth = Math.min(width - 6, imageHeight * image.width / image.height); page.drawImage(image, { x: x + (width - imageWidth) / 2, y: pageHeight - top - (height + imageHeight) / 2, width: imageWidth, height: imageHeight }); }
function storePayload(pdf: PDFDocument, payload: DevelopmentInspectionPayload) { const info = pdf.context.lookup(pdf.context.trailerInfo.Info, PDFDict); info.set(payloadKey, PDFHexString.fromText(JSON.stringify(payload))); }

function productTable(page: PDFPage, font: FormFonts, products: DevelopmentInspectionProduct[], top: number, firstIndex = 0) {
  const widths = [45, 45, 35, 72, 65, 145, 26];
  const headers = ["נבדקה", "התקבלה", "גרסה", "מספר שרטוט", "מק״ט", "תיאור פריט", "#"];
  let x = 88;
  headers.forEach((label, index) => {
    rect(page, x, top, widths[index], 18, true);
    drawText(page, font, label, { x, top, width: widths[index], height: 18, size: 7, bold: true });
    x += widths[index];
  });
  products.forEach((product, index) => {
    const rowTop = top + 18 + index * 18;
    const values = [product.inspectedQuantity, product.receivedQuantity, product.revision, product.drawingNumber, product.catalogNumber, product.itemDescription, String(firstIndex + index + 1)];
    let cellX = 88;
    values.forEach((value, column) => {
      rect(page, cellX, rowTop, widths[column], 18);
      drawText(page, font, value, { x: cellX, top: rowTop, width: widths[column], height: 18, size: 7 });
      cellX += widths[column];
    });
  });
}

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
  const [fontBytes, boldFontBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/David.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/David-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/caeli-logo.png")),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font: FormFonts = { regular: await pdf.embedFont(fontBytes, { subset: true }), bold: await pdf.embedFont(boldFontBytes, { subset: true }) };
  const logo = await pdf.embedPng(logoBytes); const page = pdf.addPage([595.28, pageHeight]);
  page.drawImage(logo, { x: 28, y: pageHeight - 67, width: 74, height: 52 });
  drawText(page, font, "טופס ביקורת קבלה - מוצרי פיתוח", { x: 170, top: 65, width: 270, height: 21, size: 14.5, bold: true }); line(page, 177, 432, 87, 0.9);

  const products = getDevelopmentProducts(payload);
  const firstProduct = products[0];
  const headerRows: Array<[string, string]> = [["תאריך", formatDate(payload.date)], ["שם הספק", payload.supplierName], ...(products.length === 1 ? [["מק״ט", firstProduct.catalogNumber], ["תיאור פריט", firstProduct.itemDescription], ["מספר שרטוט", firstProduct.drawingNumber], ["גרסה", firstProduct.revision], ["כמות שהתקבלה", firstProduct.receivedQuantity], ["כמות שנבדקה", firstProduct.inspectedQuantity]] as Array<[string, string]> : [])];
  headerRows.forEach(([label, value], index) => { const top = 100 + index * 13; rect(page, 88, top, 307, 13); rect(page, 395, top, 126, 13, true); drawText(page, font, value, { x: 91, top, width: 301, height: 13, size: 7.3 }); drawText(page, font, label, { x: 401, top, width: 114, height: 13, align: "right", size: 8, bold: true }); });
  if (products.length > 1) {
    productTable(page, font, products.slice(0, 3), 130);
    if (products.length > 3) drawText(page, font, "יתר המוצרים מופיעים בעמודי ההמשך; הבדיקות והאישור משותפים לכל המוצרים בטופס", { x: 88, top: 205, width: 433, height: 12, size: 6.5 });
  }

  rect(page, 88, 220, 303, 49); sectionTitle(page, font, "בדיקת מסמכים", 220, 49);
  choice(page, font, "התקבל COC", payload.documents.coc, 210, 224, 170); choice(page, font, "התקבל דו״ח בדיקה", payload.documents.inspectionReport, 210, 238, 170); choice(page, font, "אין מסמכים נלווים", payload.documents.none, 210, 252, 170);
  rect(page, 88, 269, 303, 64); sectionTitle(page, font, "בדיקות ויזואליות בסיסיות", 269, 64);
  choice(page, font, "שלמות האריזה", payload.visualChecks.packageIntegrity, 210, 273, 170); choice(page, font, "סימון/זיהוי", payload.visualChecks.marking, 210, 287, 170); choice(page, font, "תוקף (אם רלוונטי)", payload.visualChecks.validity, 210, 301, 170); drawText(page, font, "הערות", { x: 320, top: 316, width: 60, height: 11, align: "right", size: 7.3 }); drawText(page, font, payload.visualNotes, { x: 94, top: 316, width: 220, height: 11, size: 7.1 }); line(page, 96, 314, 327, 0.4);

  rect(page, 88, 333, 303, 130); sectionTitle(page, font, "בדיקת התאמה לשרטוט / דרישה", 333, 130);
  const tableX = 94, tableTop = 338, widths = [58, 58, 60, 58, 59], headers = ["תקין/לא תקין", "תוצאה בפועל", "אמצעי בדיקה", "דרישה/טולרנס", "מאפיין שנבדק"];
  let x = tableX; headers.forEach((header, index) => { rect(page, x, tableTop, widths[index], 18, true); drawText(page, font, header, { x, top: tableTop, width: widths[index], height: 18, size: 5.8, bold: true }); x += widths[index]; });
  payload.drawingRows.slice(0, 3).forEach((row, rowIndex) => { const top = tableTop + 18 + rowIndex * 15; const values = [row.conformity === "pass" ? "תקין" : row.conformity === "fail" ? "לא תקין" : "", row.actualResult, row.inspectionMethod, row.requirement, row.characteristic]; let cellX = tableX; values.forEach((value, index) => { rect(page, cellX, top, widths[index], 15); drawText(page, font, value, { x: cellX + 1, top, width: widths[index] - 2, height: 15, size: 5.9, empty: index === 0 ? "blank" : "na" }); cellX += widths[index]; }); });
  if (payload.drawingRows.length > 3) drawText(page, font, "יתר שורות הבדיקה מופיעות בעמודי ההמשך", { x: 94, top: 448, width: 289, height: 11, size: 7, bold: true });
  drawText(page, font, "בדיקת התאמה כללית", { x: 240, top: 403, width: 140, height: 12, align: "right", size: 7.7, bold: true });
  choice(page, font, "תואם לדרישה ההנדסית", payload.generalConformity === "conforms", 197, 416, 183); choice(page, font, "קיים פער, פרט", payload.generalConformity === "gap", 254, 431, 126); drawText(page, font, payload.gapDetails, { x: 98, top: 431, width: 150, height: 11, size: 6.8 }); line(page, 100, 248, 442, 0.4);

  rect(page, 88, 463, 303, 88); sectionTitle(page, font, "תיעוד חריגות", 463, 88);
  drawText(page, font, "נמצאה אי התאמה?", { x: 250, top: 467, width: 130, height: 12, align: "right", size: 7.5, bold: true }); choice(page, font, "כן", payload.nonconformityFound === "yes", 205, 467, 42); choice(page, font, "לא", payload.nonconformityFound === "no", 160, 467, 42);
  choice(page, font, "מאושר לשימוש בפיתוח למרות חריגה", payload.deviationActions.developmentUse, 170, 482, 210); choice(page, font, "נדרש תיקון/עיבוד חוזר", payload.deviationActions.rework, 205, 497, 175); choice(page, font, "להחזיר לספק", payload.deviationActions.returnToSupplier, 245, 512, 135); choice(page, font, "נפתחה אי-התאמה מספר", payload.deviationActions.nonconformityOpened, 225, 527, 155); drawText(page, font, payload.nonconformityNumber, { x: 98, top: 527, width: 122, height: 11, size: 6.9 }); line(page, 100, 220, 538, 0.4);

  rect(page, 88, 551, 303, 104); sectionTitle(page, font, "סטטוס סופי", 551, 104);
  const statuses: Array<[string, DevelopmentInspectionPayload["finalStatus"]]> = [["מאושר לשימוש בפיתוח", "approved"], ["מאושר לשימוש בפיתוח בכפוף לחריגה מאושרת", "approved-deviation"], ["נדרש תיקון או עיבוד חוזר", "rework"], ["בהמתנה לבירור / On Hold", "on-hold"], ["נדרש שיפור תכן פנימי", "design-improvement"], ["אחר", "other"]];
  statuses.forEach(([label, value], index) => choice(page, font, label, payload.finalStatus === value, 170, 555 + index * 15, 210, index === 1 ? 6.3 : 7.1));
  drawText(page, font, payload.designImprovementDetails, { x: 98, top: 615, width: 68, height: 11, size: 6.3 }); line(page, 99, 165, 626, 0.4); drawText(page, font, payload.otherStatusDetails, { x: 98, top: 630, width: 68, height: 11, size: 6.3 }); line(page, 99, 165, 641, 0.4);

  const declaration = "הצהרה: הפריט נבדק ואושר לשימוש במסגרת פעילויות פיתוח בלבד, בהתאם לסטטוס ולמגבלות המפורטים בטופס זה. אין באישור זה כדי להוות שחרור לייצור סדרתי, להתקנה במוצר משוחרר, למסירה ללקוח או לשימוש מבצעי.";
  drawText(page, font, declaration, { x: 92, top: 662, width: 425, height: 22, size: 6.2, bold: true });

  rect(page, 88, 694, 433, 51); rect(page, 88, 694, 433, 13, true); drawText(page, font, "חתימות", { x: 88, top: 694, width: 433, height: 13, size: 8.5, bold: true }); line(page, 88, 521, 726, 0.65); for (const cellX of [166, 274, 425]) page.drawLine({ start: { x: cellX, y: pageHeight - 707 }, end: { x: cellX, y: pageHeight - 745 }, thickness: 0.65, color: black });
  const signatureRows = [{ top: 707, role: "נבדק ע״י", name: payload.checkedByName, date: formatDate(payload.checkedByDate), image: payload.checkedBySignature }, { top: 726, role: "אושר ע״י", name: payload.approvedByName, date: formatDate(payload.approvedByDate), image: payload.approvedBySignature }];
  for (const row of signatureRows) {
    drawText(page, font, row.role, { x: 425, top: row.top, width: 96, height: 19, align: "right", size: 7.2, bold: true });
    drawText(page, font, "שם", { x: 405, top: row.top, width: 15, height: 19, align: "right", size: 6.8 });
    drawText(page, font, row.name, { x: 280, top: row.top, width: 124, height: 19, align: "right", size: 6.8 });
    drawText(page, font, "תאריך", { x: 246, top: row.top, width: 23, height: 19, align: "right", size: 6.8 });
    drawText(page, font, row.date, { x: 168, top: row.top, width: 77, height: 19, align: "right", size: 6.7 });
    await signature(page, pdf, row.image, 88, row.top, 78, 19);
  }
  drawText(page, font, "נספח", { x: 148, top: 795, width: 38, height: 12, align: "right", size: 8, bold: true }); drawText(page, font, "8.4.2.3.2", { x: 88, top: 795, width: 58, height: 12, align: "left", size: 8, bold: true });
  for (let offset = 3; offset < products.length; offset += 32) {
    const continuation = pdf.addPage([595.28, pageHeight]);
    continuation.drawImage(logo, { x: 28, y: pageHeight - 67, width: 74, height: 52 });
    drawText(continuation, font, "טופס ביקורת קבלה - מוצרי פיתוח", { x: 170, top: 65, width: 270, height: 21, size: 14.5, bold: true });
    drawText(continuation, font, `רשימת מוצרים - המשך · ${payload.supplierName} · ${formatDate(payload.date)}`, { x: 88, top: 97, width: 433, height: 18, size: 9, bold: true });
    productTable(continuation, font, products.slice(offset, offset + 32), 125, offset);
    drawText(continuation, font, "הבדיקות, הסטטוס והחתימות בעמוד הראשון חלים על המוצרים ברשימה זו", { x: 88, top: 740, width: 433, height: 18, size: 8 });
    drawText(continuation, font, "נספח", { x: 148, top: 795, width: 38, height: 12, align: "right", size: 8, bold: true });
    drawText(continuation, font, "8.4.2.3.2", { x: 88, top: 795, width: 58, height: 12, align: "left", size: 8, bold: true });
  }
  for (let offset = 3; offset < payload.drawingRows.length; offset += 26) {
    const continuation = pdf.addPage([595.28, pageHeight]);
    continuation.drawImage(logo, { x: 28, y: pageHeight - 67, width: 74, height: 52 });
    drawText(continuation, font, "בדיקת התאמה לשרטוט / דרישה - המשך", { x: 120, top: 72, width: 401, height: 23, size: 13, bold: true });
    drawText(continuation, font, payload.supplierName, { x: 200, top: 105, width: 321, height: 17, size: 9 });
    drawText(continuation, font, formatDate(payload.date), { x: 88, top: 105, width: 100, height: 17, size: 9 });
    const continuationWidths = [62, 82, 82, 90, 91, 26];
    const continuationHeaders = ["תקין/לא תקין", "תוצאה בפועל", "אמצעי בדיקה", "דרישה/טולרנס", "מאפיין שנבדק", "#"];
    let cellX = 88;
    continuationHeaders.forEach((label, index) => {
      rect(continuation, cellX, 134, continuationWidths[index], 22, true);
      drawText(continuation, font, label, { x: cellX, top: 134, width: continuationWidths[index], height: 22, size: 7, bold: true });
      cellX += continuationWidths[index];
    });
    payload.drawingRows.slice(offset, offset + 26).forEach((row, index) => {
      const top = 156 + index * 22;
      const values = [row.conformity === "pass" ? "תקין" : row.conformity === "fail" ? "לא תקין" : "", row.actualResult, row.inspectionMethod, row.requirement, row.characteristic, String(offset + index + 1)];
      let x = 88;
      values.forEach((value, column) => {
        rect(continuation, x, top, continuationWidths[column], 22);
        drawText(continuation, font, value, { x, top, width: continuationWidths[column], height: 22, size: 7 });
        x += continuationWidths[column];
      });
    });
    drawText(continuation, font, "הסטטוס והחתימות בעמוד הראשון חלים גם על שורות הבדיקה ברשימה זו", { x: 88, top: 745, width: 433, height: 18, size: 8 });
    drawText(continuation, font, "נספח", { x: 148, top: 795, width: 38, height: 12, align: "right", size: 8, bold: true });
    drawText(continuation, font, "8.4.2.3.2", { x: 88, top: 795, width: 58, height: 12, align: "left", size: 8, bold: true });
  }
  pdf.getPages().forEach((item, index, pages) => {
    if (pages.length > 1) drawText(item, font, `${index + 1} / ${pages.length}`, { x: 460, top: 795, width: 61, height: 12, size: 8 });
  });
  pdf.setTitle("טופס ביקורת קבלה - מוצרי פיתוח"); pdf.setSubject("נספח 8.4.2.3.2"); storePayload(pdf, payload); return Buffer.from(await pdf.save());
}
