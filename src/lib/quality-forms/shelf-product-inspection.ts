export type InspectionResult = "pass" | "fail" | "";

export type ShelfProductInspectionPayload = {
  productName: string;
  catalogNumber: string;
  supplierName: string;
  quantity: string;
  batchNumber: string;
  receiptDate: string;
  documents: { coc: boolean; coa: boolean; cot: boolean; other: boolean };
  otherDocument: string;
  inspections: Array<{ result: InspectionResult; comment: string }>;
  usageApproval: "approved" | "rejected" | "conditional" | "";
  notes: string;
  inspectorName: "Eden Aharon" | "Sergey Dror";
  inspectorDate: string;
  approverDate: string;
};

export const SHELF_INSPECTION_ITEMS = [
  "בדיקת שלמות האריזה (נזק פיזי, פתיחה, קרעים)",
  "בדיקת תווית/סימון על האריזה (מק״ט, מספר אצווה, תאריך ייצור/תפוגה)",
  "התאמה בין פרטי האריזה לבין המסמך הנלווה (COC/COA)",
  "בדיקת התאמה להזמנה/תעודת משלוח (כמות, מק״ט, דגם)",
] as const;

export function createEmptyShelfInspection(today: string): ShelfProductInspectionPayload {
  return {
    productName: "",
    catalogNumber: "",
    supplierName: "",
    quantity: "",
    batchNumber: "",
    receiptDate: today,
    documents: { coc: false, coa: false, cot: false, other: false },
    otherDocument: "",
    inspections: SHELF_INSPECTION_ITEMS.map(() => ({ result: "", comment: "" })),
    usageApproval: "",
    notes: "",
    inspectorName: "Eden Aharon",
    inspectorDate: today,
    approverDate: today,
  };
}
