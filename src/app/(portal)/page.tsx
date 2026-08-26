
import Link from "next/link";
import { Bell, CalendarClock, CalendarDays, ClipboardList, Gauge, ListChecks, Truck } from "lucide-react";

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

const assigneeLabels: Record<string, string> = {
  eden: "עדן",
  sergey: "סרגיי",
  quality_manager: "עמית",
};

function formatAssignees(assignees: string[]) {
  return assignees.length > 0
    ? assignees.map((assignee) => assigneeLabels[assignee] ?? assignee).join(", ")
    : "לא הוגדר";
}

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

  const { data, error } = await supabase.rpc("get_dashboard_data", {
    p_today: todayString,
    p_thirty_days: inThirtyDaysString,
    p_week_start: weekStartString,
    p_week_end: weekEndString,
    p_dashboard_cleared_at: dashboardClearedAt,
  });
  if (error) console.error("Load dashboard data error:", error);

  const dashboardData = (data ?? {}) as Record<string, unknown>;
  const recentTasks = (dashboardData.recent_tasks ?? []) as Array<{
    id: string;
    task_number: number;
    title: string;
    description: string | null;
    status_note: string | null;
    assignees: string[];
    status: string;
    priority: string;
    due_date: string | null;
    created_at: string;
  }>;
  const newTasks = Number(dashboardData.new_tasks ?? 0);
  const expiringItems = (dashboardData.expiring_items ?? []) as Array<{ id: string; material_name: string; expiry_date: string }>;
  const weeklyReminders = (dashboardData.weekly_reminders ?? []) as Array<{ id: string; title: string; reminder_date: string; repeat_unit: "day" | "month" | null; repeat_interval: number | null }>;
  const weeklyDeadlineTasks = (dashboardData.weekly_deadline_tasks ?? []) as Array<{ id: string; title: string; due_date: string }>;
  const upcomingCalibrations = (dashboardData.upcoming_calibrations ?? []) as Array<{ id: string; equipment_name: string; next_calibration_date: string }>;
  const upcomingSuppliers = (dashboardData.upcoming_suppliers ?? []) as Array<{ id: string; supplier_name: string; expiration_date: string }>;
  const alertSettings = (dashboardData.alert_settings ?? {}) as { calibration_alerts_enabled?: boolean; supplier_alerts_enabled?: boolean };
  const weeklyCalibrations = (dashboardData.weekly_calibrations ?? []) as Array<{ id: string; equipment_name: string; next_calibration_date: string }>;
  const weeklySuppliers = (dashboardData.weekly_suppliers ?? []) as Array<{ id: string; supplier_name: string; expiration_date: string }>;
  const weeklyFollowups = (dashboardData.weekly_followups ?? []) as Array<{ id: string; category: string; reference_number: string; name: string | null; created_at: string }>;
  const weeklyExpiryItems = (dashboardData.weekly_expiry_items ?? []) as Array<{ id: string; material_name: string; location: string | null; expiry_date: string }>;

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
      expiryItems: (weeklyExpiryItems ?? []).filter((item) => item.expiry_date === dateString),
      followups: (weeklyFollowups ?? []).filter((item) => {
        const created = new Date(item.created_at);
        const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
        const daysSinceCreated = Math.round((date.getTime() - createdDay.getTime()) / 86_400_000);
        return daysSinceCreated >= 7 && daysSinceCreated % 7 === 0;
      }),
    };
  });
  const weeklyEventCount = weekDays.reduce(
    (total, day) => total + day.tasks.length + day.reminders.length + day.calibrations.length + day.suppliers.length + day.expiryItems.length + day.followups.length,
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
                        {day.expiryItems.length > 0 ? (
                          <Link href="/expiry" title={day.expiryItems.map((item) => `${item.material_name}${item.location ? ` — ${item.location}` : ""}`).join(" • ")} className="flex items-start gap-1.5 rounded-md bg-cyan-100 px-2 py-1.5 text-xs font-bold text-cyan-900 hover:bg-cyan-200">
                            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{day.expiryItems.length === 1 ? `פג תוקף: ${day.expiryItems[0].material_name}` : `פגי תוקף — ${day.expiryItems.length} התראות`}</span>
                          </Link>
                        ) : null}
                        {followupGroups.map((group) => {
                          const label = group.category === "pka" ? 'פק״ע' : group.category === "eco" ? "ECO" : "אי התאמה";
                          return <Link key={group.category} href="/followups" title={group.items.map((item) => `${item.reference_number}${item.name ? ` — ${item.name}` : ""}`).join(" • ")} className="flex items-start gap-1.5 rounded-md bg-red-100 px-2 py-1.5 text-xs font-bold text-red-900 hover:bg-red-200">
                            <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{group.items.length === 1 ? `התראת ${label}: ${group.items[0].reference_number}${group.items[0].name ? ` — ${group.items[0].name}` : ""}` : `התראת ${label} — ${group.items.length} התראות`}</span>
                          </Link>;
                        })}
                        {!day.tasks.length && !day.reminders.length && !day.calibrations.length && !day.suppliers.length && !day.expiryItems.length && !day.followups.length && (
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
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-cyan-300" />פג תוקף</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-red-300" />התראת מעקב</span>
              </div>
            </CardContent>
          </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <CardTitle className="text-2xl">
                משימות אחרונות
              </CardTitle>

              <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-4">
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
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                {visibleRecentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-3 px-4 py-4 sm:grid-cols-[40px_minmax(0,1fr)_auto] lg:grid-cols-[60px_minmax(0,1fr)_130px_110px_130px] lg:items-center lg:gap-4 lg:px-5"
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

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950">
                        {task.title}
                      </p>
                      {task.description ? (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm leading-5 text-slate-600" title={task.description}>
                          {task.description}
                        </p>
                      ) : null}
                      {task.status_note ? (
                        <p className="mt-2 line-clamp-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-sm font-semibold leading-5 text-blue-900" title={task.status_note}>
                          <span className="font-extrabold">עדכון סטטוס:</span> {task.status_note}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs font-bold text-blue-700">
                        אחראי: {formatAssignees(task.assignees ?? [])}
                      </p>
                    </div>

                    <Badge
                      variant="secondary"
                      className="w-fit max-lg:justify-self-end"
                    >
                      {statusLabels[task.status] ?? task.status}
                    </Badge>

                    <div className="hidden lg:block">
                      {priorityLabels[task.priority] ??
                        task.priority}
                    </div>

                    <div className="col-start-2 text-xs text-slate-500 sm:col-start-3 lg:col-start-auto lg:text-sm">
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
