import { NextResponse } from "next/server";

import { buildShelfProductInspectionDocx } from "@/lib/quality-forms/shelf-product-docx";
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
    const safeName = payload.catalogNumber.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "shelf-product-inspection";
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeName}.docx"`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Shelf product inspection export failed", error);
    return NextResponse.json({ error: "לא ניתן ליצור את מסמך ה-Word כרגע" }, { status: 500 });
  }
}
