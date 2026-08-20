"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteCompletedTask } from "@/app/tasks/actions";

export function DeleteCompletedTaskButton({
  taskId,
  taskTitle,
}: {
  taskId: string;
  taskTitle: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      `האם למחוק לצמיתות את המשימה "${taskTitle}"? לא ניתן לבטל פעולה זו.`,
    );
    if (!confirmed) return;

    setMessage("");
    startTransition(async () => {
      const result = await deleteCompletedTask(taskId);
      if (result.success) {
        router.refresh();
        return;
      }
      setMessage(result.message);
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" />
        {pending ? "מוחק..." : "מחיקה"}
      </button>
      {message ? (
        <p className="mt-1 max-w-40 text-xs font-bold text-red-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
