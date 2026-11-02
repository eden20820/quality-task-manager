import { NextResponse } from "next/server";

import { buildShelfProductInspectionDocx } from "@/lib/quality-forms/shelf-product-docx";
import { archiveQualityFormExport } from "@/lib/quality-forms/form-archive-server";
import { SHELF_INSPECTION_ITEMS, type ShelfProductInspectionPayload } from "@/lib/quality-forms/shelf-product-inspection";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isValidPayload(value: unknown): value is ShelfProductInspectionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ShelfProductInspectionPayload>;
  return Boolean(
    typeof payload.productName === "string"
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
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });

  try {
    const payload: unknown = await request.json();
    if (!isValidPayload(payload)) return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 });
    const buffer = await buildShelfProductInspectionDocx(payload);
    const bytes = new Uint8Array(buffer);
    const { fileName } = await archiveQualityFormExport({
      bytes,
      supplierName: payload.supplierName,
      date: payload.receiptDate,
      catalogNumber: payload.catalogNumber,
      extension: "docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      formTitle: "טופס ביקורת קבלה למוצר מדף",
    });
    return new Response(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="shelf-product-inspection.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Shelf product inspection export failed", error);
    return NextResponse.json({ error: "לא ניתן ליצור ולשמור את מסמך ה-Word כרגע" }, { status: 500 });
  }
}
