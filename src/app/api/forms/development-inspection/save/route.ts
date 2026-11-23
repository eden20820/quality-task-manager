import { NextResponse } from "next/server";
import { archiveQualityFormExport, FormArchiveError } from "@/lib/quality-forms/form-archive-server";
import { DEVELOPMENT_INSPECTION_FORM_TITLE } from "@/lib/quality-forms/form-archive";
import { getDevelopmentProducts, isDevelopmentInspectionPayload } from "@/lib/quality-forms/development-inspection";
import { buildDevelopmentInspectionPdf } from "@/lib/quality-forms/development-inspection-pdf";
import { createClient } from "@/lib/supabase/server";
import { sendDevelopmentInspectionToPurchasing } from "@/lib/email/development-inspection";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const body: unknown = await request.json();
    const wrapper = body && typeof body === "object" && "payload" in body ? body as { payload?: unknown; archiveId?: unknown } : null;
    const payload = wrapper?.payload ?? body;
    if (!isDevelopmentInspectionPayload(payload)) return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 });
    if (wrapper?.archiveId != null && typeof wrapper.archiveId !== "string") return NextResponse.json({ error: "מזהה הטופס אינו תקין" }, { status: 400 });
    const bytes = new Uint8Array(await buildDevelopmentInspectionPdf(payload));
    const formStatus = payload.checkedBySignature.trim() && payload.approvedBySignature.trim() ? "signed" : "pending-signature";
    const catalogNumber = getDevelopmentProducts(payload).find(product => product.catalogNumber.trim())?.catalogNumber ?? "";
    const archived = await archiveQualityFormExport({ bytes, supplierName: payload.supplierName, date: payload.date, catalogNumber, extension: "pdf", mimeType: "application/pdf", formTitle: DEVELOPMENT_INSPECTION_FORM_TITLE, formStatus, recheckPendingOnEdit: true, archiveId: typeof wrapper?.archiveId === "string" ? wrapper.archiveId : null });
    const purchasingStatus = await sendDevelopmentInspectionToPurchasing({ organizationId: archived.record.organization_id, payload, bytes, fileName: archived.fileName, pending: archived.formStatus === "pending-signature" }).catch(() => "failed" as const);
    if (purchasingStatus === "failed" || purchasingStatus === "unconfigured") console.error("Development inspection purchasing email", purchasingStatus, archived.id);
    return NextResponse.json({ saved: true, fileName: archived.fileName, archiveId: archived.id, emailStatus: archived.emailStatus, purchasingStatus, formStatus: archived.formStatus });
  } catch (error) {
    if (error instanceof FormArchiveError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Form save failed", error);
    return NextResponse.json({ error: "לא ניתן לשמור את הטופס כרגע" }, { status: 500 });
  }
}
