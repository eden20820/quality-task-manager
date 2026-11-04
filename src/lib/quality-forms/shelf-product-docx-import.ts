import JSZip from "jszip";

import { SHELF_INSPECTION_ITEMS, type InspectionResult, type ShelfProductInspectionPayload } from "./shelf-product-inspection";

function decodeXml(value: string) {
  return value.replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi, (match, hex, decimal, named) => {
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[String(named).toLowerCase()] ?? match;
  });
}

function textFromXml(xml: string) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("").trim();
}

function topLevelBlocks(xml: string, tag: string) {
  const token = new RegExp(`<${tag}(?:\\s[^>]*)?>|<\\/${tag}>`, "g");
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;
  for (const match of xml.matchAll(token)) {
    const isClosing = match[0].startsWith("</");
    if (!isClosing) {
      if (depth === 0) start = match.index ?? -1;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) blocks.push(xml.slice(start, (match.index ?? 0) + match[0].length));
    }
  }
  return blocks;
}

function tableRows(tableXml: string) {
  return topLevelBlocks(tableXml, "w:tr").map((row) => topLevelBlocks(row, "w:tc").map(textFromXml));
}

function inputValue(value: string | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized === "N/A" || normalized === "—" ? "" : normalized;
}

function isoDate(value: string | undefined) {
  const normalized = inputValue(value);
  const match = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : normalized;
}

function checked(text: string, label: string) {
  return new RegExp(`☒\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text);
}

function documentValue(rows: string[][], label: string) {
  const normalizedLabel = label.replace(/:$/, "");
  const row = rows.find((cells) => cells.some((cell) => cell.replace(/:$/, "") === normalizedLabel));
  if (!row) return "";
  const labelIndex = row.findIndex((cell) => cell.replace(/:$/, "") === normalizedLabel);
  return inputValue(row.find((_, index) => index !== labelIndex));
}

export async function parseShelfProductInspectionDocx(data: Buffer | Uint8Array) {
  const zip = await JSZip.loadAsync(data);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml || !textFromXml(documentXml).includes("טופס ביקורת קבלה למוצר מדף")) {
    throw new Error("הקובץ אינו טופס ביקורת קבלה למוצר מדף שנוצר במערכת");
  }
  const tables = topLevelBlocks(documentXml, "w:tbl");
  if (tables.length < 5) throw new Error("מבנה טופס ביקורת הקבלה אינו תקין");

  const rowsByTable = tables.map(tableRows);
  const productRows = rowsByTable.find((rows) => rows[0]?.includes("שם מוצר מתקבל") && rows[0]?.includes("#"));
  const details = rowsByTable.find((rows) => rows.some((cells) => cells.some((cell) => cell.replace(/:$/, "") === "שם הספק"))) ?? rowsByTable[0];
  const productHeader = productRows?.[0] ?? [];
  const numberIndex = productHeader.indexOf("#");
  const nameIndex = productHeader.indexOf("שם מוצר מתקבל");
  const catalogIndex = productHeader.indexOf("מק״ט");
  const quantityIndex = productHeader.indexOf("כמות");
  const products = productRows && [numberIndex, nameIndex, catalogIndex, quantityIndex].every((index) => index >= 0)
    ? productRows.slice(1).filter((cells) => cells.length === 4 && /^\d+$/.test(cells[numberIndex] ?? "")).map((cells) => ({
      productName: inputValue(cells[nameIndex]),
      catalogNumber: inputValue(cells[catalogIndex]),
      quantity: inputValue(cells[quantityIndex]),
    }))
    : [{
      productName: documentValue(details, "שם מוצר מתקבל"),
      catalogNumber: documentValue(details, "מק״ט"),
      quantity: documentValue(details, "כמות"),
    }];
  const documentsText = documentValue(details, "מסמכים נלווים");
  const otherMatch = documentsText.match(/☒\s*אחר:\s*([^☐☒]+)/);
  const inspectionTableRows = rowsByTable.find((rows) => rows[0]?.includes("פרמטר לבדיקה"));
  const inspectionRows = (inspectionTableRows ?? []).slice(1, 1 + SHELF_INSPECTION_ITEMS.length);
  const approvalRows = rowsByTable.find((rows) => rows.some((cells) => cells.some((cell) => cell.includes("אישור לשימוש")))) ?? [];
  const approvalText = approvalRows[0]?.[0] ?? "";
  const signatureRows = rowsByTable.find((rows) => rows.some((cells) => cells.some((cell) => cell.includes("נבדק על ידי")))) ?? [];
  const inspectorCells = signatureRows[1] ?? [];
  const approverCells = signatureRows[3] ?? [];
  const inspectorNameText = inspectorCells.find((cell) => cell.startsWith("שם:"))?.replace(/^שם:\s*/, "") ?? "";

  return {
    products,
    productName: products[0]?.productName ?? "",
    catalogNumber: products[0]?.catalogNumber ?? "",
    supplierName: documentValue(details, "שם הספק"),
    quantity: products[0]?.quantity ?? "",
    batchNumber: documentValue(details, "מספר אצווה"),
    receiptDate: isoDate(documentValue(details, "תאריך קליטה")),
    documents: {
      coc: checked(documentsText, "COC"),
      coa: checked(documentsText, "COA"),
      cot: checked(documentsText, "COT"),
      other: /☒\s*אחר/.test(documentsText),
    },
    otherDocument: inputValue(otherMatch?.[1]),
    inspections: SHELF_INSPECTION_ITEMS.map((_, index) => {
      const cells = inspectionRows[index] ?? [];
      const result: InspectionResult = /X/i.test(cells[1] ?? "") ? "fail" : /V/i.test(cells[2] ?? "") ? "pass" : "";
      return { result, comment: inputValue(cells[0]) };
    }),
    usageApproval: checked(approvalText, "מאושר מותנה") ? "conditional" : checked(approvalText, "לא מאושר לשימוש") ? "rejected" : checked(approvalText, "מאושר לשימוש") ? "approved" : "",
    notes: inputValue(approvalRows[1]?.[0]),
    inspectorName: inspectorNameText === "Sergey Dror" ? "Sergey Dror" : "Eden Aharon",
    inspectorDate: isoDate(inspectorCells[1]),
    approverDate: isoDate(approverCells[1]),
  } satisfies ShelfProductInspectionPayload;
}
