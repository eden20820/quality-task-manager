import {
  measurementState,
  summarizeMeasurementColumn,
  summarizePassFail,
  type RirFormPayload,
} from "./rir";

const navy = "FF172554";
const slate = "FFE2E8F0";
const lightSlate = "FFF8FAFC";
const green = "FFDCFCE7";
const red = "FFFEE2E2";
const amber = "FFFEF3C7";
const white = "FFFFFFFF";

function columnLetter(column: number) {
  let value = column;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function numericValue(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function displayDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function dispositionLabel(value: RirFormPayload["approval"]["disposition"]) {
  return { "": "", approved: "Approved", hold: "Hold / NC", rejected: "Rejected", special: "Approved with Special Conditions" }[value];
}

function ncDecisionLabel(value: RirFormPayload["approval"]["ncDecision"]) {
  return { "": "", accept: "Accept", reject: "Reject", rework: "Rework" }[value];
}

export async function buildRirWorkbook(payload: RirFormPayload) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "Quality Task Manager";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = workbook.addWorksheet("RIR", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    properties: { defaultRowHeight: 20 },
    views: [{ state: "frozen", xSplit: 3, ySplit: 15 }],
  });

  const measurementStartColumn = 4;
  const visualColumn = measurementStartColumn + payload.attributes.length;
  const functionalColumn = visualColumn + 1;
  const lastColumn = functionalColumn;
  const middleColumn = Math.max(3, Math.floor(lastColumn / 2));

  worksheet.getColumn(1).width = 12;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 20;
  for (let column = measurementStartColumn; column <= lastColumn; column += 1) worksheet.getColumn(column).width = 17;

  worksheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = "Receiving Inspection Report (RIR)";
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells(2, 1, 2, Math.max(2, middleColumn - 1));
  worksheet.getCell(2, 1).value = "Quality Form 8.4.2.2.0";
  worksheet.mergeCells(2, middleColumn, 2, lastColumn - 1);
  worksheet.getCell(2, middleColumn).value = "Rev.: 02";
  worksheet.getCell(2, lastColumn).value = "Page 1 of 1";

  const detailRows: Array<[string, string | number, string, string | number]> = [
    ["Part / Product Catalog No.", payload.details.catalogNumber, "Part Name", payload.details.partName],
    ["Supplier Name", payload.details.supplierName, "Received Quantity", numericValue(payload.details.receivedQuantity) ?? payload.details.receivedQuantity],
    ["Order No.", payload.details.orderNumber, "Lot / Batch No.", payload.details.lotNumber],
    ["DWG No.", payload.details.drawingNumber, "Rev.", payload.details.drawingRevision],
  ];

  detailRows.forEach((detail, index) => {
    const row = index + 3;
    worksheet.getCell(row, 1).value = detail[0];
    worksheet.mergeCells(row, 2, row, middleColumn);
    worksheet.getCell(row, 2).value = detail[1];
    worksheet.getCell(row, middleColumn + 1).value = detail[2];
    if (middleColumn + 2 <= lastColumn) worksheet.mergeCells(row, middleColumn + 2, row, lastColumn);
    worksheet.getCell(row, Math.min(middleColumn + 2, lastColumn)).value = detail[3];
  });

  const attachedDocuments = [
    payload.details.documents.coc ? "COC" : "",
    payload.details.documents.cot ? "COT" : "",
    payload.details.documents.coa ? "COA" : "",
    payload.details.documents.other ? payload.details.otherDocument || "Other" : "",
  ].filter(Boolean).join(", ");
  worksheet.getCell(7, 1).value = "Attached Documents";
  worksheet.mergeCells(7, 2, 7, lastColumn);
  worksheet.getCell(7, 2).value = attachedDocuments;
  worksheet.getCell(8, 1).value = "Comments";
  worksheet.mergeCells(8, 2, 8, lastColumn);
  worksheet.getCell(8, 2).value = payload.details.comments;
  worksheet.getRow(8).height = 34;
  worksheet.getCell(10, 1).value = "Sample Size";
  worksheet.getCell(10, 2).value = payload.sampleSize;
  worksheet.getCell(10, 3).value = "Test Columns";
  worksheet.getCell(10, 4).value = payload.attributes.length;

  worksheet.mergeCells(11, 1, 15, 1);
  worksheet.getCell(11, 1).value = "Specimen\nNo.";
  worksheet.mergeCells(11, 2, 11, lastColumn);
  worksheet.getCell(11, 2).value = "Attribute No.";
  worksheet.getCell(12, 2).value = "Product and\nPackage Integrity";
  worksheet.getCell(12, 3).value = "Applicable Documents\nInspection";
  worksheet.getCell(13, 2).value = "Measuring Equipment";
  worksheet.getCell(14, 2).value = "Max Value Required";
  worksheet.getCell(15, 2).value = "Min Value Required";

  payload.attributes.forEach((attribute, index) => {
    const column = measurementStartColumn + index;
    worksheet.getCell(12, column).value = index + 1;
    worksheet.getCell(13, column).value = attribute.equipment;
    worksheet.getCell(14, column).value = numericValue(attribute.max) ?? attribute.max;
    worksheet.getCell(15, column).value = numericValue(attribute.min) ?? attribute.min;
  });
  worksheet.getCell(12, visualColumn).value = payload.attributes.length + 1;
  worksheet.getCell(13, visualColumn).value = "vis.";
  worksheet.getCell(14, visualColumn).value = "Pass";
  worksheet.getCell(15, visualColumn).value = "Fail";
  worksheet.getCell(12, functionalColumn).value = payload.attributes.length + 2;
  worksheet.getCell(13, functionalColumn).value = "Func.";
  worksheet.getCell(14, functionalColumn).value = "Pass";
  worksheet.getCell(15, functionalColumn).value = "Fail";

  const firstDataRow = 16;
  const lastDataRow = firstDataRow + payload.rows.length - 1;
  if (payload.rows.length) {
    worksheet.mergeCells(firstDataRow, 2, lastDataRow, 2);
    worksheet.getCell(firstDataRow, 2).value = "Product and Package Integrity";
    worksheet.getCell(firstDataRow, 2).alignment = { textRotation: 90, horizontal: "center", vertical: "middle", wrapText: true };
    worksheet.mergeCells(firstDataRow, 3, lastDataRow, 3);
    worksheet.getCell(firstDataRow, 3).value = "Applicable Documents Inspection";
    worksheet.getCell(firstDataRow, 3).alignment = { textRotation: 90, horizontal: "center", vertical: "middle", wrapText: true };
  }

  payload.rows.forEach((row, rowIndex) => {
    const excelRow = firstDataRow + rowIndex;
    worksheet.getCell(excelRow, 1).value = row.specimen;
    payload.attributes.forEach((attribute, attributeIndex) => {
      const cell = worksheet.getCell(excelRow, measurementStartColumn + attributeIndex);
      const value = numericValue(row.values[attributeIndex] ?? "");
      cell.value = value;
      const state = measurementState(row.values[attributeIndex] ?? "", attribute.min, attribute.max);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: state === "pass" ? green : state === "fail" || state === "invalid" ? red : state === "unconfigured" ? amber : white } };
      cell.numFmt = "0.000";
    });
    const visualCell = worksheet.getCell(excelRow, visualColumn);
    visualCell.value = row.visual;
    visualCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: row.visual === "Pass" ? green : row.visual === "Fail" ? red : white } };
    const functionalCell = worksheet.getCell(excelRow, functionalColumn);
    functionalCell.value = row.functional;
    functionalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: row.functional === "Pass" ? green : row.functional === "Fail" ? red : white } };
  });

  const summaryStart = lastDataRow + 1;
  const numericSummaries = payload.attributes.map((attribute, index) => summarizeMeasurementColumn(payload.rows, index, attribute.min, attribute.max));
  const visualSummary = summarizePassFail(payload.rows, "visual");
  const functionalSummary = summarizePassFail(payload.rows, "functional");
  const summaryRows = ["Max.", "Min.", "Average", "Std. Dev.", "Sample Size", "Approved", "Rejected"];
  summaryRows.forEach((label, index) => {
    worksheet.mergeCells(summaryStart + index, 1, summaryStart + index, 3);
    worksheet.getCell(summaryStart + index, 1).value = label;
  });

  payload.attributes.forEach((attribute, index) => {
    const column = measurementStartColumn + index;
    const letter = columnLetter(column);
    const range = `${letter}${firstDataRow}:${letter}${lastDataRow}`;
    const summary = numericSummaries[index];
    const formulas: Array<{ formula: string; result: number | string }> = [
      { formula: `IF(COUNT(${range})=0,"",MAX(${range}))`, result: summary.maximum ?? "" },
      { formula: `IF(COUNT(${range})=0,"",MIN(${range}))`, result: summary.minimum ?? "" },
      { formula: `IFERROR(AVERAGE(${range}),"")`, result: summary.average ?? "" },
      { formula: `IF(COUNT(${range})>1,STDEV.S(${range}),"")`, result: summary.standardDeviation ?? "" },
      { formula: `COUNT(${range})`, result: summary.entered },
      { formula: `IF(OR(${letter}$14="",${letter}$15=""),"",COUNTIFS(${range},"<="&${letter}$14,${range},">="&${letter}$15))`, result: summary.approved },
      { formula: `${letter}${summaryStart + 4}-${letter}${summaryStart + 5}`, result: summary.rejected },
    ];
    formulas.forEach((formula, formulaIndex) => {
      const cell = worksheet.getCell(summaryStart + formulaIndex, column);
      cell.value = formula;
      cell.numFmt = formulaIndex === 3 ? "0.000" : formulaIndex < 3 ? "0.000" : "0";
    });
  });

  [
    { column: visualColumn, summary: visualSummary },
    { column: functionalColumn, summary: functionalSummary },
  ].forEach(({ column, summary }) => {
    const letter = columnLetter(column);
    const range = `${letter}${firstDataRow}:${letter}${lastDataRow}`;
    worksheet.getCell(summaryStart + 4, column).value = { formula: `COUNTA(${range})`, result: summary.entered };
    worksheet.getCell(summaryStart + 5, column).value = { formula: `COUNTIF(${range},"Pass")`, result: summary.approved };
    worksheet.getCell(summaryStart + 6, column).value = { formula: `COUNTIF(${range},"Fail")`, result: summary.rejected };
  });

  const decisionStart = summaryStart + summaryRows.length + 2;
  worksheet.mergeCells(decisionStart, 1, decisionStart, lastColumn);
  worksheet.getCell(decisionStart, 1).value = "Inspection Decision";
  worksheet.getCell(decisionStart + 1, 1).value = "Disposition";
  worksheet.mergeCells(decisionStart + 1, 2, decisionStart + 1, middleColumn);
  worksheet.getCell(decisionStart + 1, 2).value = dispositionLabel(payload.approval.disposition);
  worksheet.getCell(decisionStart + 1, middleColumn + 1).value = "NC No.";
  worksheet.mergeCells(decisionStart + 1, middleColumn + 2, decisionStart + 1, lastColumn);
  worksheet.getCell(decisionStart + 1, Math.min(middleColumn + 2, lastColumn)).value = payload.approval.ncNumber;
  worksheet.getCell(decisionStart + 2, 1).value = "NC Decision";
  worksheet.mergeCells(decisionStart + 2, 2, decisionStart + 2, middleColumn);
  worksheet.getCell(decisionStart + 2, 2).value = ncDecisionLabel(payload.approval.ncDecision);
  worksheet.getCell(decisionStart + 2, middleColumn + 1).value = "Approved / Rejected Parts";
  worksheet.mergeCells(decisionStart + 2, middleColumn + 2, decisionStart + 2, lastColumn);
  worksheet.getCell(decisionStart + 2, Math.min(middleColumn + 2, lastColumn)).value = `${payload.approval.approvedParts || "—"} / ${payload.approval.rejectedParts || "—"}`;
  worksheet.getCell(decisionStart + 3, 1).value = "Special Conditions";
  worksheet.mergeCells(decisionStart + 3, 2, decisionStart + 3, lastColumn);
  worksheet.getCell(decisionStart + 3, 2).value = payload.approval.specialConditions;
  worksheet.getCell(decisionStart + 4, 1).value = "Inspector Name";
  worksheet.mergeCells(decisionStart + 4, 2, decisionStart + 4, middleColumn);
  worksheet.getCell(decisionStart + 4, 2).value = payload.approval.inspectorName;
  worksheet.getCell(decisionStart + 4, middleColumn + 1).value = "Date";
  worksheet.mergeCells(decisionStart + 4, middleColumn + 2, decisionStart + 4, lastColumn);
  worksheet.getCell(decisionStart + 4, Math.min(middleColumn + 2, lastColumn)).value = displayDate(payload.approval.inspectionDate);
  worksheet.getCell(decisionStart + 5, 1).value = "Reviewed and Approved by";
  worksheet.mergeCells(decisionStart + 5, 2, decisionStart + 5, middleColumn);
  worksheet.getCell(decisionStart + 5, 2).value = payload.approval.reviewerName;
  worksheet.getCell(decisionStart + 5, middleColumn + 1).value = "Date";
  worksheet.mergeCells(decisionStart + 5, middleColumn + 2, decisionStart + 5, lastColumn);
  worksheet.getCell(decisionStart + 5, Math.min(middleColumn + 2, lastColumn)).value = displayDate(payload.approval.reviewDate);

  for (let row = 2; row <= decisionStart + 5; row += 1) {
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = worksheet.getCell(row, column);
      cell.font = { name: "Arial", size: 10, bold: row >= 11 && row <= 15 };
      cell.alignment = cell.alignment?.textRotation ? cell.alignment : { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        left: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "thin", color: { argb: "FF94A3B8" } },
        right: { style: "thin", color: { argb: "FF94A3B8" } },
      };
    }
  }
  for (let row = 11; row <= 15; row += 1) {
    worksheet.getRow(row).height = 25;
    for (let column = 1; column <= lastColumn; column += 1) worksheet.getCell(row, column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: slate } };
  }
  for (let row = summaryStart; row < summaryStart + summaryRows.length; row += 1) {
    worksheet.getCell(row, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightSlate } };
    worksheet.getCell(row, 1).font = { name: "Arial", size: 10, bold: true };
  }
  worksheet.getCell(decisionStart, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
  worksheet.getCell(decisionStart, 1).font = { name: "Arial", size: 11, bold: true, color: { argb: white } };
  worksheet.pageSetup.printArea = `A1:${columnLetter(lastColumn)}${decisionStart + 5}`;
  worksheet.headerFooter.oddFooter = "Quality Task Manager · RIR";
  return workbook;
}
