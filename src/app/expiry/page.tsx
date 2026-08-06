import { AppShell } from "@/components/layout/app-shell";
import { ExpiryDashboard } from "@/components/expiry/expiry-dashboard";
import {
  ExpiryTable,
  type ExpiryRow,
} from "@/components/expiry/expiry-table";
import { UploadDialog } from "@/components/expiry/upload-dialog";
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

export default async function ExpiryPage() {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("expiry_items")
    .select(`
      id,
      material_name,
      expiry_date,
      quantity,
      location,
      invalid_expiry_text,
      is_rejected
    `)
    .eq("is_active", true)
    .order("expiry_date", {
      ascending: true,
      nullsFirst: false,
    });

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

  const expiredCount = rows.filter(
    (row) => row.daysLeft < 0
  ).length;

  const next30Count = rows.filter(
    (row) =>
      row.daysLeft >= 0 &&
      row.daysLeft <= 30
  ).length;

  const next90Count = rows.filter(
    (row) =>
      row.daysLeft > 30 &&
      row.daysLeft <= 90
  ).length;

  const invalidCount = (items ?? []).filter(
    (item) =>
      !item.expiry_date &&
      Boolean(item.invalid_expiry_text)
  ).length;

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-4xl font-extrabold">
              ניהול חומרים
            </h1>

            <p className="mt-2 text-slate-500">
              מעקב אחר תוקף חומרים וסנכרון קבצי Excel
            </p>
          </div>
        </div>

        <ExpiryDashboard
          total={rows.length}
          expired={expiredCount}
          next30={next30Count}
          next90={next90Count}
          invalid={invalidCount}
        />

        <UploadDialog />

        <ExpiryTable rows={rows} />
      </div>
    </AppShell>
  );
}