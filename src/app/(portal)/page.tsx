
import Link from "next/link";
import { Bell, CalendarDays, ClipboardList } from "lucide-react";

import { clearDashboardTasks } from "@/app/tasks/actions";
import { ClearDashboardButton } from "@/components/clear-dashboard-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/auth/portal-user";
import { reminderDatesInRange } from "@/lib/reminders/recurrence";

const statusLabels: Record<string, string> = {
  new: "חדשה",
  in_progress: "בטיפול",
  waiting: "ממתינה",
  completed: "הושלמה",
  cancelled: "בוטלה",
};

const priorityLabels: Record<string, string> = {
  normal: "רגילה",
  high: "גבוהה",
  urgent: "דחופה",
};

function formatDate(value: string | null) {
  if (!value) return "ללא תאריך";

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateForDatabase(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getIsraelToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return new Date(value("year"), value("month") - 1, value("day"));
}

export default async function HomePage() {
  const supabase = await createClient();

  const portalUser = await getPortalUser();
  const dashboardClearedAt = portalUser?.profile.dashboard_cleared_at ?? null;

  const today = getIsraelToday();

  const todayString = formatDateForDatabase(today);

  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);
  const inThirtyDaysString = formatDateForDatabase(inThirtyDays);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartString = formatDateForDatabase(weekStart);
  const weekEndString = formatDateForDatabase(weekEnd);

  let tasksQuery = supabase
    .from("tasks")
    .select(`
      id,
      task_number,
      title,
      status,
      priority,
      due_date,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (dashboardClearedAt) {
    tasksQuery = tasksQuery.gt(
      "created_at",
      dashboardClearedAt
    );
  }

  const [
    { data: dashboardTasks, error: tasksError },
    { data: expiringItems, error: expiryError },
    { data: weeklyReminders, error: remindersError },
    { data: weeklyDeadlineTasks, error: deadlineTasksError },
    { data: upcomingCalibrations, error: calibrationsError },
    { data: upcomingSuppliers, error: suppliersError },
    { data: alertSettings, error: alertSettingsError },
  ] = await Promise.all([
    tasksQuery,
    supabase
      .from("expiry_items")
      .select("id, material_name, expiry_date")
      .eq("is_active", true)
      .not("expiry_date", "is", null)
      .gte("expiry_date", todayString)
      .lte("expiry_date", inThirtyDaysString)
      .order("expiry_date", { ascending: true }),
    supabase
      .from("reminders")
      .select("id, title, reminder_date, repeat_unit, repeat_interval")
      .lte("reminder_date", weekEndString)
      .order("reminder_date", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, due_date")
      .not("status", "in", "(completed,cancelled)")
      .gte("due_date", weekStartString)
      .lte("due_date", weekEndString)
      .order("due_date", { ascending: true }),
    supabase
      .from("calibration_items")
      .select("id, equipment_name, next_calibration_date")
      .eq("is_active", true)
      .not("next_calibration_date", "is", null)
      .gte("next_calibration_date", todayString)
      .lte("next_calibration_date", inThirtyDaysString)
      .order("next_calibration_date", { ascending: true }),
    supabase
      .from("suppliers")
      .select("id, supplier_name, expiration_date")
      .not("expiration_date", "is", null)
      .gte("expiration_date", todayString)
      .lte("expiration_date", inThirtyDaysString)
      .order("expiration_date", { ascending: true }),
    supabase
      .from("portal_settings")
      .select("calibration_alerts_enabled, supplier_alerts_enabled")
      .eq("id", "global")
      .maybeSingle(),
  ]);
  if (tasksError) console.error("Load dashboard error:", tasksError);
  if (expiryError) console.error("Load dashboard expiry error:", expiryError);
  if (remindersError) console.error("Load dashboard reminders error:", remindersError);
  if (deadlineTasksError) console.error("Load dashboard deadline tasks error:", deadlineTasksError);
  if (calibrationsError) console.error("Load dashboard calibrations error:", calibrationsError);
  if (suppliersError) console.error("Load dashboard suppliers error:", suppliersError);
  if (alertSettingsError) console.error("Load dashboard alert settings error:", alertSettingsError);

  const allTasks = dashboardTasks ?? [];
  const newTasks = allTasks.filter((task) => task.status === "new").length;
  const inProgressTasks = allTasks.filter((task) => task.status === "in_progress").length;
  const waitingTasks = allTasks.filter((task) => task.status === "waiting").length;
  const overdueTasks = allTasks.filter((task) =>
    task.due_date && task.due_date < todayString &&
    task.status !== "completed" && task.status !== "cancelled"
  ).length;
  const visibleRecentTasks = allTasks.slice(0, 5);
  const expiringNames = (expiringItems ?? []).map((item) => item.material_name);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateString = formatDateForDatabase(date);
    return {
      date,
      dateString,
      tasks: (weeklyDeadlineTasks ?? []).filter((task) => task.due_date === dateString),
      reminders: (weeklyReminders ?? []).filter((reminder) =>
        reminderDatesInRange(reminder, dateString, dateString).length > 0
      ),
    };
  });
  const weeklyEventCount = weekDays.reduce(
    (total, day) => total + day.tasks.length + day.reminders.length,
    0
  );
  const calibrationAlertsEnabled = alertSettings?.calibration_alerts_enabled ?? true;
  const calibrationNames = calibrationAlertsEnabled ? (upcomingCalibrations ?? []).map((item) => item.equipment_name) : [];
  const supplierAlertsEnabled = alertSettings?.supplier_alerts_enabled ?? true;
  const supplierNames = supplierAlertsEnabled ? (upcomingSuppliers ?? []).map((item) => item.supplier_name) : [];

  const summaryCards = [
    { title: "משימות חדשות", value: newTasks },
    { title: "בטיפול", value: inProgressTasks },
    { title: "ממתינות", value: waitingTasks },
    { title: "באיחור", value: overdueTasks },
  ];

  const detailCards = [
    {
      title: "עומדים לפוג / עד 30 יום",
      value: expiringItems?.length ?? 0,
      details: expiringNames,
      emptyText: "אין חומרים שעומדים לפוג",
      href: "/expiry",
    },
    {
      title: "כיולים קרובים / עד 30 יום",
      value: calibrationAlertsEnabled ? upcomingCalibrations?.length ?? 0 : 0,
      details: calibrationNames,
      emptyText: calibrationAlertsEnabled ? "אין כיולים ב־30 הימים הקרובים" : "התראות הכיולים כבויות",
      href: "/calibrations",
    },
    {
      title: "תוקף ספקים / עד 30 יום",
      value: supplierAlertsEnabled ? upcomingSuppliers?.length ?? 0 : 0,
      details: supplierNames,
      emptyText: supplierAlertsEnabled ? "אין ספקים שתוקפם יפוג ב־30 הימים הקרובים" : "התראות הספקים כבויות",
      href: "/suppliers",
    },
  ];

  return (
    <>
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            לוח בקרה
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Card key={card.title}>
              <CardHeader>
                <CardTitle className="text-center text-lg font-bold">
                  {card.title}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="text-center text-5xl font-extrabold">
                  {card.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {detailCards.map((card) => (
            <Link key={card.title} href={card.href} className="group block">
              <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-slate-300 group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-center text-lg font-bold">
                    {card.title}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-center text-5xl font-extrabold">
                    {card.value}
                  </p>
                  <p className="mt-3 min-h-5 truncate text-center text-sm font-semibold text-slate-500">
                    {card.details.length > 0
                      ? `${card.details.slice(0, 3).join(" • ")}${card.details.length > 3 ? ` • ועוד ${card.details.length - 3}` : ""}`
                      : card.emptyText}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}

          <Card className="md:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <CalendarDays className="h-5 w-5" />
                    השבוע שלי
                  </CardTitle>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {weeklyEventCount > 0
                      ? `${weeklyEventCount} משימות ותזכורות השבוע`
                      : "אין משימות או תזכורות השבוע"}
                  </p>
                </div>
                <Link href="/calendar" className="text-sm font-bold text-slate-600 hover:text-slate-950">
                  ליומן המלא
                </Link>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {weekDays.map((day) => {
                  const isToday = day.dateString === todayString;
                  const dayName = new Intl.DateTimeFormat("he-IL", { weekday: "short" }).format(day.date);
                  const shortDate = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit" }).format(day.date);

                  return (
                    <div key={day.dateString} className={`min-h-32 rounded-xl border p-3 ${isToday ? "border-blue-300 bg-blue-50" : "bg-slate-50/70"}`}>
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <span className={`font-extrabold ${isToday ? "text-blue-700" : "text-slate-800"}`}>{dayName}</span>
                        <span className="text-xs font-bold text-slate-500">{shortDate}</span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {day.tasks.map((task) => (
                          <Link key={task.id} href={`/tasks/${task.id}/edit`} title={task.title} className="flex items-start gap-1.5 rounded-md bg-amber-100 px-2 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200">
                            <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{task.title}</span>
                          </Link>
                        ))}
                        {day.reminders.map((reminder) => (
                          <Link key={reminder.id} href="/calendar" title={reminder.title} className="flex items-start gap-1.5 rounded-md bg-blue-100 px-2 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-200">
                            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{reminder.title}</span>
                          </Link>
                        ))}
                        {!day.tasks.length && !day.reminders.length && (
                          <p className="pt-2 text-center text-xs text-slate-400">אין אירועים</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-2xl">
                משימות אחרונות
              </CardTitle>

              <div className="flex items-center gap-4">
                {visibleRecentTasks.length > 0 && (
                  <form action={clearDashboardTasks}>
                    <ClearDashboardButton />
                  </form>
                )}

                <Link
                  href="/tasks"
                  className="text-sm font-bold text-slate-600 hover:text-slate-950"
                >
                  לכל המשימות
                </Link>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {visibleRecentTasks.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <div className="min-w-[760px] divide-y divide-slate-200">
                {visibleRecentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[90px_1fr_130px_110px_130px] items-center gap-4 px-5 py-4"
                  >
                    <div className="flex justify-center">
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full ${
                          task.status === "new"
                            ? "bg-emerald-500"
                            : task.status === "in_progress"
                              ? "bg-amber-400"
                              : task.status === "waiting"
                                ? "bg-orange-500"
                                : task.status === "cancelled"
                                  ? "bg-slate-400"
                                  : "bg-blue-500"
                        }`}
                        aria-label={statusLabels[task.status] ?? task.status}
                        title={statusLabels[task.status] ?? task.status}
                      />
                    </div>

                    <div className="font-semibold">
                      {task.title}
                    </div>

                    <Badge
                      variant="secondary"
                      className="w-fit"
                    >
                      {statusLabels[task.status] ?? task.status}
                    </Badge>

                    <div>
                      {priorityLabels[task.priority] ??
                        task.priority}
                    </div>

                    <div className="text-sm text-slate-500">
                      {formatDate(task.due_date)}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            ) : (
              <div className="flex h-52 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-slate-500">
                <p className="font-semibold">
                  אין משימות אחרונות להצגה
                </p>

                <p className="text-sm">
                  משימות חדשות שייווצרו יופיעו כאן
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
