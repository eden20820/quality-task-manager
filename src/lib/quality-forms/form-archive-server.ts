import "server-only";

import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

import { buildArchivedFormDescription, buildQualityFormFileName, ONLINE_FORM_CATEGORY, type QualityFormStatus } from "./form-archive";

export async function archiveQualityFormExport(input: {
  bytes: Uint8Array;
  supplierName: string;
  date: string;
  catalogNumber: string;
  extension: string;
  mimeType: string;
  formTitle: string;
  formStatus?: QualityFormStatus;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) throw new Error("ARCHIVE_AUTH_REQUIRED");

  const fileName = buildQualityFormFileName(input);
  const storagePath = `${userId}/form-exports/${Date.now()}-${randomUUID()}.${input.extension.replace(/^\./, "").toLowerCase()}`;
  const { error: uploadError } = await supabase.storage.from("quality-documents").upload(storagePath, input.bytes, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error(`ARCHIVE_UPLOAD_FAILED: ${uploadError.message}`);

  const archiveTitle = fileName.replace(/\.[^.]+$/, "").slice(0, 200);
  const { error: insertError } = await supabase.from("quality_documents").insert({
    title: archiveTitle,
    category: ONLINE_FORM_CATEGORY,
    description: buildArchivedFormDescription(input.formTitle, input.formStatus),
    file_name: fileName,
    file_size: input.bytes.byteLength,
    mime_type: input.mimeType,
    storage_path: storagePath,
    uploaded_by: userId,
  });
  if (insertError) {
    await supabase.storage.from("quality-documents").remove([storagePath]);
    throw new Error(`ARCHIVE_RECORD_FAILED: ${insertError.message}`);
  }

  return { fileName, storagePath };
}
