import { CalibrationsManager, type CalibrationRow } from "@/components/calibrations/calibrations-manager";
import { createClient } from "@/lib/supabase/server";

export default async function CalibrationsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("calibration_items").select("id, equipment_name, equipment_code, serial_number, location, next_calibration_date, notes").order("next_calibration_date");
  if (error) console.error("Load calibrations error:", error);
  return <CalibrationsManager rows={(data ?? []) as CalibrationRow[]} />;
}
