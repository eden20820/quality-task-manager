import { readFile } from "node:fs/promises";
import path from "node:path";

import { AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType } from "docx";

import { CAELI_LOGO_PNG_BASE64 } from "./rir-assets";
import type { ShelfProductInspectionPayload } from "./shelf-product-inspection";
import { EDEN_AHARON_SIGNATURE_PNG_BASE64, SERGEY_DROR_SIGNATURE_PNG_BASE64, UZI_BARZILAY_SIGNATURE_PNG_BASE64 } from "./uzi-signature";

const border = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder };
const formFont = { ascii: "David", hAnsi: "David", cs: "David", eastAsia: "David" };

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

function display(value: string) { return value.trim() || "N/A"; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}.${month}.${year}` : "N/A"; }
// Word needs direction on each run as well as on the paragraph. Keeping Latin
// names/part numbers out of RTL runs prevents mirrored punctuation and words.
function paragraph(text: string, options: { bold?: boolean; size?: number; align?: Align } = {}) {
  const rtl = /[\u0590-\u05ff]/.test(text);
  const segments = text.split(/([A-Za-z0-9]+(?:[ .,/+%°_-]*[A-Za-z0-9]+)*)/g).filter(Boolean);
  return new Paragraph({
    bidirectional: rtl,
    alignment: options.align ?? AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: segments.map((segment) => new TextRun({
      text: segment,
      rightToLeft: rtl && !/[A-Za-z0-9]/.test(segment),
      bold: options.bold,
      size: options.size ?? 18,
      font: formFont,
    })),
  });
}
function cell(text: string, width: number, options: { bold?: boolean; shade?: boolean; align?: Align } = {}) { return new TableCell({ width: { size: width, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, shading: options.shade ? { type: ShadingType.CLEAR, fill: "F2F2F2" } : undefined, margins: { top: 30, bottom: 30, left: 70, right: 70 }, children: [paragraph(text, { bold: options.bold, align: options.align })] }); }

function productsTable(payload: ShelfProductInspectionPayload) {
  const products = payload.products?.length ? payload.products : [{ productName: payload.productName, catalogNumber: payload.catalogNumber, quantity: payload.quantity }];
  return new Table({
    width: { size: 92, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    layout: TableLayoutType.FIXED,
    visuallyRightToLeft: true,
    borders,
    rows: [
      new TableRow({ tableHeader: true, children: [cell("#", 10, { bold: true, shade: true }), cell("שם מוצר מתקבל", 50, { bold: true, shade: true }), cell("מק״ט", 25, { bold: true, shade: true }), cell("כמות", 15, { bold: true, shade: true })] }),
      ...products.map((product, index) => new TableRow({ children: [cell(String(index + 1), 10, { bold: true }), cell(display(product.productName), 50, { bold: true }), cell(display(product.catalogNumber), 25, { bold: true }), cell(display(product.quantity), 15, { bold: true })] })),
    ],
  });
}

function detailsTable(payload: ShelfProductInspectionPayload) {
  const docs = [["COC", payload.documents.coc], ["COA", payload.documents.coa], ["COT", payload.documents.cot], [payload.otherDocument.trim() ? `אחר - ${payload.otherDocument.trim()}` : "אחר", payload.documents.other]] as const;
  const products = payload.products?.length ? payload.products : [{ productName: payload.productName, catalogNumber: payload.catalogNumber, quantity: payload.quantity }];
  const commonRows = [
    ...(products.length === 1 ? [["שם מוצר מתקבל", display(products[0].productName)], ["מק״ט", display(products[0].catalogNumber)]] : []),
    ["שם הספק", display(payload.supplierName)],
    ...(products.length === 1 ? [["כמות", display(products[0].quantity)]] : []),
    ["מספר אצווה", display(payload.batchNumber)],
    ["תאריך קליטה", formatDate(payload.receiptDate)],
    ["מסמכים נלווים", docs.map(([label, checked]) => `${checked ? "☒" : "☐"} ${label}`).join("     ")],
  ];
  return new Table({ width: { size: 92, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, visuallyRightToLeft: true, borders, rows: commonRows.map(([label, value]) => new TableRow({ children: [cell(label, 25, { bold: true, shade: true, align: AlignmentType.RIGHT }), cell(value, 75, { bold: true })] })) });
}

function inspectionTable(payload: ShelfProductInspectionPayload) {
  const labels = ["בדיקת שלמות האריזה (נזק פיזי, פתיחה, קרעים)", "בדיקת תווית/סימון על האריזה (מק״ט, מספר אצווה, תאריך ייצור/תפוגה)", "התאמה בין פרטי האריזה לבין המסמך הנלווה (COC/COA)", "בדיקת התאמה להזמנה/תעודת משלוח (כמות, מק״ט, דגם)"];
  return new Table({ width: { size: 92, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [new TableRow({ tableHeader: true, children: [cell("הערות", 35, { bold: true, shade: true }), cell("לא תקין", 13, { bold: true, shade: true }), cell("תקין", 13, { bold: true, shade: true }), cell("פרמטר לבדיקה", 39, { bold: true, shade: true })] }), ...labels.map((label, index) => new TableRow({ children: [cell(payload.inspections[index].comment, 35), cell(payload.inspections[index].result === "fail" ? "X" : "", 13), cell(payload.inspections[index].result === "pass" ? "V" : "", 13), cell(label, 39, { bold: true, align: AlignmentType.RIGHT })] }))] });
}

function instructionTable() {
  return new Table({ width: { size: 92, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders: noBorders, rows: [new TableRow({ children: [
    cell("יש לצרף טופס זה למסמכי הקליטה של החומר", 52, { align: AlignmentType.RIGHT }),
    cell("2.", 6, { align: AlignmentType.CENTER }),
    cell("סמן X / V בהתאם לממצאים", 36, { align: AlignmentType.RIGHT }),
    cell("1.", 6, { align: AlignmentType.CENTER }),
  ] })] });
}

function approvalChoicesCell(payload: ShelfProductInspectionPayload) {
  const mark = (value: ShelfProductInspectionPayload["usageApproval"]) => payload.usageApproval === value ? "☒" : "☐";
  const choices = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [new TableRow({ children: [cell(`${mark("conditional")} מאושר מותנה (לפרטים בהערות)`, 46), cell(`${mark("rejected")} לא מאושר לשימוש`, 27), cell(`${mark("approved")} מאושר לשימוש`, 27)] })] });
  return new TableCell({ width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: [choices] });
}

function approvalTable(payload: ShelfProductInspectionPayload) {
  return new Table({ width: { size: 92, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [new TableRow({ children: [approvalChoicesCell(payload), cell("אישור לשימוש", 20, { bold: true, shade: true, align: AlignmentType.RIGHT })] }), new TableRow({ children: [cell(display(payload.notes), 80, { align: payload.notes.trim() ? AlignmentType.RIGHT : AlignmentType.CENTER }), cell("הערות", 20, { bold: true, shade: true, align: AlignmentType.RIGHT })] })] });
}

function signatureImage(base64: string) { return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [new ImageRun({ data: Buffer.from(base64, "base64"), type: "png", transformation: { width: 54, height: 28 } })] }); }
function signaturesTable(payload: ShelfProductInspectionPayload) {
  const inspectorSignature = payload.inspectorName === "Sergey Dror" ? SERGEY_DROR_SIGNATURE_PNG_BASE64 : EDEN_AHARON_SIGNATURE_PNG_BASE64;
  const signatureCell = (base64: string) => new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: { top: 15, bottom: 15, left: 40, right: 40 }, children: [signatureImage(base64)] });
  const heading = (text: string) => new TableRow({ children: [new TableCell({ columnSpan: 4, shading: { type: ShadingType.CLEAR, fill: "F2F2F2" }, children: [paragraph(text, { bold: true })] })] });
  return new Table({ width: { size: 92, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [heading("נבדק על ידי"), new TableRow({ children: [signatureCell(inspectorSignature), cell(formatDate(payload.inspectorDate), 20), cell("תפקיד: QC", 25), cell(`שם: ${payload.inspectorName}`, 35)] }), heading("אושר על ידי"), new TableRow({ children: [signatureCell(UZI_BARZILAY_SIGNATURE_PNG_BASE64), cell(formatDate(payload.approverDate), 20), cell("תפקיד: משנה למנכ״ל", 25), cell("שם: Uzi Barzilay", 35)] })] });
}

export async function buildShelfProductInspectionDocx(payload: ShelfProductInspectionPayload) {
  const products = payload.products?.length ? payload.products : [{ productName: payload.productName, catalogNumber: payload.catalogNumber, quantity: payload.quantity }];
  const [regularFont, boldFont] = await Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/David.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/David-Bold.ttf")),
  ]);
  const document = new Document({
    fonts: [{ name: "David", data: regularFont, bold: boldFont }],
    styles: { default: { document: { run: { font: formFont } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 360, right: 500, bottom: 650, left: 500 } } }, footers: { default: new Footer({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.LEFT, spacing: { before: 0, after: 0 }, children: [new TextRun({ text: "נספח 8.4.2.1.0", bold: true, size: 18, font: formFont })] })] }) }, children: [
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 0 }, children: [new ImageRun({ data: Buffer.from(CAELI_LOGO_PNG_BASE64, "base64"), type: "png", transformation: { width: 108, height: 76 } })] }),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 }, children: [new TextRun({ text: "טופס ביקורת קבלה למוצר מדף", bold: true, underline: {}, size: 30, font: formFont })] }),
    ...(products.length > 1 ? [productsTable(payload), new Paragraph({ spacing: { before: 30, after: 0 } })] : []), detailsTable(payload),
    new Paragraph({ spacing: { before: 80, after: 0 } }), inspectionTable(payload),
    new Paragraph({ spacing: { before: 30, after: 0 } }), instructionTable(),
    new Paragraph({ spacing: { before: 50, after: 0 } }), approvalTable(payload),
    new Paragraph({ spacing: { before: 35, after: 0 } }), signaturesTable(payload),
  ] }] });
  return Buffer.from(await Packer.toBuffer(document));
}
