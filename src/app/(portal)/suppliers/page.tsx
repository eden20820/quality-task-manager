import { SuppliersManager, type SupplierRow } from "@/components/suppliers/suppliers-manager";
import { PaginationControls } from "@/components/pagination-controls";
import { PAGE_SIZE, pageRange, parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();
  const [{ data: suppliers, error, count }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("suppliers").select("id, supplier_number, supplier_name, product_service, has_certification, has_experience, status, certification_type, expiration_date, delivery_score, quality_score, professionalism_score, requirements_score, weighted_score, notes", { count: "exact" }).order("sort_order", { ascending: true, nullsFirst: false }).range(from, to),
    supabase.from("portal_settings").select("supplier_alerts_enabled").eq("id", "global").maybeSingle(),
  ]);
  if (error) console.error("Load suppliers error:", error);
  if (settingsError) console.error("Load supplier settings error:", settingsError);

  return <div className="space-y-5">
    <SuppliersManager rows={(suppliers ?? []) as SupplierRow[]} alertsEnabled={settings?.supplier_alerts_enabled ?? true} />
    <PaginationControls basePath="/suppliers" page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
  </div>;
}
