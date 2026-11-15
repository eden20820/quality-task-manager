import { NextResponse } from "next/server";
import { archiveQualityFormExport, FormArchiveError } from "@/lib/quality-forms/form-archive-server";
import { ECO_FORM_TITLE } from "@/lib/quality-forms/form-archive";
import { ecoFormIsSigned, isEcoFormPayload } from "@/lib/quality-forms/eco-form";
import { buildEcoFormPdf } from "@/lib/quality-forms/eco-form-pdf";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const body: unknown = await request.json();
    const wrapper = body && typeof body === "object" && "payload" in body ? body as { payload?: unknown; archiveId?: unknown } : null;
    const payload = wrapper?.payload ?? body;
    if (!isEcoFormPayload(payload)) return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 });
    if (wrapper?.archiveId != null && typeof wrapper.archiveId !== "string") return NextResponse.json({ error: "מזהה הטופס אינו תקין" }, { status: 400 });
    const bytes = await buildEcoFormPdf(payload);
    const formStatus = ecoFormIsSigned(payload) ? "signed" : "pending-signature";
    const archived = await archiveQualityFormExport({ bytes: new Uint8Array(bytes), supplierName: "ECO", date: payload.date, catalogNumber: payload.formNumber || payload.products[0].catalogNumber, extension: "pdf", mimeType: "application/pdf", formTitle: ECO_FORM_TITLE, formStatus, archiveId: typeof wrapper?.archiveId === "string" ? wrapper.archiveId : null });
    return NextResponse.json({ saved: true, fileName: archived.fileName, archiveId: archived.id, emailStatus: archived.emailStatus, formStatus: archived.formStatus });
  } catch (error) {
    if (error instanceof FormArchiveError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Form save failed", error);
    return NextResponse.json({ error: "לא ניתן לשמור את הטופס כרגע" }, { status: 500 });
  }
}
