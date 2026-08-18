import { CalendarView, type CalendarTask, type Reminder } from "@/components/calendar/calendar-view";
import { createClient } from "@/lib/supabase/server";

export default async function CalendarPage() {
  const supabase = await createClient();
  const [{ data: tasks, error: tasksError }, { data: reminders, error: remindersError }] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, priority").not("due_date", "is", null).not("status", "in", "(completed,cancelled)").order("due_date"),
    supabase.from("reminders").select("id, title, reminder_date, notes, repeat_unit, repeat_interval").order("reminder_date"),
  ]);
  if (tasksError) console.error("Load calendar tasks error:", tasksError);
  if (remindersError) console.error("Load reminders error:", remindersError);
  return <CalendarView tasks={(tasks ?? []) as CalendarTask[]} reminders={(reminders ?? []) as Reminder[]} />;
}
