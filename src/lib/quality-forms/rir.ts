export type RirPassFail = "" | "Pass" | "Fail";

export type RirDetails = {
  catalogNumber: string;
  partName: string;
  supplierName: string;
  receivedQuantity: string;
  orderNumber: string;
  lotNumber: string;
  drawingNumber: string;
  drawingRevision: string;
  comments: string;
  documents: { coc: boolean; cot: boolean; coa: boolean; other: boolean };
  otherDocument: string;
};

export type RirApproval = {
  disposition: "" | "approved" | "hold" | "rejected" | "special";
  ncNumber: string;
  ncDecision: "" | "accept" | "reject" | "rework";
  specialConditions: string;
  approvedParts: string;
  rejectedParts: string;
  inspectorName: string;
  inspectionDate: string;
  reviewerName: string;
  reviewDate: string;
};

export type RirAttribute = {
  id: string;
  name: string;
  equipment: string;
  min: string;
  max: string;
};

export type RirMeasurementRow = {
  specimen: number;
  values: string[];
  visual: RirPassFail;
  functional: RirPassFail;
};

export type RirColumnSummary = {
  entered: number;
  maximum: number | null;
  minimum: number | null;
  average: number | null;
  standardDeviation: number | null;
  approved: number;
  rejected: number;
};

export type RirFormPayload = {
  details: RirDetails;
  attributes: RirAttribute[];
  rows: RirMeasurementRow[];
  approval: RirApproval;
  sampleSize: number;
};

export const RIR_DRAFT_STORAGE_KEY = "quality-task-manager:rir-draft:v1";

export function drawingNumberForCatalog(catalogNumber: string) {
  const normalized = catalogNumber.trim();
  return normalized ? `DG-${normalized}` : "";
}

export function isCaliperEquipment(equipment: string) {
  return /(^|\s)caliper(\s|$)/i.test(equipment.trim()) || equipment.trim() === "קליבר";
}

export function formatMeasurementForEquipment(valueText: string, equipment: string) {
  const normalized = valueText.trim();
  if (!normalized || !isCaliperEquipment(equipment)) return valueText;
  const value = Number(normalized);
  return Number.isFinite(value) ? value.toFixed(2) : valueText;
}

export function resizeMeasurementRows(
  current: RirMeasurementRow[],
  sampleSize: number,
  attributeCount: number,
) {
  return Array.from({ length: sampleSize }, (_, index) => {
    const previous = current[index];
    return {
      specimen: index + 1,
      values: Array.from({ length: attributeCount }, (__, valueIndex) => previous?.values[valueIndex] ?? ""),
      visual: previous?.visual ?? "",
      functional: previous?.functional ?? "",
    } satisfies RirMeasurementRow;
  });
}

function numericValues(rows: RirMeasurementRow[], index: number) {
  return rows.flatMap((row) => {
    const value = row.values[index]?.trim();
    if (!value) return [];
    const number = Number(value);
    return Number.isFinite(number) ? [number] : [];
  });
}

export function sampleStandardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + ((value - average) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function summarizeMeasurementColumn(
  rows: RirMeasurementRow[],
  index: number,
  minimumText: string,
  maximumText: string,
): RirColumnSummary {
  const values = numericValues(rows, index);
  const minimum = Number(minimumText);
  const maximum = Number(maximumText);
  const hasLimits = minimumText.trim() !== "" && maximumText.trim() !== "" && Number.isFinite(minimum) && Number.isFinite(maximum);
  const approved = hasLimits ? values.filter((value) => value >= minimum && value <= maximum).length : 0;

  return {
    entered: values.length,
    maximum: values.length ? Math.max(...values) : null,
    minimum: values.length ? Math.min(...values) : null,
    average: values.length ? values.reduce((total, value) => total + value, 0) / values.length : null,
    standardDeviation: sampleStandardDeviation(values),
    approved,
    rejected: hasLimits ? values.length - approved : 0,
  };
}

export function summarizePassFail(rows: RirMeasurementRow[], key: "visual" | "functional") {
  let approved = 0;
  let rejected = 0;
  for (const row of rows) {
    if (row[key] === "Pass") approved += 1;
    if (row[key] === "Fail") rejected += 1;
  }
  return { entered: approved + rejected, approved, rejected };
}

export function measurementState(valueText: string, minimumText: string, maximumText: string) {
  if (!valueText.trim()) return "missing" as const;
  const value = Number(valueText);
  const minimum = Number(minimumText);
  const maximum = Number(maximumText);
  if (!Number.isFinite(value)) return "invalid" as const;
  if (!minimumText.trim() || !maximumText.trim() || !Number.isFinite(minimum) || !Number.isFinite(maximum)) return "unconfigured" as const;
  return value >= minimum && value <= maximum ? "pass" as const : "fail" as const;
}

