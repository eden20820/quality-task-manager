export type InspectionResult = "pass" | "fail" | "";

export type ShelfProductItem = {
  productName: string;
  catalogNumber: string;
  quantity: string;
};

export type ShelfProductInspectionPayload = {
  includeInspectorSignature?: boolean;
  includeApproverSignature?: boolean;
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

export function isShelfInspectionPayload(value: unknown): value is ShelfProductInspectionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ShelfProductInspectionPayload>;
  return Boolean(
    Array.isArray(payload.products)
    && payload.products.length > 0
    && payload.products.every((product) => typeof product.productName === "string" && typeof product.catalogNumber === "string" && typeof product.quantity === "string")
    && typeof payload.productName === "string"
    && typeof payload.catalogNumber === "string"
    && typeof payload.supplierName === "string"
    && typeof payload.quantity === "string"
    && typeof payload.batchNumber === "string"
    && typeof payload.receiptDate === "string"
    && payload.documents
    && Object.values(payload.documents).every((value) => typeof value === "boolean")
    && typeof payload.otherDocument === "string"
    && Array.isArray(payload.inspections)
    && payload.inspections.length === SHELF_INSPECTION_ITEMS.length
    && payload.inspections.every((item) => ["", "pass", "fail"].includes(item.result) && typeof item.comment === "string")
    && ["", "approved", "rejected", "conditional"].includes(payload.usageApproval ?? "")
    && typeof payload.notes === "string"
    && ["Eden Aharon", "Sergey Dror"].includes(payload.inspectorName ?? "")
    && typeof payload.inspectorDate === "string"
    && typeof payload.approverDate === "string"
    && (payload.includeInspectorSignature === undefined || typeof payload.includeInspectorSignature === "boolean")
    && (payload.includeApproverSignature === undefined || typeof payload.includeApproverSignature === "boolean")
  );
}
