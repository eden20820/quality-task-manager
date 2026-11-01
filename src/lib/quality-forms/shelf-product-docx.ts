import { AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType } from "docx";

import { CAELI_LOGO_PNG_BASE64 } from "./rir-assets";
import type { ShelfProductInspectionPayload } from "./shelf-product-inspection";
import { EDEN_AHARON_SIGNATURE_PNG_BASE64, UZI_BARZILAY_SIGNATURE_PNG_BASE64 } from "./uzi-signature";

const border = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

function display(value: string) { return value.trim() || "N/A"; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}.${month}.${year}` : "N/A"; }
function paragraph(text: string, options: { bold?: boolean; size?: number; align?: Align } = {}) { return new Paragraph({ bidirectional: true, alignment: options.align ?? AlignmentType.CENTER, children: [new TextRun({ text, bold: options.bold, size: options.size ?? 24, font: "Arial" })] }); }
function cell(text: string, width: number, options: { bold?: boolean; shade?: boolean; align?: Align } = {}) { return new TableCell({ width: { size: width, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, shading: options.shade ? { type: ShadingType.CLEAR, fill: "F2F2F2" } : undefined, margins: { top: 90, bottom: 90, left: 100, right: 100 }, children: [paragraph(text, { bold: options.bold, align: options.align })] }); }

function detailsTable(payload: ShelfProductInspectionPayload) {
  const docs = [["COC", payload.documents.coc], ["COA", payload.documents.coa], ["COT", payload.documents.cot], [payload.otherDocument.trim() ? `אחר: ${payload.otherDocument.trim()}` : "אחר", payload.documents.other]] as const;
  const rows = [["שם מוצר מתקבל", display(payload.productName)], ["מק״ט", display(payload.catalogNumber)], ["שם הספק:", display(payload.supplierName)], ["כמות:", display(payload.quantity)], ["מספר אצווה:", display(payload.batchNumber)], ["תאריך קליטה:", formatDate(payload.receiptDate)], ["מסמכים נלווים", docs.map(([label, checked]) => `${checked ? "☒" : "☐"} ${label}`).join("     ")]];
  return new Table({ width: { size: 86, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: rows.map(([label, value]) => new TableRow({ children: [cell(value, 50, { bold: true }), cell(label, 50, { bold: true, shade: true, align: AlignmentType.RIGHT })] })) });
}

function inspectionTable(payload: ShelfProductInspectionPayload) {
  const labels = ["בדיקת שלמות האריזה (נזק פיזי, פתיחה, קרעים)", "בדיקת תווית/סימון על האריזה (מק״ט, מספר אצווה, תאריך ייצור/תפוגה)", "התאמה בין פרטי האריזה לבין המסמך הנלווה (COC/COA)", "בדיקת התאמה להזמנה/תעודת משלוח (כמות, מק״ט, דגם)"];
  return new Table({ width: { size: 86, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [new TableRow({ tableHeader: true, children: [cell("הערות", 35, { bold: true, shade: true }), cell("לא תקין", 13, { bold: true, shade: true }), cell("תקין", 13, { bold: true, shade: true }), cell("פרמטר לבדיקה", 39, { bold: true, shade: true })] }), ...labels.map((label, index) => new TableRow({ children: [cell(payload.inspections[index].comment, 35), cell(payload.inspections[index].result === "fail" ? "X" : "", 13), cell(payload.inspections[index].result === "pass" ? "V" : "", 13), cell(label, 39, { bold: true, align: AlignmentType.RIGHT })] }))] });
}

function approvalTable(payload: ShelfProductInspectionPayload) {
  const choices = [["מאושר לשימוש", "approved"], ["לא מאושר לשימוש", "rejected"], ["מאושר מותנה (לפרטים בהערות)", "conditional"]] as const;
  return new Table({ width: { size: 86, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [new TableRow({ children: [cell(choices.map(([label, value]) => `${payload.usageApproval === value ? "☒" : "☐"} ${label}`).join("     "), 80), cell("אישור לשימוש:", 20, { bold: true, shade: true, align: AlignmentType.RIGHT })] })] });
}

function signatureImage(base64: string) { return new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: Buffer.from(base64, "base64"), type: "png", transformation: { width: 80, height: 42 } })] }); }
function signaturesTable(payload: ShelfProductInspectionPayload) {
  const signatureCell = (base64: string) => new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, children: [paragraph("חתימה:", { bold: true }), signatureImage(base64)] });
  const heading = (text: string) => new TableRow({ children: [new TableCell({ columnSpan: 4, shading: { type: ShadingType.CLEAR, fill: "F2F2F2" }, children: [paragraph(text, { bold: true })] })] });
  return new Table({ width: { size: 86, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [heading("נבדק על ידי"), new TableRow({ children: [signatureCell(EDEN_AHARON_SIGNATURE_PNG_BASE64), cell(formatDate(payload.inspectorDate), 20), cell("תפקיד: QC", 25), cell("שם: עדן אהרון", 35)] }), heading("אושר על ידי"), new TableRow({ children: [signatureCell(UZI_BARZILAY_SIGNATURE_PNG_BASE64), cell(formatDate(payload.approverDate), 20), cell("תפקיד: משנה למנכ״ל", 25), cell("שם: עוזי ברזילי", 35)] })] });
}

export async function buildShelfProductInspectionDocx(payload: ShelfProductInspectionPayload) {
  const notes = display(payload.notes).split(/\r?\n/).map((line, index) => new TextRun({ text: line, break: index ? 1 : undefined, size: 24, font: "Arial" }));
  const document = new Document({ sections: [{ properties: { page: { margin: { top: 700, right: 700, bottom: 700, left: 700 } } }, children: [
    new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: Buffer.from(CAELI_LOGO_PNG_BASE64, "base64"), type: "png", transformation: { width: 112, height: 78 } })] }),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 260, after: 600 }, children: [new TextRun({ text: "טופס ביקורת קבלה למוצר מדף", bold: true, underline: {}, size: 38, font: "Arial" })] }),
    detailsTable(payload), new Paragraph({ spacing: { before: 380 } }), inspectionTable(payload),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { before: 100 }, children: [new TextRun({ text: "1. הערה: סמן X / V בהתאם לממצאים", size: 23, font: "Arial" }), new TextRun({ text: "2. יש לצרף טופס זה למסמכי הקליטה של החומר", break: 1, size: 23, font: "Arial" })] }),
    new Paragraph({ spacing: { before: 220 } }), approvalTable(payload),
    new Paragraph({ pageBreakBefore: true, bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "הערות:", bold: true, size: 26, font: "Arial" }), new TextRun({ text: "", break: 1 }), ...notes] }),
    new Paragraph({ spacing: { before: 7200 } }), signaturesTable(payload),
  ] }] });
  return Buffer.from(await Packer.toBuffer(document));
}
