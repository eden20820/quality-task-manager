import { CalibrationsManager, type CalibrationRow } from "@/components/calibrations/calibrations-manager";
import { createClient } from "@/lib/supabase/server";

export default async function CalibrationsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("calibration_items").select("id, equipment_name, serial_number, model, location, last_calibration_date, next_calibration_date, certificate_number, calibration_lab, notes, is_active").order("next_calibration_date", { ascending: true, nullsFirst: false });
  if (error) console.error("Load calibrations error:", error);
  return <CalibrationsManager rows={(data ?? []) as CalibrationRow[]} />;
}
