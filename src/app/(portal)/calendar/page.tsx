import { CalendarView, type CalendarTask, type Reminder, type CalendarCalibration, type CalendarExpiryItem, type CalendarFollowup, type CalendarSupplier } from "@/components/calendar/calendar-view";
import { createClient } from "@/lib/supabase/server";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function calendarRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  return { start: dateKey(start), end: dateKey(end) };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthKey = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "")
    ? params.month!
    : currentMonthKey();
  const { start, end } = calendarRange(monthKey);
  const supabase = await createClient();
  const [{ data: tasks, error: tasksError }, { data: oneTimeReminders, error: oneTimeRemindersError }, { data: recurringReminders, error: recurringRemindersError }, { data: calibrations }, { data: followups }, { data: suppliers }, { data: expiryItems, error: expiryItemsError }, { data: alertSettings }] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, priority, assignees").not("status", "in", "(completed,cancelled)").gte("due_date", start).lte("due_date", end).order("due_date"),
    supabase.from("reminders").select("id, title, reminder_date, notes, repeat_unit, repeat_interval").is("repeat_unit", null).gte("reminder_date", start).lte("reminder_date", end).order("reminder_date"),
    supabase.from("reminders").select("id, title, reminder_date, notes, repeat_unit, repeat_interval").not("repeat_unit", "is", null).lte("reminder_date", end).order("reminder_date"),
    supabase.from("calibration_items").select("id, equipment_name, equipment_code, location, next_calibration_date").eq("is_active", true).gte("next_calibration_date", start).lte("next_calibration_date", end).order("next_calibration_date"),
    supabase.from("quality_followups").select("id, category, reference_number, name, quantity, opened_at, created_at").in("status", ["open", "waiting"]).eq("alerts_enabled", true).lte("created_at", `${end}T23:59:59.999Z`).order("created_at"),
    supabase.from("suppliers").select("id, supplier_name, product_service, certification_type, expiration_date").gte("expiration_date", start).lte("expiration_date", end).order("expiration_date"),
    supabase.from("expiry_items").select("id, material_name, location, expiry_date").eq("is_active", true).gte("expiry_date", start).lte("expiry_date", end).order("expiry_date"),
    supabase.from("portal_settings").select("calibration_alerts_enabled, supplier_alerts_enabled").eq("id", "global").maybeSingle(),
  ]);
  if (tasksError) console.error("Load calendar tasks error:", tasksError);
  if (oneTimeRemindersError) console.error("Load one-time reminders error:", oneTimeRemindersError);
  if (recurringRemindersError) console.error("Load recurring reminders error:", recurringRemindersError);
  if (expiryItemsError) console.error("Load calendar expiry items error:", expiryItemsError);
  const reminders = [...(oneTimeReminders ?? []), ...(recurringReminders ?? [])];
  return <CalendarView key={monthKey} initialMonth={monthKey} tasks={(tasks ?? []) as CalendarTask[]} reminders={reminders as Reminder[]} calibrations={(alertSettings?.calibration_alerts_enabled === false ? [] : (calibrations ?? [])) as CalendarCalibration[]} followups={(followups ?? []) as CalendarFollowup[]} suppliers={(alertSettings?.supplier_alerts_enabled === false ? [] : (suppliers ?? [])) as CalendarSupplier[]} expiryItems={(expiryItems ?? []) as CalendarExpiryItem[]} />;
}
