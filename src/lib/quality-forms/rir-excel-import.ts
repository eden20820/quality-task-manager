import { formatMeasurementForEquipment, resizeMeasurementRows, type RirApproval, type RirFormPayload, type RirPassFail } from "./rir";

type Worksheet = import("exceljs").Worksheet;
type Cell = import("exceljs").Cell;

const formLabels = new Set([
  "Part / Product Catalog No.", "Part Name", "Supplier Name", "Received Quantity", "Order No.", "Lot / Batch No.",
  "DWG No.", "Rev.", "Attached Documents", "Comments", "Sample Size", "Test Columns", "Disposition", "NC No.",
  "NC Decision", "Approved / Rejected Parts", "Special Conditions", "Inspector Name", "Reviewed and Approved by", "Date", "Signature",
]);

function cellValue(cell: Cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined && value.result !== null) return String(value.result);
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((entry) => entry.text).join("");
  }
  return String(value);
}

function cleanValue(value: string) {
  const normalized = value.trim();
  return normalized === "N/A" || normalized === "—" ? "" : normalized;
}

function findLabel(worksheet: Worksheet, label: string) {
  for (let row = 1; row <= worksheet.rowCount; row += 1) {
    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      const cell = worksheet.getCell(row, column);
      if (cellValue(cell).trim() === label) return cell;
    }
  }
  return null;
}

function valueAfterLabel(worksheet: Worksheet, label: string) {
  const labelCell = findLabel(worksheet, label);
  if (!labelCell) return "";
  const { row, col } = labelCell.fullAddress;
  for (let column = col + 1; column <= worksheet.columnCount; column += 1) {
    const rawValue = cellValue(worksheet.getCell(row, column)).trim();
    if (formLabels.has(rawValue)) return "";
    const value = cleanValue(rawValue);
    if (value) return value;
  }
  return "";
}

function inputValue(cell: Cell) {
  return cleanValue(cellValue(cell));
}

