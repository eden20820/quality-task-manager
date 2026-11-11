import { NextResponse } from "next/server";
import { buildEcoFormPdf } from "@/lib/quality-forms/eco-form-pdf";
import { ecoFormIsSigned, isEcoFormPayload } from "@/lib/quality-forms/eco-form";
import { archiveQualityFormExport } from "@/lib/quality-forms/form-archive-server";
import { ECO_FORM_TITLE, ONLINE_FORM_CATEGORY, isEcoFormDescription } from "@/lib/quality-forms/form-archive";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const body: unknown = await request.json();
    const wrapper = body && typeof body === "object" && "payload" in body ? body as { payload: unknown; archiveId?: unknown } : null;
    const payload = wrapper?.payload ?? body;
    if (!isEcoFormPayload(payload)) return NextResponse.json({ error: "נתוני טופס ECO אינם תקינים" }, { status: 400 });
    const bytes = await buildEcoFormPdf(payload);
    const status = ecoFormIsSigned(payload) ? "signed" : "pending-signature";
    const result = await archiveQualityFormExport({ bytes: new Uint8Array(bytes), supplierName: "ECO", date: payload.date, catalogNumber: payload.formNumber || payload.products[0].catalogNumber, extension: "pdf", mimeType: "application/pdf", formTitle: ECO_FORM_TITLE, formStatus: status });
    // Organization and storage RLS remain in force; only replace an ECO record.
    if (typeof wrapper?.archiveId === "string") {
      const { data: old } = await supabase.from("quality_documents").select("description, storage_path").eq("id", wrapper.archiveId).eq("category", ONLINE_FORM_CATEGORY).maybeSingle();
      if (old && isEcoFormDescription(old.description)) {
        const { error } = await supabase.from("quality_documents").delete().eq("id", wrapper.archiveId).eq("category", ONLINE_FORM_CATEGORY).eq("description", old.description);
        if (!error) await supabase.storage.from("quality-documents").remove([old.storage_path]);
      }
    }
    return NextResponse.json({ saved: true, fileName: result.fileName, formStatus: status });
  } catch (error) { console.error("ECO save failed", error); return NextResponse.json({ error: "לא ניתן לשמור את טופס ECO כרגע" }, { status: 500 }); }
}
