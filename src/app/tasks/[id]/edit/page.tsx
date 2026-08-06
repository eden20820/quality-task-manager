import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/server";

import { updateTask } from "../../actions";

type EditTaskPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTaskPage({
  params,
}: EditTaskPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select(`
      id,
      task_number,
      title,
      description,
      status,
      priority,
      due_date
    `)
    .eq("id", id)
    .single();

  if (error || !task) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h2 className="text-4xl font-extrabold">
            עריכת משימה #{task.task_number}
          </h2>

          <p className="mt-2 text-lg text-slate-500">
            עדכן את פרטי המשימה ושמור את השינויים
          </p>
        </div>

        <form
          action={updateTask}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <input type="hidden" name="task_id" value={task.id} />

          <div className="space-y-2">
            <label htmlFor="title" className="text-base font-bold">
              כותרת המשימה
            </label>

            <Input
              id="title"
              name="title"
              required
              defaultValue={task.title}
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-base font-bold">
              תיאור
            </label>

            <textarea
              id="description"
              name="description"
              defaultValue={task.description ?? ""}
              className="min-h-40 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-base font-bold">סטטוס</label>

              <Select name="status" defaultValue={task.status}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="new">חדשה</SelectItem>
                  <SelectItem value="in_progress">בטיפול</SelectItem>
                  <SelectItem value="waiting">ממתינה</SelectItem>
                  <SelectItem value="completed">הושלמה</SelectItem>
                  <SelectItem value="cancelled">בוטלה</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-base font-bold">עדיפות</label>

              <Select name="priority" defaultValue={task.priority}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="normal">רגילה</SelectItem>
                  <SelectItem value="high">גבוהה</SelectItem>
                  <SelectItem value="urgent">דחופה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="due_date" className="text-base font-bold">
              תאריך יעד
            </label>

            <Input
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={task.due_date ?? ""}
              className="h-12 text-base"
            />
          </div>

          <div className="flex gap-3 border-t border-slate-200 pt-6">
            <SubmitButton
              idleText="שמור שינויים"
              pendingText="שומר שינויים..."
            />

            <a
              href="/tasks"
              className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-8 text-base font-bold transition hover:bg-slate-50"
            >
              ביטול
            </a>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

