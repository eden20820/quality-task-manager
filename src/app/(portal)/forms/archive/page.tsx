import { FormsNavigation } from "@/components/quality-forms/forms-navigation";
import { QualityFormArchive, type QualityFormArchiveRow } from "@/components/quality-forms/quality-form-archive";
import { ONLINE_FORM_CATEGORY } from "@/lib/quality-forms/form-archive";
import { createPortalClient as createClient } from "@/lib/auth/portal-client";

export default async function QualityFormArchivePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quality_documents").select("id, title, description, file_name, file_size, mime_type, storage_path, created_at").eq("category", ONLINE_FORM_CATEGORY).order("created_at", { ascending: false }).limit(250);
  if (error) console.error("Load quality form archive failed", error);
  return <div className="space-y-6"><header><h1 className="text-3xl font-black tracking-tight sm:text-4xl">מילוי טפסים</h1><p className="mt-2 text-sm font-semibold text-slate-500">כל טופס שהופק מהמערכת נשמר כאן אוטומטית.</p></header><FormsNavigation active="archive" /><QualityFormArchive initialForms={(data ?? []) as QualityFormArchiveRow[]} /></div>;
}
