import { NextResponse } from "next/server";
import { archiveQualityFormExport } from "@/lib/quality-forms/form-archive-server";
import { DEVELOPMENT_INSPECTION_FORM_TITLE, ONLINE_FORM_CATEGORY } from "@/lib/quality-forms/form-archive";
import { isDevelopmentInspectionPayload } from "@/lib/quality-forms/development-inspection";
import { buildDevelopmentInspectionPdf } from "@/lib/quality-forms/development-inspection-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
async function removePreviousArchive(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("quality_documents").select("storage_path").eq("id", id).eq("category", ONLINE_FORM_CATEGORY).maybeSingle();
  if (!data) return;
  const { error } = await supabase.from("quality_documents").delete().eq("id", id).eq("category", ONLINE_FORM_CATEGORY);
  if (!error) await supabase.storage.from("quality-documents").remove([data.storage_path]);
}
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const body: unknown = await request.json(); const wrapper = body && typeof body === "object" && "payload" in body ? body as { payload?: unknown; archiveId?: unknown } : null; const payload = wrapper?.payload ?? body;
    if (!isDevelopmentInspectionPayload(payload)) return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 });
    const status = payload.checkedBySignature && payload.approvedBySignature ? "signed" : "pending-signature";
    const bytes = await buildDevelopmentInspectionPdf(payload);
    const archived = await archiveQualityFormExport({ bytes: new Uint8Array(bytes), supplierName: payload.supplierName, date: payload.date, catalogNumber: payload.catalogNumber, extension: "pdf", mimeType: "application/pdf", formTitle: DEVELOPMENT_INSPECTION_FORM_TITLE, formStatus: status });
    if (typeof wrapper?.archiveId === "string") await removePreviousArchive(wrapper.archiveId);
    return NextResponse.json({ saved: true, fileName: archived.fileName, formStatus: status });
  } catch (error) { console.error("Development inspection save failed", error); return NextResponse.json({ error: "לא ניתן לשמור את הטופס כרגע" }, { status: 500 }); }
}
