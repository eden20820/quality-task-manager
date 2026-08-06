"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  idleText: string;
  pendingText: string;
  className?: string;
};

export function SubmitButton({
  idleText,
  pendingText,
  className = "",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-8 text-base font-bold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending && (
        <LoaderCircle
          className="h-5 w-5 animate-spin"
          aria-hidden="true"
        />
      )}

      <span>{pending ? pendingText : idleText}</span>
    </button>
  );
}
