import { DocumentsCenter, type DocumentRow } from "@/components/documents/documents-center";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quality_documents")
    .select("id, title, category, description, file_name, file_size, mime_type, storage_path, created_at")
    .order("created_at", { ascending: false });

  if (error) console.error("Load documents error:", error);

  return <DocumentsCenter initialDocuments={(data ?? []) as DocumentRow[]} />;
}
