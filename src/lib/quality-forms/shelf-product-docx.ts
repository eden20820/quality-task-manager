import { AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType } from "docx";

import { CAELI_LOGO_PNG_BASE64 } from "./rir-assets";
import type { ShelfProductInspectionPayload } from "./shelf-product-inspection";
import { EDEN_AHARON_SIGNATURE_PNG_BASE64, SERGEY_DROR_SIGNATURE_PNG_BASE64, UZI_BARZILAY_SIGNATURE_PNG_BASE64 } from "./uzi-signature";

const border = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

function display(value: string) { return value.trim() || "N/A"; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}.${month}.${year}` : "N/A"; }
function paragraph(text: string, options: { bold?: boolean; size?: number; align?: Align } = {}) { return new Paragraph({ bidirectional: true, alignment: options.align ?? AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [new TextRun({ text, bold: options.bold, size: options.size ?? 18, font: "Arial" })] }); }
function cell(text: string, width: number, options: { bold?: boolean; shade?: boolean; align?: Align } = {}) { return new TableCell({ width: { size: width, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, shading: options.shade ? { type: ShadingType.CLEAR, fill: "F2F2F2" } : undefined, margins: { top: 30, bottom: 30, left: 70, right: 70 }, children: [paragraph(text, { bold: options.bold, align: options.align })] }); }

function detailsTable(payload: ShelfProductInspectionPayload) {
  const docs = [["COC", payload.documents.coc], ["COA", payload.documents.coa], ["COT", payload.documents.cot], [payload.otherDocument.trim() ? `אחר: ${payload.otherDocument.trim()}` : "אחר", payload.documents.other]] as const;
  const rows = [["שם מוצר מתקבל", display(payload.productName)], ["מק״ט", display(payload.catalogNumber)], ["שם הספק:", display(payload.supplierName)], ["כמות:", display(payload.quantity)], ["מספר אצווה:", display(payload.batchNumber)], ["תאריך קליטה:", formatDate(payload.receiptDate)], ["מסמכים נלווים", docs.map(([label, checked]) => `${checked ? "☒" : "☐"} ${label}`).join("     ")]];
  return new Table({ width: { size: 92, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: rows.map(([label, value]) => new TableRow({ children: [cell(value, 50, { bold: true }), cell(label, 50, { bold: true, shade: true, align: AlignmentType.RIGHT })] })) });
}

function inspectionTable(payload: ShelfProductInspectionPayload) {
  const labels = ["בדיקת שלמות האריזה (נזק פיזי, פתיחה, קרעים)", "בדיקת תווית/סימון על האריזה (מק״ט, מספר אצווה, תאריך ייצור/תפוגה)", "התאמה בין פרטי האריזה לבין המסמך הנלווה (COC/COA)", "בדיקת התאמה להזמנה/תעודת משלוח (כמות, מק״ט, דגם)"];
  return new Table({ width: { size: 92, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [new TableRow({ tableHeader: true, children: [cell("הערות", 35, { bold: true, shade: true }), cell("לא תקין", 13, { bold: true, shade: true }), cell("תקין", 13, { bold: true, shade: true }), cell("פרמטר לבדיקה", 39, { bold: true, shade: true })] }), ...labels.map((label, index) => new TableRow({ children: [cell(payload.inspections[index].comment, 35), cell(payload.inspections[index].result === "fail" ? "X" : "", 13), cell(payload.inspections[index].result === "pass" ? "V" : "", 13), cell(label, 39, { bold: true, align: AlignmentType.RIGHT })] }))] });
}

function approvalTable(payload: ShelfProductInspectionPayload) {
  const choices = [["מאושר לשימוש", "approved"], ["לא מאושר לשימוש", "rejected"], ["מאושר מותנה (לפרטים בהערות)", "conditional"]] as const;
  return new Table({ width: { size: 92, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [new TableRow({ children: [cell(choices.map(([label, value]) => `${payload.usageApproval === value ? "☒" : "☐"} ${label}`).join("     "), 80), cell("אישור לשימוש:", 20, { bold: true, shade: true, align: AlignmentType.RIGHT })] })] });
}

function signatureImage(base64: string) { return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [new ImageRun({ data: Buffer.from(base64, "base64"), type: "png", transformation: { width: 54, height: 28 } })] }); }
function signaturesTable(payload: ShelfProductInspectionPayload) {
  const inspectorSignature = payload.inspectorName === "Sergey Dror" ? SERGEY_DROR_SIGNATURE_PNG_BASE64 : EDEN_AHARON_SIGNATURE_PNG_BASE64;
  const signatureCell = (base64: string) => new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: { top: 15, bottom: 15, left: 40, right: 40 }, children: [signatureImage(base64)] });
  const heading = (text: string) => new TableRow({ children: [new TableCell({ columnSpan: 4, shading: { type: ShadingType.CLEAR, fill: "F2F2F2" }, children: [paragraph(text, { bold: true })] })] });
  return new Table({ width: { size: 92, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, borders, rows: [heading("נבדק על ידי"), new TableRow({ children: [signatureCell(inspectorSignature), cell(formatDate(payload.inspectorDate), 20), cell("תפקיד: QC", 25), cell(`שם: ${payload.inspectorName}`, 35)] }), heading("אושר על ידי"), new TableRow({ children: [signatureCell(UZI_BARZILAY_SIGNATURE_PNG_BASE64), cell(formatDate(payload.approverDate), 20), cell("תפקיד: משנה למנכ״ל", 25), cell("שם: Uzi Barzilay", 35)] })] });
}

export async function buildShelfProductInspectionDocx(payload: ShelfProductInspectionPayload) {
  const notes = display(payload.notes).split(/\r?\n/).map((line, index) => new TextRun({ text: line, break: index ? 1 : undefined, size: 18, font: "Arial" }));
  const document = new Document({ sections: [{ properties: { page: { margin: { top: 320, right: 420, bottom: 320, left: 420 } } }, children: [
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 0 }, children: [new ImageRun({ data: Buffer.from(CAELI_LOGO_PNG_BASE64, "base64"), type: "png", transformation: { width: 78, height: 54 } })] }),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 }, children: [new TextRun({ text: "טופס ביקורת קבלה למוצר מדף", bold: true, underline: {}, size: 30, font: "Arial" })] }),
    detailsTable(payload), new Paragraph({ spacing: { before: 80, after: 0 } }), inspectionTable(payload),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { before: 30, after: 0 }, children: [new TextRun({ text: "1. סמן X / V בהתאם לממצאים   2. יש לצרף טופס זה למסמכי הקליטה של החומר", size: 17, font: "Arial" })] }),
    new Paragraph({ spacing: { before: 50, after: 0 } }), approvalTable(payload),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { before: 55, after: 35 }, children: [new TextRun({ text: "הערות: ", bold: true, size: 18, font: "Arial" }), ...notes] }),
    signaturesTable(payload),
  ] }] });
  return Buffer.from(await Packer.toBuffer(document));
}
