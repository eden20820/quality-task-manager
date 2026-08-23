
import Link from "next/link";
import { Bell, CalendarDays, ClipboardList, Gauge, ListChecks, Truck } from "lucide-react";

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
import { reminderOccursOn } from "@/lib/reminders/recurrence";

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

  let recentTasksQuery = supabase
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
    .order("created_at", { ascending: false })
    .limit(5);

  let newTasksQuery = supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (dashboardClearedAt) {
    recentTasksQuery = recentTasksQuery.gt("created_at", dashboardClearedAt);
    newTasksQuery = newTasksQuery.gt("created_at", dashboardClearedAt);
  }

  const [
    { data: recentTasks, error: recentTasksError },
    { count: newTasks, error: newTasksError },
    { data: expiringItems, error: expiryError },
    { data: weeklyReminders, error: remindersError },
    { data: weeklyDeadlineTasks, error: deadlineTasksError },
    { data: upcomingCalibrations, error: calibrationsError },
    { data: upcomingSuppliers, error: suppliersError },
    { data: alertSettings, error: alertSettingsError },
    { data: weeklyCalibrations, error: weeklyCalibrationsError },
    { data: weeklySuppliers, error: weeklySuppliersError },
    { data: weeklyFollowups, error: weeklyFollowupsError },
  ] = await Promise.all([
    recentTasksQuery,
    newTasksQuery,
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
    supabase
      .from("calibration_items")
      .select("id, equipment_name, next_calibration_date")
      .eq("is_active", true)
      .gte("next_calibration_date", weekStartString)
      .lte("next_calibration_date", weekEndString)
      .order("next_calibration_date", { ascending: true }),
    supabase
      .from("suppliers")
      .select("id, supplier_name, expiration_date")
      .gte("expiration_date", weekStartString)
      .lte("expiration_date", weekEndString)
      .order("expiration_date", { ascending: true }),
    supabase
      .from("quality_followups")
      .select("id, category, reference_number, name, created_at")
      .in("status", ["open", "waiting"])
      .eq("alerts_enabled", true)
      .lte("created_at", `${weekEndString}T23:59:59.999Z`)
      .order("created_at", { ascending: true }),
  ]);
  if (recentTasksError) console.error("Load recent dashboard tasks error:", recentTasksError);
  if (newTasksError) console.error("Count new dashboard tasks error:", newTasksError);
  if (expiryError) console.error("Load dashboard expiry error:", expiryError);
  if (remindersError) console.error("Load dashboard reminders error:", remindersError);
  if (deadlineTasksError) console.error("Load dashboard deadline tasks error:", deadlineTasksError);
  if (calibrationsError) console.error("Load dashboard calibrations error:", calibrationsError);
  if (suppliersError) console.error("Load dashboard suppliers error:", suppliersError);
  if (alertSettingsError) console.error("Load dashboard alert settings error:", alertSettingsError);
  if (weeklyCalibrationsError) console.error("Load weekly calibrations error:", weeklyCalibrationsError);
  if (weeklySuppliersError) console.error("Load weekly suppliers error:", weeklySuppliersError);
  if (weeklyFollowupsError) console.error("Load weekly followup alerts error:", weeklyFollowupsError);

  const visibleRecentTasks = recentTasks ?? [];
  const expiringNames = (expiringItems ?? []).map((item) => item.material_name);
  const calibrationAlertsEnabled = alertSettings?.calibration_alerts_enabled ?? true;
  const supplierAlertsEnabled = alertSettings?.supplier_alerts_enabled ?? true;
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateString = formatDateForDatabase(date);
    return {
      date,
      dateString,
      tasks: (weeklyDeadlineTasks ?? []).filter((task) => task.due_date === dateString),
      reminders: (weeklyReminders ?? []).filter((reminder) =>
        reminderOccursOn(reminder, dateString)
      ),
      calibrations: calibrationAlertsEnabled
        ? (weeklyCalibrations ?? []).filter((item) => item.next_calibration_date === dateString)
        : [],
      suppliers: supplierAlertsEnabled
        ? (weeklySuppliers ?? []).filter((item) => item.expiration_date === dateString)
        : [],
      followups: (weeklyFollowups ?? []).filter((item) => {
        const created = new Date(item.created_at);
        const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
        const daysSinceCreated = Math.round((date.getTime() - createdDay.getTime()) / 86_400_000);
        return daysSinceCreated >= 7 && daysSinceCreated % 7 === 0;
      }),
    };
  });
  const weeklyEventCount = weekDays.reduce(
    (total, day) => total + day.tasks.length + day.reminders.length + day.calibrations.length + day.suppliers.length + day.followups.length,
    0
  );
  const calibrationNames = calibrationAlertsEnabled ? (upcomingCalibrations ?? []).map((item) => item.equipment_name) : [];
  const supplierNames = supplierAlertsEnabled ? (upcomingSuppliers ?? []).map((item) => item.supplier_name) : [];

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
      <div className="flex flex-col gap-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            לוח בקרה
          </h2>
        </div>

        <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="min-h-40 h-full justify-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-lg font-bold">משימות חדשות</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-5xl font-extrabold">{newTasks ?? 0}</p>
            </CardContent>
          </Card>
          {detailCards.map((card) => (
            <Link key={card.title} href={card.href} className="group block">
              <Card className="min-h-40 h-full justify-center transition group-hover:-translate-y-0.5 group-hover:border-slate-300 group-hover:shadow-md">
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
        </div>

          <Card className="order-last">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <CalendarDays className="h-5 w-5" />
                    השבוע שלי
                  </CardTitle>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {weeklyEventCount > 0
                      ? `${weeklyEventCount} אירועים והתראות השבוע`
                      : "אין אירועים או התראות השבוע"}
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
                  const followupGroups = (["pka", "nonconformity", "eco"] as const).map((category) => ({
                    category,
                    items: day.followups.filter((item) => item.category === category),
                  })).filter((group) => group.items.length > 0);

                  return (
                    <div key={day.dateString} className={`min-h-32 rounded-xl border p-3 ${isToday ? "border-blue-300 bg-blue-50" : "bg-slate-50/70"}`}>
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <span className={`font-extrabold ${isToday ? "text-blue-700" : "text-slate-800"}`}>{dayName}</span>
                        <span className="text-xs font-bold text-slate-500">{shortDate}</span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {day.tasks.length > 0 ? (
                          <Link href={day.tasks.length === 1 ? `/tasks/${day.tasks[0].id}/edit` : "/tasks"} title={day.tasks.map((item) => item.title).join(" • ")} className="flex items-start gap-1.5 rounded-md bg-amber-100 px-2 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200">
                            <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{day.tasks.length === 1 ? day.tasks[0].title : `משימות עם דדליין — ${day.tasks.length} משימות`}</span>
                          </Link>
                        ) : null}
                        {day.reminders.length > 0 ? (
                          <Link href="/calendar" title={day.reminders.map((item) => item.title).join(" • ")} className="flex items-start gap-1.5 rounded-md bg-blue-100 px-2 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-200">
                            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{day.reminders.length === 1 ? day.reminders[0].title : `תזכורות ידניות — ${day.reminders.length} תזכורות`}</span>
                          </Link>
                        ) : null}
                        {day.calibrations.length > 0 ? (
                          <Link href="/calibrations" title={day.calibrations.map((item) => item.equipment_name).join(" • ")} className="flex items-start gap-1.5 rounded-md bg-emerald-100 px-2 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-200">
                            <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{day.calibrations.length === 1 ? `כיול: ${day.calibrations[0].equipment_name}` : `כיולים — ${day.calibrations.length} התראות`}</span>
                          </Link>
                        ) : null}
                        {day.suppliers.length > 0 ? (
                          <Link href="/suppliers" title={day.suppliers.map((item) => item.supplier_name).join(" • ")} className="flex items-start gap-1.5 rounded-md bg-violet-100 px-2 py-1.5 text-xs font-bold text-violet-900 hover:bg-violet-200">
                            <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{day.suppliers.length === 1 ? `תוקף ספק: ${day.suppliers[0].supplier_name}` : `תוקף ספקים — ${day.suppliers.length} התראות`}</span>
                          </Link>
                        ) : null}
                        {followupGroups.map((group) => {
                          const label = group.category === "pka" ? 'פק״ע' : group.category === "eco" ? "ECO" : "אי התאמה";
                          return <Link key={group.category} href="/followups" title={group.items.map((item) => `${item.reference_number}${item.name ? ` — ${item.name}` : ""}`).join(" • ")} className="flex items-start gap-1.5 rounded-md bg-red-100 px-2 py-1.5 text-xs font-bold text-red-900 hover:bg-red-200">
                            <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{group.items.length === 1 ? `התראת ${label}: ${group.items[0].reference_number}${group.items[0].name ? ` — ${group.items[0].name}` : ""}` : `התראת ${label} — ${group.items.length} התראות`}</span>
                          </Link>;
                        })}
                        {!day.tasks.length && !day.reminders.length && !day.calibrations.length && !day.suppliers.length && !day.followups.length && (
                          <p className="pt-2 text-center text-xs text-slate-400">אין אירועים</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-amber-300" />משימה עם דדליין</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-blue-300" />תזכורת ידנית</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-emerald-300" />כיול</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-violet-300" />תוקף ספק</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-red-300" />התראת מעקב</span>
              </div>
            </CardContent>
          </Card>

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
