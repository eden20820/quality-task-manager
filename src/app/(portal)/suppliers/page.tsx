import { SuppliersManager, type SupplierRow } from "@/components/suppliers/suppliers-manager";
import { PaginationControls } from "@/components/pagination-controls";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; filter?: string }> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const search = String(params.q ?? "").trim().slice(0, 100);
  const filter = ["all", "expired", "upcoming", "valid", "missing"].includes(params.filter ?? "") ? params.filter! : "all";
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const upcomingLimit = new Date();
  upcomingLimit.setUTCDate(upcomingLimit.getUTCDate() + 90);
  const upcomingDate = upcomingLimit.toISOString().slice(0, 10);

  const [{ data: allSuppliers, error }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("suppliers").select("id, supplier_number, supplier_name, product_service, has_certification, has_experience, status, certification_type, expiration_date, delivery_score, quality_score, professionalism_score, requirements_score, weighted_score, notes").order("sort_order", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("portal_settings").select("supplier_alerts_enabled").eq("id", "global").maybeSingle(),
  ]);
  if (error) console.error("Load suppliers error:", error);
  if (settingsError) console.error("Load supplier settings error:", settingsError);

  const suppliers = (allSuppliers ?? []) as SupplierRow[];
  const normalizedSearch = search.toLocaleLowerCase("he-IL");
  const matchingSuppliers = suppliers.filter((supplier) => {
    const matchesSearch = !normalizedSearch || [supplier.supplier_number, supplier.supplier_name, supplier.product_service, supplier.certification_type, supplier.notes]
      .some((value) => value?.toLocaleLowerCase("he-IL").includes(normalizedSearch));
    if (!matchesSearch) return false;
    if (filter === "expired") return Boolean(supplier.expiration_date && supplier.expiration_date < today);
    if (filter === "upcoming") return Boolean(supplier.expiration_date && supplier.expiration_date >= today && supplier.expiration_date <= upcomingDate);
    if (filter === "valid") return Boolean(supplier.expiration_date && supplier.expiration_date > upcomingDate);
    if (filter === "missing") return !supplier.expiration_date;
    return true;
  });
  const from = (page - 1) * PAGE_SIZE;
  const visibleSuppliers = matchingSuppliers.slice(from, from + PAGE_SIZE);

  const supplierCounts = {
    all: suppliers.length,
    expired: suppliers.filter((row) => row.expiration_date && row.expiration_date < today).length,
    upcoming: suppliers.filter((row) => row.expiration_date && row.expiration_date >= today && row.expiration_date <= upcomingDate).length,
    missing: suppliers.filter((row) => !row.expiration_date).length,
  };

  return <div className="space-y-5">
    <SuppliersManager rows={visibleSuppliers} alertsEnabled={settings?.supplier_alerts_enabled ?? true} total={matchingSuppliers.length} counts={supplierCounts} initialSearch={search} initialFilter={filter} />
    <PaginationControls basePath="/suppliers" page={page} pageSize={PAGE_SIZE} total={matchingSuppliers.length} query={{ q: search || undefined, filter: filter === "all" ? undefined : filter }} />
  </div>;
}
