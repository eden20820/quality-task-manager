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
  includeVisual: boolean;
  includeFunctional: boolean;
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

export function sampleSizeForReceivedQuantity(quantityText: string) {
  const quantity = Math.ceil(Number(quantityText.replace(/,/g, "").trim()));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (quantity === 1) return 1;
  const samplePlan = [
    { maximum: 8, sampleSize: 2 },
    { maximum: 15, sampleSize: 3 },
    { maximum: 25, sampleSize: 5 },
    { maximum: 50, sampleSize: 8 },
    { maximum: 90, sampleSize: 13 },
    { maximum: 150, sampleSize: 20 },
    { maximum: 280, sampleSize: 32 },
    { maximum: 500, sampleSize: 50 },
    { maximum: 1_200, sampleSize: 80 },
    { maximum: 3_200, sampleSize: 125 },
    { maximum: Number.POSITIVE_INFINITY, sampleSize: 200 },
  ];
  return samplePlan.find((entry) => quantity <= entry.maximum)?.sampleSize ?? 200;
}

export function evaluateMeasurementFormula(valueText: string) {
  const formula = valueText.trim();
  if (!formula.startsWith("=")) return null;
  const expression = formula.slice(1);
  if (!expression || !/^[\d+\-*/().\s]+$/.test(expression)) return null;
  let position = 0;

  const skipWhitespace = () => {
    while (/\s/.test(expression[position] ?? "")) position += 1;
  };
  const parseNumber = () => {
    skipWhitespace();
    const match = expression.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error("Invalid number");
    position += match[0].length;
    return Number(match[0]);
  };
  const parseFactor = (): number => {
    skipWhitespace();
    const operator = expression[position];
    if (operator === "+" || operator === "-") {
      position += 1;
      const value = parseFactor();
      return operator === "-" ? -value : value;
    }
    if (operator === "(") {
      position += 1;
      const value = parseExpression();
      skipWhitespace();
      if (expression[position] !== ")") throw new Error("Missing closing parenthesis");
      position += 1;
      return value;
    }
    return parseNumber();
  };
  const parseTerm = () => {
    let value = parseFactor();
    while (true) {
      skipWhitespace();
      const operator = expression[position];
      if (operator !== "*" && operator !== "/") break;
      position += 1;
      const operand = parseFactor();
      value = operator === "*" ? value * operand : value / operand;
    }
    return value;
  };
  function parseExpression() {
    let value = parseTerm();
    while (true) {
      skipWhitespace();
      const operator = expression[position];
      if (operator !== "+" && operator !== "-") break;
      position += 1;
      const operand = parseTerm();
      value = operator === "+" ? value + operand : value - operand;
    }
    return value;
  }

  try {
    const result = parseExpression();
    skipWhitespace();
    if (position !== expression.length || !Number.isFinite(result)) return null;
    return Number(result.toPrecision(12));
  } catch {
    return null;
  }
}

export function resolveMeasurementInput(valueText: string, equipment: string) {
  const formulaResult = evaluateMeasurementFormula(valueText);
  const resolved = formulaResult === null ? valueText : String(formulaResult);
  return formatMeasurementForEquipment(resolved, equipment);
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

