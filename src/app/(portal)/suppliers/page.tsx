import { SuppliersManager, type SupplierRow } from "@/components/suppliers/suppliers-manager";
import { createClient } from "@/lib/supabase/server";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const [{ data: suppliers, error }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("suppliers").select("id, supplier_number, supplier_name, product_service, has_certification, has_experience, status, certification_type, expiration_date, delivery_score, quality_score, professionalism_score, requirements_score, weighted_score, notes").order("sort_order", { ascending: true, nullsFirst: false }),
    supabase.from("portal_settings").select("supplier_alerts_enabled").eq("id", "global").maybeSingle(),
  ]);
  if (error) console.error("Load suppliers error:", error);
  if (settingsError) console.error("Load supplier settings error:", settingsError);

  return <SuppliersManager rows={(suppliers ?? []) as SupplierRow[]} alertsEnabled={settings?.supplier_alerts_enabled ?? true} />;
}
