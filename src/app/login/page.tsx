
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default async function HomePage() {
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
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

  if (error) {
    console.error("Load dashboard tasks error:", error);
  }

  const allTasks = tasks ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const newTasks = allTasks.filter((task) => task.status === "new").length;
  const inProgressTasks = allTasks.filter(
    (task) => task.status === "in_progress"
  ).length;
  const waitingTasks = allTasks.filter(
    (task) => task.status === "waiting"
  ).length;
  const overdueTasks = allTasks.filter((task) => {
    if (!task.due_date) return false;
    if (task.status === "completed" || task.status === "cancelled") return false;

    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  }).length;

  const recentTasks = allTasks.slice(0, 5);

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
          <h2 className="text-4xl font-extrabold">לוח בקרה</h2>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl">
              משימות אחרונות
            </CardTitle>

            <Link
              href="/tasks"
              className="text-sm font-bold text-slate-600 hover:text-slate-950"
            >
              לכל המשימות
            </Link>
          </CardHeader>

          <CardContent>
            {recentTasks.length > 0 ? (
              <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[90px_1fr_130px_110px_130px] items-center gap-4 px-5 py-4"
                  >
                    <div className="font-bold">
                      #{task.task_number}
                    </div>

                    <div className="font-semibold">
                      {task.title}
                    </div>

                    <Badge variant="secondary" className="w-fit">
                      {statusLabels[task.status] ?? task.status}
                    </Badge>

                    <div>
                      {priorityLabels[task.priority] ?? task.priority}
                    </div>

                    <div className="text-sm text-slate-500">
                      {formatDate(task.due_date)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-52 items-center justify-center rounded-lg border-2 border-dashed text-slate-500">
                עדיין לא נוצרו משימות
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
'@ | Set-Content -Encoding utf8 .\src\app\page.tsx