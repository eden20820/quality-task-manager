import { NextResponse } from "next/server";
import { isShelfInspectionPayload } from "@/lib/quality-forms/shelf-product-inspection";
import { saveShelfProductForm } from "@/lib/quality-forms/shelf-product-save";
import { FormArchiveError } from "@/lib/quality-forms/form-archive-server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const body = await request.json();
    const payload: unknown = body?.payload ?? body;
    if (!isShelfInspectionPayload(payload)) return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 });
    if (body?.archiveId != null && typeof body.archiveId !== "string") return NextResponse.json({ error: "מזהה הטופס אינו תקין" }, { status: 400 });
    const archived = await saveShelfProductForm(payload, body?.archiveId ?? null);
    return NextResponse.json({ saved: true, fileName: archived.fileName, archiveId: archived.id, formStatus: archived.formStatus, emailStatus: archived.emailStatus });
  } catch (error) {
    if (error instanceof FormArchiveError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Shelf form save failed", error);
    return NextResponse.json({ error: "לא ניתן לשמור את הטופס כרגע" }, { status: 500 });
  }
}
