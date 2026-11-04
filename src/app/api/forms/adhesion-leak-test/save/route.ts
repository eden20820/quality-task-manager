import { NextResponse } from "next/server";

import { sendAdhesionLeakTestAlerts } from "@/lib/email/adhesion-leak-test";
import { archiveQualityFormExport } from "@/lib/quality-forms/form-archive-server";
import { isAdhesionLeakTestPayload } from "@/lib/quality-forms/adhesion-leak-test";
import { buildAdhesionLeakTestPdf } from "@/lib/quality-forms/adhesion-leak-test-pdf";
import { ADHESION_LEAK_TEST_FORM_TITLE, ONLINE_FORM_CATEGORY } from "@/lib/quality-forms/form-archive";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function removePreviousArchive(archiveId: string) {
  const supabase = await createClient();
  const { data: record, error: loadError } = await supabase
    .from("quality_documents")
    .select("storage_path")
    .eq("id", archiveId)
    .eq("category", ONLINE_FORM_CATEGORY)
    .maybeSingle();
  if (loadError || !record) return;
  const { error: deleteError } = await supabase.from("quality_documents").delete().eq("id", archiveId).eq("category", ONLINE_FORM_CATEGORY);
  if (deleteError) {
    console.error("Could not remove previous adhesion form archive record", deleteError);
    return;
  }
  const { error: storageError } = await supabase.storage.from("quality-documents").remove([record.storage_path]);
  if (storageError) console.error("Could not remove previous adhesion form archive file", storageError);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const body: unknown = await request.json();
    const isWrapper = typeof body === "object" && body !== null && "payload" in body;
    const wrapper = isWrapper ? body as { payload?: unknown; archiveId?: unknown } : null;
    const payload: unknown = wrapper ? wrapper.payload : body;
    const archiveId = typeof wrapper?.archiveId === "string" ? wrapper.archiveId : null;
    if (!isAdhesionLeakTestPayload(payload)) return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 });
    const formStatus = payload.checkedBySignature && payload.approvedBySignature ? "signed" : "pending-signature";
    const buffer = await buildAdhesionLeakTestPdf(payload);
    const archived = await archiveQualityFormExport({
      bytes: new Uint8Array(buffer),
      supplierName: "בדיקת-אטימות",
      date: payload.testDate,
      catalogNumber: payload.testedProduct || "ללא-מוצר",
      extension: "pdf",
      mimeType: "application/pdf",
      formTitle: ADHESION_LEAK_TEST_FORM_TITLE,
      formStatus,
    });
    if (archiveId) await removePreviousArchive(archiveId);
    const emails = await sendAdhesionLeakTestAlerts(payload);
    const sent = emails.filter((email) => email.status === "sent").length;
    const emailStatus = sent === emails.length ? "sent" : sent > 0 ? "partial" : "failed";
    return NextResponse.json({ saved: true, fileName: archived.fileName, emailStatus, formStatus });
  } catch (error) {
    console.error("Adhesion leak test save failed", error);
    return NextResponse.json({ error: "לא ניתן לשמור את הטופס כרגע" }, { status: 500 });
  }
}
