"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { completeTask } from "@/app/tasks/actions";

export function DashboardCompleteCheckbox({ taskId, taskTitle, compact = false }: { taskId: string; taskTitle: string; compact?: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();

  function complete() {
    if (pending || checked) return;
    setChecked(true);
    startTransition(async () => {
      const result = await completeTask(taskId);
      if (!result.success) {
        setChecked(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <label className={`cursor-pointer font-bold text-slate-600 ${compact ? "inline-flex h-9 shrink-0 flex-row items-center gap-2 rounded-lg border bg-white px-3 text-xs hover:bg-emerald-50" : "flex flex-col items-center gap-1 text-[11px]"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={complete}
        aria-label={`סימון המשימה ${taskTitle} כבוצעה`}
        className="h-5 w-5 cursor-pointer accent-slate-950 disabled:cursor-wait"
      />
      <span>{pending ? "שומר..." : compact ? "סימון כבוצעה" : "בוצעה"}</span>
    </label>
  );
}
