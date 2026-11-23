import "server-only";

import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

import { buildArchivedFormDescription, buildQualityFormFileName, ONLINE_FORM_CATEGORY, parseArchivedFormDescription, type QualityFormStatus } from "./form-archive";
import { sendPendingFormAlerts, type FormEmailStatus } from "@/lib/email/pending-form";

export class FormArchiveError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

export async function archiveQualityFormExport(input: {
  bytes: Uint8Array;
  supplierName: string;
  date: string;
  catalogNumber: string;
  extension: string;
  mimeType: string;
  formTitle: string;
  formStatus?: QualityFormStatus;
  archiveId?: string | null;
  recheckPendingOnEdit?: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) throw new Error("ARCHIVE_AUTH_REQUIRED");

  let previous: { id: string; description: string | null; storage_path: string; organization_id: string } | null = null;
  if (input.archiveId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.archiveId)) throw new FormArchiveError("מזהה הטופס אינו תקין", 400);
    const { data: source, error } = await supabase.from("quality_documents").select("id, description, storage_path, organization_id").eq("id", input.archiveId).eq("category", ONLINE_FORM_CATEGORY).maybeSingle();
    if (error || !source || parseArchivedFormDescription(source.description).title !== input.formTitle) throw new FormArchiveError("הטופס המקורי אינו זמין לעריכה. יש לרענן את המאגר", 404);
    previous = source;
  }
  // Manual archive is not a signature and survives subsequent unsigned edits.
  const previousStatus = previous ? parseArchivedFormDescription(previous.description).status : undefined;
  const formStatus = !input.recheckPendingOnEdit && input.formStatus !== "signed" && previousStatus === "archived" ? "archived" : input.formStatus;

  const fileName = buildQualityFormFileName(input);
  const storagePath = `${userId}/form-exports/${Date.now()}-${randomUUID()}.${input.extension.replace(/^\./, "").toLowerCase()}`;
  const { error: uploadError } = await supabase.storage.from("quality-documents").upload(storagePath, input.bytes, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error(`ARCHIVE_UPLOAD_FAILED: ${uploadError.message}`);

  const archiveTitle = fileName.replace(/\.[^.]+$/, "").slice(0, 200);
  const values = {
    ...(previous ? { organization_id: previous.organization_id } : {}),
    title: archiveTitle,
    category: ONLINE_FORM_CATEGORY,
    description: buildArchivedFormDescription(input.formTitle, formStatus),
    file_name: fileName,
    file_size: input.bytes.byteLength,
    mime_type: input.mimeType,
    storage_path: storagePath,
    uploaded_by: userId,
  };
  const { data: record, error: insertError } = await supabase.from("quality_documents").insert(values).select("id, title, description, file_name, file_size, mime_type, storage_path, created_at, organization_id").single();
  if (insertError || !record) {
    await supabase.storage.from("quality-documents").remove([storagePath]);
    throw new Error(`ARCHIVE_RECORD_FAILED: ${insertError?.message ?? "No row returned"}`);
  }
  if (previous) {
    // Use the existing RLS-authorized insert/delete workflow. Never claim success
    // while a superseded pending record remains. CAS protects concurrent edits.
    const { data: removed, error } = await supabase.from("quality_documents").delete().eq("id", previous.id).eq("category", ONLINE_FORM_CATEGORY).eq("storage_path", previous.storage_path).eq("description", previous.description).select("id");
    if (error || !removed?.length) {
      const rollback = await supabase.from("quality_documents").delete().eq("id", record.id).eq("category", ONLINE_FORM_CATEGORY).select("id");
      if (!rollback.error && rollback.data?.length) await supabase.storage.from("quality-documents").remove([storagePath]);
      else console.error("Replacement archive rollback requires cleanup", record.id);
      throw new FormArchiveError("הטופס השתנה או שלא ניתן להסיר את הגרסה הקודמת. השמירה לא הושלמה; יש לרענן ולנסות שוב");
    }
    const cleanup = await supabase.storage.from("quality-documents").remove([previous.storage_path]);
    if (cleanup.error) console.error("Replaced archive storage cleanup failed", previous.id);
  }
  let emailStatus: FormEmailStatus = "skipped";
  if (formStatus === "pending-signature" && (!previous || (input.recheckPendingOnEdit && previousStatus !== "pending-signature"))) {
    try { emailStatus = await sendPendingFormAlerts({ ...input, organizationId: record.organization_id }); }
    catch { emailStatus = "failed"; }
  }
  return { fileName, storagePath, id: record.id, record, formStatus, emailStatus };
}
