import "server-only";
import { archiveQualityFormExport } from "./form-archive-server";
import { SHELF_INSPECTION_FORM_TITLE } from "./form-archive";
import { buildShelfProductInspectionDocx } from "./shelf-product-docx";
import type { ShelfProductInspectionPayload } from "./shelf-product-inspection";

export async function saveShelfProductForm(payload: ShelfProductInspectionPayload, archiveId: string | null) {
  const bytes = new Uint8Array(await buildShelfProductInspectionDocx(payload));
  const archived = await archiveQualityFormExport({ bytes, supplierName: payload.supplierName, date: payload.receiptDate, catalogNumber: payload.catalogNumber, extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", formTitle: SHELF_INSPECTION_FORM_TITLE, formStatus: payload.includeInspectorSignature !== false && payload.includeApproverSignature !== false ? "signed" : "pending-signature", archiveId });
  return { bytes, ...archived };
}
