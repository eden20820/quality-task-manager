import { NextResponse } from "next/server";
import { isPendingSignatureDescription, ONLINE_FORM_CATEGORY } from "@/lib/quality-forms/form-archive";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "מזהה טופס אינו תקין" }, { status: 400 });
  try {
    const { data: form, error } = await supabase.from("quality_documents").select("id, description, storage_path")
      .eq("id", id).eq("category", ONLINE_FORM_CATEGORY).maybeSingle();
    if (error) throw error;
    if (!form) return NextResponse.json({ error: "הטופס לא נמצא או שאין הרשאה למחוק אותו" }, { status: 404 });
    if (!isPendingSignatureDescription(form.description)) return NextResponse.json({ error: "אפשר למחוק כאן רק טפסים שממתינים לחתימה" }, { status: 409 });
    // Both operations use the session client: organization and storage RLS apply.
    // Match the status snapshot too, so a concurrently signed form is not deleted.
    const { data: removed, error: deleteError } = await supabase.from("quality_documents").delete()
      .eq("id", id).eq("category", ONLINE_FORM_CATEGORY).eq("description", form.description).select("id");
    if (deleteError) throw deleteError;
    if (!removed?.length) return NextResponse.json({ error: "הטופס השתנה או שאין הרשאה למחוק אותו. יש לרענן ולנסות שוב" }, { status: 409 });
    const { error: storageError } = await supabase.storage.from("quality-documents").remove([form.storage_path]);
    if (storageError) console.error("Deleted form storage cleanup failed", storageError);
    return NextResponse.json({ deleted: true, cleanupPending: Boolean(storageError) });
  } catch (error) {
    console.error("Pending form deletion failed", error);
    return NextResponse.json({ error: "לא ניתן למחוק את הטופס כרגע" }, { status: 500 });
  }
}
