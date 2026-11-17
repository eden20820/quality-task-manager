import "server-only";

import { createClient } from "@/lib/supabase/server";
import { supplierBinders, type SupplierBinderDirectoryEntry } from "@/lib/supplier-binders";

function fallbackDirectory(): SupplierBinderDirectoryEntry[] {
  return supplierBinders.flatMap((binder) => binder.suppliers.map((entry) => ({
    binderLabel: binder.label,
    name: entry.name,
    aliases: entry.aliases,
  })));
}

export async function loadSupplierBinderDirectory(): Promise<SupplierBinderDirectoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_binders")
    .select("label, supplier_binder_entries(display_name, sort_order)")
    .order("sort_order")
    .order("sort_order", { referencedTable: "supplier_binder_entries" });

  if (error) {
    if (error.code !== "42P01") console.error("Load supplier binder directory failed", error);
    return fallbackDirectory();
  }

  return (data ?? []).flatMap((binder) => (binder.supplier_binder_entries ?? []).map((entry) => {
    const known = supplierBinders
      .find((candidate) => candidate.label === binder.label)
      ?.suppliers.find((candidate) => candidate.name === entry.display_name);
    return { binderLabel: binder.label, name: entry.display_name, aliases: known?.aliases };
  }));
}
