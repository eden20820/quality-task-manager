import { NextResponse } from "next/server";
import { buildEcoFormPdf } from "@/lib/quality-forms/eco-form-pdf";
import { ecoFormIsSigned, isEcoFormPayload } from "@/lib/quality-forms/eco-form";
import { archiveQualityFormExport } from "@/lib/quality-forms/form-archive-server";
import { ECO_FORM_TITLE } from "@/lib/quality-forms/form-archive";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const payload: unknown = await request.json();
    if (!isEcoFormPayload(payload)) return NextResponse.json({ error: "נתוני טופס ECO אינם תקינים" }, { status: 400 });
    const bytes = await buildEcoFormPdf(payload);
    await archiveQualityFormExport({ bytes: new Uint8Array(bytes), supplierName: "ECO", date: payload.date, catalogNumber: payload.formNumber || payload.products[0].catalogNumber, extension: "pdf", mimeType: "application/pdf", formTitle: ECO_FORM_TITLE, formStatus: ecoFormIsSigned(payload) ? "signed" : "pending-signature" });
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=ECO.pdf", "Cache-Control": "no-store" } });
  } catch (error) { console.error("ECO export failed", error); return NextResponse.json({ error: "לא ניתן להפיק את טופס ECO כרגע" }, { status: 500 }); }
}
