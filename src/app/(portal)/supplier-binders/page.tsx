import { SupplierBindersManager } from "@/components/suppliers/supplier-binders-manager";
import { createClient } from "@/lib/supabase/server";
import type { SupplierBinderRecord } from "@/lib/supplier-binders";

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
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, supplier_name, status, expiration_date")
    .order("supplier_name");

  if (error) console.error("Load suppliers for binders error:", error);

  return <SupplierBindersManager suppliers={(data ?? []) as SupplierBinderRecord[]} today={todayInIsrael()} />;
}
