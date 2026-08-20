import { CalibrationsManager, type CalibrationRow } from "@/components/calibrations/calibrations-manager";
import { PaginationControls } from "@/components/pagination-controls";
import { PAGE_SIZE, pageRange, parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export default async function CalibrationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();
  const [{ data, error, count }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("calibration_items").select("id, equipment_name, serial_number, model, location, last_calibration_date, next_calibration_date, certificate_number, calibration_lab, notes, is_active", { count: "exact" }).order("next_calibration_date", { ascending: true, nullsFirst: false }).range(from, to),
    supabase.from("portal_settings").select("calibration_alerts_enabled").eq("id", "global").maybeSingle(),
  ]);
  if (error) console.error("Load calibrations error:", error);
  if (settingsError) console.error("Load calibration settings error:", settingsError);
  return <div className="space-y-5">
    <CalibrationsManager rows={(data ?? []) as CalibrationRow[]} alertsEnabled={settings?.calibration_alerts_enabled ?? true} />
    <PaginationControls basePath="/calibrations" page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
  </div>;
}
