"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { completeTask, deleteActiveTask } from "@/app/tasks/actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export type TaskRow = {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  assignees: string[];
  status: string;
  priority: string;
  due_date: string | null;
  updated_at: string;
};

const statusLabels: Record<string, string> = {
  new: "חדשה", in_progress: "בטיפול", waiting: "ממתינה",
  completed: "הושלמה", cancelled: "בוטלה",
};
const priorityLabels: Record<string, string> = {
  normal: "רגילה", high: "גבוהה", urgent: "דחופה",
};
const assigneeLabels: Record<string, string> = {
  eden: "עדן", sergey: "סרגיי", quality_manager: "עמית",
};

function formatDate(value: string | null) {
  if (!value) return "ללא תאריך";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export function TaskTable({ initialTasks }: { initialTasks: TaskRow[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [error, setError] = useState("");
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("active-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        const next = payload.new as Partial<TaskRow>;
        const old = payload.old as Partial<TaskRow>;
        setTasks((current) => {
          if (payload.eventType === "DELETE") return current.filter((task) => task.id !== old.id);
          if (!next.id) return current;
          if (next.status === "completed") return current.filter((task) => task.id !== next.id);
          const index = current.findIndex((task) => task.id === next.id);
          if (index === -1) return next.title ? [next as TaskRow, ...current] : current;
          return current.map((task) => task.id === next.id ? { ...task, ...next } : task);
        });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) =>
      (!query || task.title.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query) || task.assignees.some((assignee) => (assigneeLabels[assignee] ?? assignee).toLowerCase().includes(query)) || String(task.task_number).includes(query)) &&
      (status === "all" || task.status === status) &&
      (priority === "all" || task.priority === priority)
    );
  }, [tasks, search, status, priority]);

  function markComplete(task: TaskRow) {
    setError("");
    setTasks((current) => current.filter((item) => item.id !== task.id));
    startTransition(async () => {
      const result = await completeTask(task.id);
      if (!result.success) {
        setTasks((current) => [task, ...current]);
        setError(result.message);
      }
    });
  }

  function removeTask(task: TaskRow) {
    const confirmed = window.confirm(`האם למחוק לצמיתות את המשימה "${task.title}"? לא ניתן לבטל פעולה זו.`);
    if (!confirmed) return;

    setError("");
    setDeletingTaskId(task.id);
    setTasks((current) => current.filter((item) => item.id !== task.id));
    startTransition(async () => {
      const result = await deleteActiveTask(task.id);
      setDeletingTaskId(null);
      if (!result.success) {
        setTasks((current) => [task, ...current]);
        setError(result.message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_220px_220px]">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי כותרת, הערה, אחראי או מספר משימה" className="h-11 text-base" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-md border border-slate-200 bg-white px-3 text-base">
          <option value="all">כל הסטטוסים</option><option value="new">חדשה</option><option value="in_progress">בטיפול</option><option value="waiting">ממתינה</option><option value="cancelled">בוטלה</option>
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-11 rounded-md border border-slate-200 bg-white px-3 text-base">
          <option value="all">כל העדיפויות</option><option value="normal">רגילה</option><option value="high">גבוהה</option><option value="urgent">דחופה</option>
        </select>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
      <div className="space-y-3 md:hidden">
        {visibleTasks.length ? visibleTasks.map((task) => (
          <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0"><p className="break-words font-extrabold text-slate-950">{task.title}</p><p className={`mt-1 whitespace-pre-wrap break-words text-sm leading-5 ${task.description ? "text-slate-600" : "text-slate-400"}`}>{task.description || "אין הערות"}</p></div>
              <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full ${task.status === "new" ? "bg-emerald-500" : task.status === "in_progress" ? "bg-amber-400" : task.status === "waiting" ? "bg-orange-500" : "bg-slate-400"}`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge variant="secondary">{statusLabels[task.status] ?? task.status}</Badge><span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold">{priorityLabels[task.priority] ?? task.priority}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold">יעד: {formatDate(task.due_date)}</span></div>
            <p className="mt-3 text-sm font-bold text-blue-700">אחראים: {task.assignees.length ? task.assignees.map((assignee) => assigneeLabels[assignee] ?? assignee).join(", ") : "לא הוגדר"}</p>
            <p className="mt-1 text-xs text-slate-500">עדכון אחרון: {formatDateTime(task.updated_at)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2"><button type="button" onClick={() => markComplete(task)} className="h-10 rounded-lg bg-emerald-50 px-2 text-sm font-bold text-emerald-800">הושלמה</button><Link href={`/tasks/${task.id}/edit`} className="flex h-10 items-center justify-center rounded-lg border px-2 text-sm font-bold">עריכה</Link><button type="button" disabled={deletingTaskId === task.id} onClick={() => removeTask(task)} className="flex h-10 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-sm font-bold text-red-700"><Trash2 className="h-4 w-4" />מחיקה</button></div>
          </article>
        )) : <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">אין משימות התואמות לסינון</div>}
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <Table className="min-w-[1050px]">
          <TableHeader><TableRow className="bg-slate-50">
            <TableHead className="w-24 text-center font-bold">בוצעה</TableHead><TableHead className="w-20 text-center font-bold">מצב</TableHead><TableHead className="min-w-72 text-right font-bold">משימה והערות</TableHead><TableHead className="min-w-32 text-right font-bold">אחראים</TableHead><TableHead className="text-right font-bold">סטטוס</TableHead><TableHead className="text-right font-bold">עדיפות</TableHead><TableHead className="text-right font-bold">תאריך יעד</TableHead><TableHead className="text-right font-bold">עדכון אחרון</TableHead><TableHead className="w-44 text-center font-bold">פעולות</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {visibleTasks.length ? visibleTasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="text-center"><input type="checkbox" aria-label="סמן משימה כהושלמה" onChange={() => markComplete(task)} className="h-5 w-5 cursor-pointer accent-slate-950" /></TableCell>
                <TableCell className="text-center"><span className={`inline-block h-3.5 w-3.5 rounded-full ${task.status === "new" ? "bg-emerald-500" : task.status === "in_progress" ? "bg-amber-400" : task.status === "waiting" ? "bg-orange-500" : "bg-slate-400"}`} /></TableCell>
                <TableCell className="max-w-md align-top"><p className="font-bold text-slate-950">{task.title}</p><p className={`mt-1 whitespace-pre-wrap text-sm leading-5 ${task.description ? "text-slate-600" : "text-slate-400"}`}>{task.description || "אין הערות"}</p></TableCell>
                <TableCell className="align-top"><div className="flex flex-wrap gap-1.5">{task.assignees.length ? task.assignees.map((assignee) => <span key={assignee} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{assigneeLabels[assignee] ?? assignee}</span>) : <span className="text-sm text-slate-400">לא הוגדר</span>}</div></TableCell>
                <TableCell><Badge variant="secondary">{statusLabels[task.status] ?? task.status}</Badge></TableCell><TableCell>{priorityLabels[task.priority] ?? task.priority}</TableCell><TableCell>{formatDate(task.due_date)}</TableCell><TableCell>{formatDateTime(task.updated_at)}</TableCell>
                <TableCell className="text-center"><div className="flex items-center justify-center gap-2"><Link href={`/tasks/${task.id}/edit`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-bold hover:bg-slate-50">עריכה</Link><button type="button" disabled={deletingTaskId === task.id} onClick={() => removeTask(task)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 className="h-4 w-4" />{deletingTaskId === task.id ? "מוחק..." : "מחיקה"}</button></div></TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={9} className="h-64 text-center text-slate-500">אין משימות התואמות לסינון</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm font-medium text-slate-500">מוצגות {visibleTasks.length} מתוך {tasks.length} משימות</p>
    </div>
  );
}
