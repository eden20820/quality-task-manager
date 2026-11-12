"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { EcoFormPayload } from "@/lib/quality-forms/eco-form";

export function EcoPreview({ payload, onClose }: { payload: EcoFormPayload; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    async function load() {
      try {
        const response = await fetch("/api/forms/eco/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "התצוגה המקדימה נכשלה");
        const blob = await response.blob();
        if (active) { const next = URL.createObjectURL(blob); urlRef.current = next; setUrl(next); }
      } catch (cause) { if (active) setError(controller.signal.aborted ? "יצירת התצוגה ארכה זמן רב מדי. אפשר לנסות שוב" : cause instanceof Error ? cause.message : "התצוגה המקדימה נכשלה"); }
      finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; } };
  }, [payload, attempt]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent dir="rtl" className="h-[92dvh] w-[96vw] grid-rows-[auto_auto_minmax(0,1fr)] sm:max-w-[96vw]">
      <DialogTitle className="pl-8 text-xl font-black">תצוגה מקדימה — ECO</DialogTitle>
      <DialogDescription>כך ייראה הקובץ בהורדה. התצוגה אינה שומרת עותק במאגר.</DialogDescription>
      {error ? <div role="alert" className="flex flex-col items-center justify-center gap-4 rounded-xl bg-red-50 p-5 text-red-900"><p>{error}</p><button type="button" className="rounded-lg border px-5 py-3 font-bold" onClick={() => { setError(null); setUrl(null); setAttempt(value => value + 1); }}>ניסיון נוסף</button></div> : url ? <div className="flex min-h-0 flex-col gap-2"><iframe title="תצוגה מקדימה של טופס ECO" src={url} className="min-h-0 w-full flex-1 rounded-lg border bg-slate-100" /><a href={url} target="_blank" rel="noopener noreferrer" className="text-center text-sm font-bold text-blue-700 underline">התצוגה לא מופיעה? פתיחה בחלון נפרד</a></div> : <div role="status" className="flex items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin" />מכין תצוגה מקדימה…</div>}
    </DialogContent>
  </Dialog>;
}
