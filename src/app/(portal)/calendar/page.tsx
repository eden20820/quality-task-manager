import { CalendarView, type CalendarTask, type Reminder, type CalendarCalibration, type CalendarFollowup, type CalendarSupplier } from "@/components/calendar/calendar-view";
import { createClient } from "@/lib/supabase/server";

export default async function CalendarPage() {
  const supabase = await createClient();
  const [{ data: tasks, error: tasksError }, { data: reminders, error: remindersError }, { data: calibrations }, { data: followups }, { data: suppliers }, { data: alertSettings }] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, priority").not("due_date", "is", null).not("status", "in", "(completed,cancelled)").order("due_date"),
    supabase.from("reminders").select("id, title, reminder_date, notes, repeat_unit, repeat_interval").order("reminder_date"),
    supabase.from("calibration_items").select("id, equipment_name, equipment_code, location, next_calibration_date").eq("is_active", true).not("next_calibration_date", "is", null).order("next_calibration_date"),
    supabase.from("quality_followups").select("id, category, reference_number, name, quantity, opened_at, created_at").in("status", ["open", "waiting"]).eq("alerts_enabled", true).order("created_at"),
    supabase.from("suppliers").select("id, supplier_name, product_service, certification_type, expiration_date").not("expiration_date", "is", null).order("expiration_date"),
    supabase.from("portal_settings").select("calibration_alerts_enabled, supplier_alerts_enabled").eq("id", "global").maybeSingle(),
  ]);
  if (tasksError) console.error("Load calendar tasks error:", tasksError);
  if (remindersError) console.error("Load reminders error:", remindersError);
  return <CalendarView tasks={(tasks ?? []) as CalendarTask[]} reminders={(reminders ?? []) as Reminder[]} calibrations={(alertSettings?.calibration_alerts_enabled === false ? [] : (calibrations ?? [])) as CalendarCalibration[]} followups={(followups ?? []) as CalendarFollowup[]} suppliers={(alertSettings?.supplier_alerts_enabled === false ? [] : (suppliers ?? [])) as CalendarSupplier[]} />;
}
