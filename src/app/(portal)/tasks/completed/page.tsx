import Link from "next/link";
import { Pencil, Undo2 } from "lucide-react";

import { restoreTask } from "@/app/tasks/actions";
import { DeleteCompletedTaskButton } from "@/components/tasks/delete-completed-task-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

function formatCompletedDate(value: string | null) {
  if (!value) {
    return {
      date: "לא ידוע",
      time: "לא ידוע",
    };
  }

  const completedDate = new Date(value);

  return {
    date: new Intl.DateTimeFormat("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(completedDate),

    time: new Intl.DateTimeFormat("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(completedDate),
  };
}

export default async function CompletedTasksPage() {
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(`
      id,
      task_number,
      title,
      priority,
      completed_at,
      completed_by
    `)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("Load completed tasks error:", error);
  }

  const completedTasks = tasks ?? [];

  const completedUserIds = [
    ...new Set(
      completedTasks
        .map((task) => task.completed_by)
        .filter((userId): userId is string => Boolean(userId))
    ),
  ];

  const { data: profiles } =
    completedUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", completedUserIds)
      : { data: [] };

  const profileNames = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name])
  );

  return (
    <>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            משימות שהושלמו
          </h2>

          <p className="mt-2 text-base text-slate-500 sm:text-lg">
            מעקב אחר משימות שבוצעו, מי השלים אותן ומתי
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-20 text-center text-base font-bold">
                  מצב
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  כותרת
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  סטטוס
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  הושלמה על ידי
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  תאריך
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  שעה
                </TableHead>

                <TableHead className="w-72 text-center text-base font-bold">
                  פעולות
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {completedTasks.length > 0 ? (
                completedTasks.map((task) => {
                  const completed = formatCompletedDate(task.completed_at);

                  return (
                    <TableRow key={task.id}>
                      <TableCell className="text-center">
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-full bg-blue-500"
                          aria-label="הושלמה"
                          title="הושלמה"
                        />
                      </TableCell>

                      <TableCell className="font-semibold">
                        {task.title}
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary">
                          הושלמה
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {task.completed_by
                          ? profileNames.get(task.completed_by) ?? "משתמש לא ידוע"
                          : "לא תועד"}
                      </TableCell>

                      <TableCell>{completed.date}</TableCell>

                      <TableCell>{completed.time}</TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/tasks/${task.id}/edit`}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold hover:bg-slate-50"
                          >
                            <Pencil className="h-4 w-4" />
                            עריכה
                          </Link>

                          <form action={restoreTask.bind(null, task.id)}>
                            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold hover:bg-slate-50">
                              <Undo2 className="h-4 w-4" />
                              שחזור
                            </button>
                          </form>

                          <DeleteCompletedTaskButton
                            taskId={task.id}
                            taskTitle={task.title}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="space-y-3">
                      <Badge variant="secondary">
                        אין משימות שהושלמו
                      </Badge>

                      <p className="text-base text-slate-500">
                        משימות שסומנו כבוצעו יופיעו כאן
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
