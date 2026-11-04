export type InspectionResult = "pass" | "fail" | "";

export type ShelfProductItem = {
  productName: string;
  catalogNumber: string;
  quantity: string;
};

export type ShelfProductInspectionPayload = {
  products: ShelfProductItem[];
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

export function normalizeShelfInspection(payload: ShelfProductInspectionPayload): ShelfProductInspectionPayload {
  const products = Array.isArray(payload.products) && payload.products.length
    ? payload.products.map((item) => ({ productName: item.productName ?? "", catalogNumber: item.catalogNumber ?? "", quantity: item.quantity ?? "" }))
    : [{ productName: payload.productName ?? "", catalogNumber: payload.catalogNumber ?? "", quantity: payload.quantity ?? "" }];
  return { ...payload, products, productName: products[0].productName, catalogNumber: products[0].catalogNumber, quantity: products[0].quantity };
}

export const SHELF_INSPECTION_ITEMS = [
  "בדיקת שלמות האריזה (נזק פיזי, פתיחה, קרעים)",
  "בדיקת תווית/סימון על האריזה (מק״ט, מספר אצווה, תאריך ייצור/תפוגה)",
  "התאמה בין פרטי האריזה לבין המסמך הנלווה (COC/COA)",
  "בדיקת התאמה להזמנה/תעודת משלוח (כמות, מק״ט, דגם)",
] as const;

export function createEmptyShelfInspection(today: string): ShelfProductInspectionPayload {
  return {
    products: [{ productName: "", catalogNumber: "", quantity: "" }],
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
