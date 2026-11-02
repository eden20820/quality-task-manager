"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export type QualityFormArchiveRow = { id: string; title: string; description: string | null; file_name: string; file_size: number; mime_type: string | null; storage_path: string; created_at: string };

function formatDate(value: string) { return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(value)); }
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export function QualityFormArchive({ initialForms }: { initialForms: QualityFormArchiveRow[] }) {
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const visibleForms = useMemo(() => { const query = search.trim().toLocaleLowerCase("he"); return query ? initialForms.filter((form) => `${form.title} ${form.description ?? ""} ${form.file_name}`.toLocaleLowerCase("he").includes(query)) : initialForms; }, [initialForms, search]);

  async function download(form: QualityFormArchiveRow) {
    setError(""); setDownloadingId(form.id);
    const { data, error: downloadError } = await createClient().storage.from("quality-documents").download(form.storage_path);
    setDownloadingId(null);
    if (downloadError || !data) return setError("לא ניתן להוריד את הטופס כרגע");
    const url = URL.createObjectURL(data); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = form.file_name; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="space-y-4"><div className="relative max-w-xl"><Search className="absolute right-3 top-3 h-5 w-5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי ספק, תאריך, מק״ט או סוג טופס" className="h-11 w-full rounded-xl border border-slate-300 bg-white pr-10 pl-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></div>{error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{visibleForms.length ? <div className="divide-y divide-slate-200">{visibleForms.map((form) => { const isExcel = form.file_name.toLowerCase().endsWith(".xlsx"); const Icon = isExcel ? FileSpreadsheet : FileText; return <article key={form.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_180px_110px] sm:items-center"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isExcel ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><h2 className="break-words font-black text-slate-900">{form.file_name}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{form.description ?? "טופס מקוון"} · {formatSize(form.file_size)}</p></div></div><time className="text-sm font-semibold text-slate-500" dateTime={form.created_at}>{formatDate(form.created_at)}</time><button type="button" disabled={downloadingId === form.id} onClick={() => download(form)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download className="h-4 w-4" />{downloadingId === form.id ? "מוריד..." : "הורדה"}</button></article>; })}</div> : <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center text-slate-500"><FileText className="h-10 w-10" /><p className="mt-3 font-extrabold">{initialForms.length ? "לא נמצאו טפסים מתאימים" : "המאגר עדיין ריק"}</p><p className="mt-1 text-sm">טופס יופיע כאן אוטומטית לאחר הורדתו.</p></div>}</section><p className="text-sm font-semibold text-slate-500">מוצגים {visibleForms.length} מתוך {initialForms.length} טפסים</p></div>;
}
