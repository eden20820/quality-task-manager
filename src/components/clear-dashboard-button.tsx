"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function ClearDashboardButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
    >
      {pending && (
        <LoaderCircle
          className="h-4 w-4 animate-spin"
          aria-hidden="true"
        />
      )}

      <span>{pending ? "מנקה..." : "ניקוי"}</span>
    </button>
  );
}
