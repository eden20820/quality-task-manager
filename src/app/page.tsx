
import Link from "next/link";

import { clearDashboardTasks } from "@/app/tasks/actions";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dashboardClearedAt: string | null = null;

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("dashboard_cleared_at")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Load dashboard profile error:", profileError);
    }

    dashboardClearedAt = profile?.dashboard_cleared_at ?? null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayString = formatDateForDatabase(today);

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

  if (dashboardClearedAt) {
    recentTasksQuery = recentTasksQuery.gt(
      "created_at",
      dashboardClearedAt
    );
  }

  const [
    newTasksResult,
    inProgressTasksResult,
    waitingTasksResult,
    overdueTasksResult,
    recentTasksResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),

    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress"),

    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting"),

    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .lt("due_date", todayString)
      .neq("status", "completed")
      .neq("status", "cancelled"),

    recentTasksQuery,
  ]);

  const errors = [
    newTasksResult.error,
    inProgressTasksResult.error,
    waitingTasksResult.error,
    overdueTasksResult.error,
    recentTasksResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    console.error("Load dashboard error:", errors);
  }

  const newTasks = newTasksResult.count ?? 0;
  const inProgressTasks = inProgressTasksResult.count ?? 0;
  const waitingTasks = waitingTasksResult.count ?? 0;
  const overdueTasks = overdueTasksResult.count ?? 0;
  const visibleRecentTasks = recentTasksResult.data ?? [];

  const summaryCards = [
    { title: "משימות חדשות", value: newTasks },
    { title: "בטיפול", value: inProgressTasks },
    { title: "ממתינות", value: waitingTasks },
    { title: "באיחור", value: overdueTasks },
  ];

  return (
    <AppShell>
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-2xl">
                משימות אחרונות
              </CardTitle>

              <div className="flex items-center gap-4">
                {visibleRecentTasks.length > 0 && (
                  <form action={clearDashboardTasks}>
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      ניקוי
                    </button>
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
    </AppShell>
  );
}


