import { SupplierBindersManager } from "@/components/suppliers/supplier-binders-manager";
import { createClient } from "@/lib/supabase/server";
import { supplierBinders, type SupplierBinder, type SupplierBinderRecord } from "@/lib/supplier-binders";

function todayInIsrael() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default async function SupplierBindersPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: binderData, error: binderError }] = await Promise.all([
    supabase.from("suppliers").select("id, supplier_name, status, expiration_date").order("supplier_name"),
    supabase
      .from("supplier_binders")
      .select("id, label, sort_order, supplier_binder_entries(id, display_name, supplier_id, sort_order)")
      .order("sort_order")
      .order("sort_order", { referencedTable: "supplier_binder_entries" }),
  ]);

  if (error) console.error("Load suppliers for binders error:", error);
  if (binderError && binderError.code !== "42P01") console.error("Load supplier binders error:", binderError);

  const binders: SupplierBinder[] = binderError ? supplierBinders.map((binder) => ({
    ...binder,
    suppliers: binder.suppliers.map((entry, index) => ({ ...entry, sortOrder: index + 1 })),
  })) : (binderData ?? []).map((binder) => ({
    id: binder.id,
    label: binder.label,
    sortOrder: binder.sort_order,
    suppliers: [...(binder.supplier_binder_entries ?? [])]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((entry) => {
        const knownEntry = supplierBinders.find((knownBinder) => knownBinder.label === binder.label)?.suppliers.find((candidate) => candidate.name === entry.display_name);
        return { id: entry.id, name: entry.display_name, aliases: knownEntry?.aliases, supplierId: entry.supplier_id, sortOrder: entry.sort_order };
      }),
  }));

  return <SupplierBindersManager binders={binders} suppliers={(data ?? []) as SupplierBinderRecord[]} today={todayInIsrael()} editable={!binderError} />;
}
