import { DocumentsCenter, type DocumentRow } from "@/components/documents/documents-center";
import { PaginationControls } from "@/components/pagination-controls";
import { PAGE_SIZE, pageRange, parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("quality_documents")
    .select("id, title, category, description, file_name, file_size, mime_type, storage_path, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) console.error("Load documents error:", error);

  return <div className="space-y-5">
    <DocumentsCenter key={page} initialDocuments={(data ?? []) as DocumentRow[]} />
    <PaginationControls basePath="/documents" page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
  </div>;
}
