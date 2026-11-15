import { NextResponse } from "next/server";
import { isPendingSignatureDescription, ONLINE_FORM_CATEGORY, parseArchivedFormDescription } from "@/lib/quality-forms/form-archive";
import { archiveQualityFormExport, FormArchiveError } from "@/lib/quality-forms/form-archive-server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "מזהה טופס אינו תקין" }, { status: 400 });
  try {
    const body = await request.json();
    if (body?.action !== "archive-without-signature") return NextResponse.json({ error: "פעולה אינה תקינה" }, { status: 400 });
    const { data: form, error } = await supabase.from("quality_documents").select("id, description, storage_path, file_name, mime_type, file_size").eq("id", id).eq("category", ONLINE_FORM_CATEGORY).maybeSingle();
    if (error) throw error;
    if (!form) return NextResponse.json({ error: "הטופס לא נמצא או שאין הרשאה אליו" }, { status: 404 });
    if (!isPendingSignatureDescription(form.description)) return NextResponse.json({ error: "הטופס כבר אינו ממתין לחתימה. יש לרענן את המאגר" }, { status: 409 });
    if (form.file_size > 10_000_000) return NextResponse.json({ error: "הקובץ גדול מדי להעברה" }, { status: 413 });
    const { data: file, error: loadError } = await supabase.storage.from("quality-documents").download(form.storage_path);
    if (loadError || !file) throw new Error("Could not load archive file");
    if (file.size > 10_000_000) return NextResponse.json({ error: "הקובץ גדול מדי להעברה" }, { status: 413 });
    const match = form.file_name.match(/^(.*?)_(\d{4}-\d{2}-\d{2}|ללא-תאריך)_(.+)\.([^.]+)$/);
    const extension = form.file_name.split(".").at(-1)?.toLowerCase();
    if (!extension || !["pdf", "docx", "xlsx"].includes(extension)) return NextResponse.json({ error: "סוג טופס אינו נתמך" }, { status: 400 });
    const archived = await archiveQualityFormExport({ bytes: new Uint8Array(await file.arrayBuffer()), supplierName: match?.[1] || "טופס", date: match?.[2] || "", catalogNumber: match?.[3] || form.file_name, extension, mimeType: form.mime_type || file.type || "application/octet-stream", formTitle: parseArchivedFormDescription(form.description).title, formStatus: "archived", archiveId: id });
    return NextResponse.json({ archived: true, record: archived.record });
  } catch (error) {
    if (error instanceof FormArchiveError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Manual form archive failed", error);
    return NextResponse.json({ error: "לא ניתן להעביר את הטופס למאגר כרגע" }, { status: 500 });
  }
}

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
