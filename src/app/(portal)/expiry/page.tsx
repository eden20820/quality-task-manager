import { ExpiryDashboard, type ExpiryFilter } from "@/components/expiry/expiry-dashboard";
import {
  ExpiryTable,
  type ExpiryRow,
} from "@/components/expiry/expiry-table";
import { UploadDialog } from "@/components/expiry/upload-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { PAGE_SIZE, pageRange, parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

function daysBetween(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.floor(
    (target.getTime() - today.getTime()) / 86_400_000
  );
}

function formatExpiryDate(value: string | null) {
  if (!value) {
    return "ללא תאריך";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function databaseDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function ExpiryPage({ searchParams }: { searchParams: Promise<{ page?: string; filter?: string }> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const filter: ExpiryFilter = ["expired", "next30", "next90", "invalid"].includes(params.filter ?? "")
    ? params.filter as ExpiryFilter
    : "all";
  const { from, to } = pageRange(page);
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(today.getDate() + 30);
  const inNinetyDays = new Date(today);
  inNinetyDays.setDate(today.getDate() + 90);
  const todayString = databaseDate(today);
  const inThirtyDaysString = databaseDate(inThirtyDays);
  const inNinetyDaysString = databaseDate(inNinetyDays);

  let itemsQuery = supabase
    .from("expiry_items")
    .select(`
      id,
      material_name,
      expiry_date,
      quantity,
      location,
      invalid_expiry_text,
      is_rejected
    `, { count: "exact" })
    .eq("is_active", true);

  if (filter === "expired") itemsQuery = itemsQuery.lt("expiry_date", todayString);
  if (filter === "next30") itemsQuery = itemsQuery.gte("expiry_date", todayString).lte("expiry_date", inThirtyDaysString);
  if (filter === "next90") itemsQuery = itemsQuery.gt("expiry_date", inThirtyDaysString).lte("expiry_date", inNinetyDaysString);
  if (filter === "invalid") itemsQuery = itemsQuery.is("expiry_date", null).not("invalid_expiry_text", "is", null);

  const [
    { data: items, error, count: totalCount },
    { count: allCount },
    { count: expiredCount },
    { count: next30Count },
    { count: next90Count },
    { count: invalidCount },
  ] = await Promise.all([
    itemsQuery
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .range(from, to),
    supabase.from("expiry_items").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("expiry_items").select("id", { count: "exact", head: true }).eq("is_active", true).lt("expiry_date", todayString),
    supabase.from("expiry_items").select("id", { count: "exact", head: true }).eq("is_active", true).gte("expiry_date", todayString).lte("expiry_date", inThirtyDaysString),
    supabase.from("expiry_items").select("id", { count: "exact", head: true }).eq("is_active", true).gt("expiry_date", inThirtyDaysString).lte("expiry_date", inNinetyDaysString),
    supabase.from("expiry_items").select("id", { count: "exact", head: true }).eq("is_active", true).is("expiry_date", null).not("invalid_expiry_text", "is", null),
  ]);

  if (error) {
    console.error("Load expiry items error:", error);
  }

  const rows: ExpiryRow[] = (items ?? []).map((item) => ({
    id: item.id,
    material: item.material_name,
    expiry: formatExpiryDate(item.expiry_date),
    quantity: item.quantity ?? null,
    location: item.location ?? "",
    daysLeft: item.expiry_date
      ? daysBetween(
          new Date(`${item.expiry_date}T00:00:00`)
        )
      : 9999,
    isRejected: item.is_rejected ?? false,
  }));

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              מעקב פגי תוקף
            </h1>

            <p className="mt-2 text-slate-500">
              מעקב אחר תוקף חומרים וסנכרון קבצי Excel
            </p>
          </div>
        </div>

        <ExpiryDashboard
          total={allCount ?? 0}
          expired={expiredCount ?? 0}
          next30={next30Count ?? 0}
          next90={next90Count ?? 0}
          invalid={invalidCount ?? 0}
          activeFilter={filter}
        />

        <UploadDialog />

        <ExpiryTable key={`${filter}-${page}`} rows={rows} activeFilter={filter} counts={{ all: allCount ?? 0, expired: expiredCount ?? 0, next30: next30Count ?? 0, next90: next90Count ?? 0, invalid: invalidCount ?? 0 }} />

        <PaginationControls basePath="/expiry" page={page} pageSize={PAGE_SIZE} total={totalCount ?? 0} query={{ filter: filter === "all" ? undefined : filter }} />
      </div>
    </>
  );
}
