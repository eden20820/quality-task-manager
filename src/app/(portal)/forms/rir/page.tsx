import { RirForm } from "@/components/quality-forms/rir-form";
import { buildFormAutocompleteSuggestions } from "@/lib/quality-forms/form-suggestions";
import { ONLINE_FORM_CATEGORY } from "@/lib/quality-forms/form-archive";
import { createClient } from "@/lib/supabase/server";
import { loadSupplierBinderDirectory } from "@/lib/quality-forms/supplier-binder-directory";
import { loadPartsCatalog } from "@/lib/quality-forms/parts-catalog-server";

export default async function RirFormPage() {
  const supabase = await createClient();
  const [suppliersResult, formsResult, followupsResult, binderDirectory, catalogItems] = await Promise.all([
    supabase.from("suppliers").select("supplier_name").order("supplier_name").limit(1000),
    supabase.from("quality_documents").select("file_name").eq("category", ONLINE_FORM_CATEGORY).order("created_at", { ascending: false }).limit(1000),
    supabase.from("quality_followups").select("name, notes").eq("category", "pka").order("created_at", { ascending: false }).limit(1000),
    loadSupplierBinderDirectory(),
    loadPartsCatalog(),
  ]);
  for (const result of [suppliersResult, formsResult, followupsResult]) {
    if (result.error) console.error("Load RIR autocomplete suggestions failed", result.error);
  }
  const suggestions = buildFormAutocompleteSuggestions({
    catalogItems,
    suppliers: suppliersResult.data ?? [],
    archivedForms: formsResult.data ?? [],
    followups: followupsResult.data ?? [],
  });
  return <RirForm suggestions={suggestions} binderDirectory={binderDirectory} />;
}
