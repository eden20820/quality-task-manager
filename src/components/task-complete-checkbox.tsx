"use client";

import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";

import { completeTask } from "@/app/tasks/actions";

type TaskCompleteCheckboxProps = {
  taskId: string;
};

export function TaskCompleteCheckbox({
  taskId,
}: TaskCompleteCheckboxProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      ref={formRef}
      action={completeTask}
      className="flex items-center justify-center"
    >
      <input type="hidden" name="task_id" value={taskId} />

      {isSubmitting ? (
        <div
          className="flex items-center gap-2 text-sm font-semibold text-slate-500"
          aria-live="polite"
        >
          <LoaderCircle
            className="h-5 w-5 animate-spin"
            aria-hidden="true"
          />
          <span>משלים...</span>
        </div>
      ) : (
        <input
          type="checkbox"
          aria-label="סמן משימה כהושלמה"
          onChange={() => {
            setIsSubmitting(true);
            formRef.current?.requestSubmit();
          }}
          className="h-5 w-5 cursor-pointer accent-slate-950"
        />
      )}
    </form>
  );
}
