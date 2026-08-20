import { CalibrationsManager, type CalibrationRow } from "@/components/calibrations/calibrations-manager";
import { createClient } from "@/lib/supabase/server";

export default async function CalibrationsPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("calibration_items").select("id, equipment_name, serial_number, model, location, last_calibration_date, next_calibration_date, certificate_number, calibration_lab, notes, is_active").order("next_calibration_date", { ascending: true, nullsFirst: false }),
    supabase.from("portal_settings").select("calibration_alerts_enabled").eq("id", "global").maybeSingle(),
  ]);
  if (error) console.error("Load calibrations error:", error);
  if (settingsError) console.error("Load calibration settings error:", settingsError);
  return <CalibrationsManager rows={(data ?? []) as CalibrationRow[]} alertsEnabled={settings?.calibration_alerts_enabled ?? true} />;
}
