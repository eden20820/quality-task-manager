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
  const { data, error } = await supabase.rpc("get_calendar_data", {
    p_start: start,
    p_end: end,
  });
  if (error) console.error("Load calendar data error:", error);

  const calendarData = (data ?? {}) as Record<string, unknown>;
  const tasks = (calendarData.tasks ?? []) as CalendarTask[];
  const oneTimeReminders = (calendarData.one_time_reminders ?? []) as Reminder[];
  const recurringReminders = (calendarData.recurring_reminders ?? []) as Reminder[];
  const calibrations = (calendarData.calibrations ?? []) as CalendarCalibration[];
  const followups = (calendarData.followups ?? []) as CalendarFollowup[];
  const suppliers = (calendarData.suppliers ?? []) as CalendarSupplier[];
  const expiryItems = (calendarData.expiry_items ?? []) as CalendarExpiryItem[];
  const alertSettings = (calendarData.alert_settings ?? {}) as { calibration_alerts_enabled?: boolean; supplier_alerts_enabled?: boolean };
  const reminders = [...(oneTimeReminders ?? []), ...(recurringReminders ?? [])];
  return <CalendarView key={monthKey} initialMonth={monthKey} tasks={tasks} reminders={reminders} calibrations={alertSettings.calibration_alerts_enabled === false ? [] : calibrations} followups={followups} suppliers={alertSettings.supplier_alerts_enabled === false ? [] : suppliers} expiryItems={expiryItems} />;
}
