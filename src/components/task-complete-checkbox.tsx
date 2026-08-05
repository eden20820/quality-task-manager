"use client";

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

      <input
        type="checkbox"
        aria-label="סמן משימה כהושלמה"
        disabled={isSubmitting}
        onChange={() => {
          setIsSubmitting(true);
          formRef.current?.requestSubmit();
        }}
        className="h-5 w-5 cursor-pointer accent-slate-950 disabled:cursor-wait"
      />
    </form>
  );
}
