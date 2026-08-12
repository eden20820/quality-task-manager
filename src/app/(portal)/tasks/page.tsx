import Link from "next/link";

import { TaskTable, type TaskRow } from "@/components/tasks/task-table";
import { createClient } from "@/lib/supabase/server";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, task_number, title, status, priority, due_date, updated_at")
    .neq("status", "completed")
    .order("created_at", { ascending: false });

  if (error) console.error("Load tasks error:", error);

  return <div className="space-y-8">
    <div className="flex items-center justify-between gap-4">
      <div><h2 className="text-4xl font-extrabold">משימות</h2><p className="mt-2 text-lg text-slate-500">ניהול, סינון ומעקב אחר כל המשימות הפעילות</p></div>
      <Link href="/tasks/new" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary/90">משימה חדשה</Link>
    </div>
    <TaskTable initialTasks={(data ?? []) as TaskRow[]} />
  </div>;
}
