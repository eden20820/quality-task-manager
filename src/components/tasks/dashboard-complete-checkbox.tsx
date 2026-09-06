"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { completeTask } from "@/app/tasks/actions";

export function DashboardCompleteCheckbox({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
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
    <label className="flex cursor-pointer flex-col items-center gap-1 text-[11px] font-bold text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={complete}
        aria-label={`סימון המשימה ${taskTitle} כבוצעה`}
        className="h-5 w-5 cursor-pointer accent-slate-950 disabled:cursor-wait"
      />
      <span>{pending ? "שומר..." : "בוצעה"}</span>
    </label>
  );
}
