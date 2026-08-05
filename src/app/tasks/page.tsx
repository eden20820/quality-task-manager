import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
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
              ניהול, סינון ומעקב אחר כל משימות המחלקה
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
              <SelectItem value="completed">הושלמה</SelectItem>
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
              </TableRow>
            </TableHeader>

            <TableBody>
              {tasks && tasks.length > 0 ? (
                tasks.map((task) => (
                  <TableRow key={task.id}>
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

                    <TableCell>{formatDateTime(task.updated_at)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Badge variant="secondary" className="px-4 py-1 text-sm">
                        אין משימות להצגה
                      </Badge>

                      <p className="text-base text-slate-500">
                        צור משימה חדשה כדי להתחיל לעבוד
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
