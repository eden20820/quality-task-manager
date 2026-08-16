
import Link from "next/link";

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

export default async function HomePage() {
  const supabase = await createClient();

  const portalUser = await getPortalUser();
  const dashboardClearedAt = portalUser?.profile.dashboard_cleared_at ?? null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayString = formatDateForDatabase(today);

  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);
  const inThirtyDaysString = formatDateForDatabase(inThirtyDays);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

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
    { data: monthlyReminders, error: remindersError },
    { data: monthlyDeadlineTasks, error: deadlineTasksError },
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
      .select("id, title, reminder_date")
      .gte("reminder_date", formatDateForDatabase(monthStart))
      .lt("reminder_date", formatDateForDatabase(nextMonthStart))
      .order("reminder_date", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, due_date")
      .not("status", "in", "(completed,cancelled)")
      .gte("due_date", formatDateForDatabase(monthStart))
      .lt("due_date", formatDateForDatabase(nextMonthStart))
      .order("due_date", { ascending: true }),
  ]);
  if (tasksError) console.error("Load dashboard error:", tasksError);
  if (expiryError) console.error("Load dashboard expiry error:", expiryError);
  if (remindersError) console.error("Load dashboard reminders error:", remindersError);
  if (deadlineTasksError) console.error("Load dashboard deadline tasks error:", deadlineTasksError);

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
  const monthEventTitles = [
    ...(monthlyReminders ?? []).map((reminder) => reminder.title),
    ...(monthlyDeadlineTasks ?? []).map((task) => task.title),
  ];

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
      title: "תזכורות החודש",
      value: monthEventTitles.length,
      details: monthEventTitles,
      emptyText: "אין תזכורות או דדליינים בחודש הנוכחי",
      href: "/calendar",
    },
  ];

  return (
    <>
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold">
            לוח בקרה
          </h2>

          <p className="mt-2 text-lg text-slate-500">
            תמונת מצב של המשימות במחלקה
          </p>
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

        <div className="grid gap-6 md:grid-cols-2">
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
              <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