function isoDate(value: string) {
  const normalized = cleanValue(value);
  const match = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return normalized;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function dispositionValue(value: string): RirApproval["disposition"] {
  return ({
    Approved: "approved",
    "Hold / NC": "hold",
    Rejected: "rejected",
    "Approved with Special Conditions": "special",
  } as const)[value] ?? "";
}

function ncDecisionValue(value: string): RirApproval["ncDecision"] {
  return ({ Accept: "accept", Reject: "reject", Rework: "rework" } as const)[value] ?? "";
}

function passFailValue(value: string): RirPassFail {
  return value === "Pass" || value === "Fail" ? value : "";
}

export async function parseRirWorkbook(data: Buffer | Uint8Array) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  await workbook.xlsx.load(data as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.getWorksheet("RIR") ?? workbook.worksheets.find((sheet) => cellValue(sheet.getCell("A1")) === "Receiving Inspection Report (RIR)");
  if (!worksheet || cellValue(worksheet.getCell("A1")) !== "Receiving Inspection Report (RIR)") {
    throw new Error("הקובץ אינו טופס RIR שנוצר במערכת");
  }

  let metadata: Partial<RirFormPayload> | null = null;
  const metadataSheet = workbook.getWorksheet("_QTM_DATA");
  if (metadataSheet && cellValue(metadataSheet.getCell("A1")) === "QTM_RIR_V1") {
    try {
      metadata = JSON.parse(cellValue(metadataSheet.getCell("A2"))) as Partial<RirFormPayload>;
    } catch {
      metadata = null;
    }
  }

  const documentsText = valueAfterLabel(worksheet, "Attached Documents");
  const documentParts = documentsText.split(",").map((value) => value.trim()).filter(Boolean);
  const knownDocuments = new Set(["COC", "COT", "COA"]);
  const otherDocument = documentParts.find((value) => !knownDocuments.has(value)) ?? "";
  const details: RirFormPayload["details"] = {
    catalogNumber: valueAfterLabel(worksheet, "Part / Product Catalog No."),
    partName: valueAfterLabel(worksheet, "Part Name"),
    supplierName: valueAfterLabel(worksheet, "Supplier Name"),
    receivedQuantity: valueAfterLabel(worksheet, "Received Quantity"),
    orderNumber: valueAfterLabel(worksheet, "Order No."),
    lotNumber: valueAfterLabel(worksheet, "Lot / Batch No."),
    drawingNumber: valueAfterLabel(worksheet, "DWG No."),
    drawingRevision: valueAfterLabel(worksheet, "Rev.") || "00",
    comments: valueAfterLabel(worksheet, "Comments"),
    documents: {
      coc: documentParts.includes("COC"),
      cot: documentParts.includes("COT"),
      coa: documentParts.includes("COA"),
      other: Boolean(otherDocument),
    },
    otherDocument,
  };

  const headerColumns: Array<{ column: number; kind: "measurement" | "visual" | "functional"; equipment: string }> = [];
  const seenColumns = new Set<number>();
  worksheet.getRow(13).eachCell({ includeEmpty: false }, (cell) => {
    const master = cell.master ?? cell;
    const column = master.fullAddress.col;
    if (column < 4 || seenColumns.has(column)) return;
    seenColumns.add(column);
    const value = cellValue(master).trim();
    if (!value) return;
    if (value.toLowerCase() === "vis.") headerColumns.push({ column, kind: "visual", equipment: "" });
    else if (value.toLowerCase() === "func.") headerColumns.push({ column, kind: "functional", equipment: "" });
    else headerColumns.push({ column, kind: "measurement", equipment: cleanValue(value) });
  });
  headerColumns.sort((left, right) => left.column - right.column);
  if (!headerColumns.length) throw new Error("לא נמצאו עמודות בדיקה בטופס RIR");
  const measurementColumns = headerColumns.filter((entry) => entry.kind === "measurement");
  const attributes = measurementColumns.map((entry, index) => {
    const metadataAttribute = Array.isArray(metadata?.attributes) ? metadata.attributes[index] : undefined;
    const equipment = entry.equipment || metadataAttribute?.equipment || "";
    return {
      id: metadataAttribute?.id || `measurement-${index + 1}`,
      name: metadataAttribute?.name || `מידה ${index + 1}`,
      equipment,
      max: formatMeasurementForEquipment(inputValue(worksheet.getCell(14, entry.column)), equipment),
      min: formatMeasurementForEquipment(inputValue(worksheet.getCell(15, entry.column)), equipment),
    };
  });
  const visualColumn = headerColumns.find((entry) => entry.kind === "visual")?.column;
  const functionalColumn = headerColumns.find((entry) => entry.kind === "functional")?.column;

  const summaryStart = findLabel(worksheet, "Max.")?.fullAddress.row ?? 16;
  const rows = [] as RirFormPayload["rows"];
  for (let rowNumber = 16; rowNumber < summaryStart; rowNumber += 1) {
    const specimen = Number(cellValue(worksheet.getCell(rowNumber, 1))) || rows.length + 1;
    rows.push({
      specimen,
      values: measurementColumns.map((entry, index) => formatMeasurementForEquipment(inputValue(worksheet.getCell(rowNumber, entry.column)), attributes[index]?.equipment ?? "")),
      visual: visualColumn ? passFailValue(inputValue(worksheet.getCell(rowNumber, visualColumn))) : "",
      functional: functionalColumn ? passFailValue(inputValue(worksheet.getCell(rowNumber, functionalColumn))) : "",
    });
  }
  const requestedSampleSize = Number(valueAfterLabel(worksheet, "Sample Size"));
  const sampleSize = Math.min(200, Math.max(1, Number.isFinite(requestedSampleSize) && requestedSampleSize > 0 ? requestedSampleSize : rows.length || 1));
  const normalizedRows = resizeMeasurementRows(rows, sampleSize, attributes.length);

  const parts = valueAfterLabel(worksheet, "Approved / Rejected Parts").split("/").map((value) => cleanValue(value));
  const inspectorRow = findLabel(worksheet, "Inspector Name")?.fullAddress.row;
  const reviewerRow = findLabel(worksheet, "Reviewed and Approved by")?.fullAddress.row;
  const approval: RirFormPayload["approval"] = {
    disposition: dispositionValue(valueAfterLabel(worksheet, "Disposition")),
    ncNumber: valueAfterLabel(worksheet, "NC No."),
    ncDecision: ncDecisionValue(valueAfterLabel(worksheet, "NC Decision")),
    specialConditions: valueAfterLabel(worksheet, "Special Conditions"),
    approvedParts: parts[0] ?? "",
    rejectedParts: parts[1] ?? "",
    inspectorName: inspectorRow ? valueAfterLabel(worksheet, "Inspector Name") : "Eden Aharon",
    inspectionDate: inspectorRow ? isoDate(cellValue(worksheet.getCell(inspectorRow, Math.max(4, Math.floor(worksheet.columnCount / 2) + 1)))) : "",
    reviewerName: reviewerRow ? valueAfterLabel(worksheet, "Reviewed and Approved by") : "Uzi Barzilay",
    reviewDate: reviewerRow ? isoDate(cellValue(worksheet.getCell(reviewerRow, Math.max(4, Math.floor(worksheet.columnCount / 2) + 1)))) : "",
  };

  return {
    details,
    attributes,
    rows: normalizedRows,
    approval,
    sampleSize,
    includeVisual: Boolean(visualColumn),
    includeFunctional: Boolean(functionalColumn),
  } satisfies RirFormPayload;
}
