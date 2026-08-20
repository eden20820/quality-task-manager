import Link from "next/link";

import { PaginationControls } from "@/components/pagination-controls";
import { TaskTable, type TaskRow } from "@/components/tasks/task-table";
import { PAGE_SIZE, pageRange, parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("tasks")
    .select("id, task_number, title, status, priority, due_date, updated_at", { count: "exact" })
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) console.error("Load tasks error:", error);

  return <div className="space-y-8">
    <div className="flex items-center justify-between gap-4">
      <div><h2 className="text-3xl font-extrabold sm:text-4xl">משימות</h2><p className="mt-2 text-base text-slate-500 sm:text-lg">ניהול, סינון ומעקב אחר כל המשימות הפעילות</p></div>
      <Link href="/tasks/new" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary/90">משימה חדשה</Link>
    </div>
    <TaskTable key={page} initialTasks={(data ?? []) as TaskRow[]} />
    <PaginationControls basePath="/tasks" page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
  </div>;
}
