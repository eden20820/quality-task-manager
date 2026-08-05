import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { TaskCompleteCheckbox } from "@/components/task-complete-checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function TasksPage() {
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
      updated_at
    `)
    .neq("status", "completed")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load tasks error:", error);
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-extrabold">משימות</h2>

            <p className="mt-2 text-lg text-slate-500">
              ניהול, סינון ומעקב אחר כל המשימות הפעילות
            </p>
          </div>

          <Link
            href="/tasks/new"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            משימה חדשה
          </Link>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_220px_220px]">
          <Input
            placeholder="חיפוש לפי כותרת, תיאור או מספר משימה"
            className="h-11 text-base"
          />

          <Select>
            <SelectTrigger className="h-11 text-base">
              <SelectValue placeholder="כל הסטטוסים" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="new">חדשה</SelectItem>
              <SelectItem value="in_progress">בטיפול</SelectItem>
              <SelectItem value="waiting">ממתינה</SelectItem>
              <SelectItem value="cancelled">בוטלה</SelectItem>
            </SelectContent>
          </Select>

          <Select>
            <SelectTrigger className="h-11 text-base">
              <SelectValue placeholder="כל העדיפויות" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">כל העדיפויות</SelectItem>
              <SelectItem value="normal">רגילה</SelectItem>
              <SelectItem value="high">גבוהה</SelectItem>
              <SelectItem value="urgent">דחופה</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-24 text-center text-base font-bold">
                  בוצעה
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  מספר
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  כותרת
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  סטטוס
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  עדיפות
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  תאריך יעד
                </TableHead>

                <TableHead className="text-right text-base font-bold">
                  עדכון אחרון
                </TableHead>

                <TableHead className="w-24 text-center text-base font-bold">
                  עריכה
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {tasks && tasks.length > 0 ? (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <TaskCompleteCheckbox taskId={task.id} />
                    </TableCell>

                    <TableCell className="font-bold">
                      #{task.task_number}
                    </TableCell>

                    <TableCell className="font-semibold">
                      {task.title}
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">
                        {statusLabels[task.status] ?? task.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {priorityLabels[task.priority] ?? task.priority}
                    </TableCell>

                    <TableCell>{formatDate(task.due_date)}</TableCell>

                    <TableCell>
                      {formatDateTime(task.updated_at)}
                    </TableCell>

                    <TableCell className="text-center">
                      <Link
                        href={`/tasks/${task.id}/edit`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-bold transition hover:bg-slate-50"
                      >
                        עריכה
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Badge variant="secondary" className="px-4 py-1 text-sm">
                        אין משימות פעילות
                      </Badge>

                      <p className="text-base text-slate-500">
                        כל המשימות הושלמו או שעדיין לא נוצרו משימות
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}

