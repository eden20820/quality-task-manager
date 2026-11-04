export type BinaryChoice = "yes" | "no" | "";
export type ConformityResult = "pass" | "fail" | "";
export type GeneralConformity = "conforms" | "gap" | "";
export type DevelopmentFinalStatus = "approved" | "approved-deviation" | "rework" | "on-hold" | "design-improvement" | "other" | "";

export type DevelopmentInspectionRow = {
  characteristic: string;
  requirement: string;
  inspectionMethod: string;
  actualResult: string;
  conformity: ConformityResult;
};

export type DevelopmentInspectionPayload = {
  date: string;
  supplierName: string;
  catalogNumber: string;
  itemDescription: string;
  drawingNumber: string;
  revision: string;
  receivedQuantity: string;
  inspectedQuantity: string;
  documents: { coc: boolean; inspectionReport: boolean; none: boolean };
  visualChecks: { packageIntegrity: boolean; marking: boolean; validity: boolean };
  visualNotes: string;
  drawingRows: DevelopmentInspectionRow[];
  generalConformity: GeneralConformity;
  gapDetails: string;
  nonconformityFound: BinaryChoice;
  deviationActions: { developmentUse: boolean; rework: boolean; returnToSupplier: boolean; nonconformityOpened: boolean };
  nonconformityNumber: string;
  finalStatus: DevelopmentFinalStatus;
  designImprovementDetails: string;
  otherStatusDetails: string;
  checkedByName: string;
  checkedByDate: string;
  checkedBySignature: string;
  approvedByName: string;
  approvedByDate: string;
  approvedBySignature: string;
};

const emptyDrawingRow = (): DevelopmentInspectionRow => ({ characteristic: "", requirement: "", inspectionMethod: "", actualResult: "", conformity: "" });

export function createEmptyDevelopmentInspection(today: string): DevelopmentInspectionPayload {
  return {
    date: today, supplierName: "", catalogNumber: "", itemDescription: "", drawingNumber: "", revision: "", receivedQuantity: "", inspectedQuantity: "",
    documents: { coc: false, inspectionReport: false, none: false },
    visualChecks: { packageIntegrity: false, marking: false, validity: false },
    visualNotes: "", drawingRows: [emptyDrawingRow(), emptyDrawingRow(), emptyDrawingRow()], generalConformity: "", gapDetails: "", nonconformityFound: "",
    deviationActions: { developmentUse: false, rework: false, returnToSupplier: false, nonconformityOpened: false },
    nonconformityNumber: "", finalStatus: "", designImprovementDetails: "", otherStatusDetails: "",
    checkedByName: "", checkedByDate: today, checkedBySignature: "", approvedByName: "", approvedByDate: today, approvedBySignature: "",
  };
}

export function isDevelopmentInspectionPayload(value: unknown): value is DevelopmentInspectionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  const strings = ["date", "supplierName", "catalogNumber", "itemDescription", "drawingNumber", "revision", "receivedQuantity", "inspectedQuantity", "visualNotes", "gapDetails", "nonconformityNumber", "designImprovementDetails", "otherStatusDetails", "checkedByName", "checkedByDate", "checkedBySignature", "approvedByName", "approvedByDate", "approvedBySignature"];
  const booleanRecord = (item: unknown, keys: string[]) => Boolean(item && typeof item === "object" && keys.every((key) => typeof (item as Record<string, unknown>)[key] === "boolean"));
  return strings.every((field) => typeof payload[field] === "string")
    && booleanRecord(payload.documents, ["coc", "inspectionReport", "none"])
    && booleanRecord(payload.visualChecks, ["packageIntegrity", "marking", "validity"])
    && booleanRecord(payload.deviationActions, ["developmentUse", "rework", "returnToSupplier", "nonconformityOpened"])
    && Array.isArray(payload.drawingRows) && payload.drawingRows.length === 3
    && payload.drawingRows.every((row) => row && typeof row === "object" && ["characteristic", "requirement", "inspectionMethod", "actualResult"].every((key) => typeof (row as Record<string, unknown>)[key] === "string") && ["", "pass", "fail"].includes(String((row as Record<string, unknown>).conformity)))
    && ["", "conforms", "gap"].includes(String(payload.generalConformity))
    && ["", "yes", "no"].includes(String(payload.nonconformityFound))
    && ["", "approved", "approved-deviation", "rework", "on-hold", "design-improvement", "other"].includes(String(payload.finalStatus))
    && String(payload.checkedBySignature).length < 1_500_000 && String(payload.approvedBySignature).length < 1_500_000;
}
