"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Download, FilePenLine, FileSpreadsheet, FileText, Files, Search, Trash2 } from "lucide-react";

import {
  ECO_ARCHIVE_EDIT_STORAGE_KEY,
  ECO_ARCHIVE_RECORD_STORAGE_KEY,
  isEcoFormDescription,
  ADHESION_LEAK_TEST_ARCHIVE_EDIT_STORAGE_KEY,
  ADHESION_LEAK_TEST_ARCHIVE_RECORD_STORAGE_KEY,
  DEVELOPMENT_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY,
  DEVELOPMENT_INSPECTION_ARCHIVE_RECORD_STORAGE_KEY,
  downloadNameFromArchivedFile,
  isAdhesionFormDescription,
  isDevelopmentInspectionDescription,
  isPendingSignatureDescription,
  parseArchivedFormDescription,
  RIR_ARCHIVE_EDIT_STORAGE_KEY,
  SHELF_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY,
} from "@/lib/quality-forms/form-archive";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export type QualityFormArchiveRow = { id: string; title: string; description: string | null; file_name: string; file_size: number; mime_type: string | null; storage_path: string; created_at: string };
type ArchiveTab = "all" | "pending";

function formatDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jerusalem" }).formatToParts(new Date(value));
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.day}-${date.month}-${date.year}`;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function QualityFormArchive({ initialForms }: { initialForms: QualityFormArchiveRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<ArchiveTab>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const forms = useMemo(() => initialForms.filter((form) => !deletedIds.includes(form.id)), [initialForms, deletedIds]);
  const pendingCount = useMemo(() => forms.filter((form) => isPendingSignatureDescription(form.description)).length, [forms]);
  const visibleForms = useMemo(() => {
    const inTab = tab === "pending" ? forms.filter((form) => isPendingSignatureDescription(form.description)) : forms;
    const query = search.trim().toLocaleLowerCase("he");
    return query ? inTab.filter((form) => `${form.title} ${parseArchivedFormDescription(form.description).title} ${form.file_name}`.toLocaleLowerCase("he").includes(query)) : inTab;
  }, [forms, search, tab]);

  async function deleteForm(form: QualityFormArchiveRow) {
    if (!window.confirm(`למחוק את הטופס "${form.file_name}"? הפעולה תמחק גם את הקובץ ואינה ניתנת לביטול.`)) return;
    setDeletingId(form.id);
    setError("");
    try {
      const response = await fetch(`/api/forms/archive/${form.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "לא ניתן למחוק את הטופס");
      setDeletedIds((ids) => [...ids, form.id]);
      if (result.cleanupPending) toast.warning("הטופס הוסר מהמאגר, אך ניקוי הקובץ מהאחסון לא הושלם");
      else toast.success("הטופס והקובץ נמחקו");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "לא ניתן למחוק את הטופס");
    } finally {
      setDeletingId(null);
    }
  }

  async function download(form: QualityFormArchiveRow) {
    setError("");
    setDownloadingId(form.id);
    const { data, error: downloadError } = await createClient().storage.from("quality-documents").download(form.storage_path);
    setDownloadingId(null);
    if (downloadError || !data) return setError("לא ניתן להוריד את הטופס כרגע");
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadNameFromArchivedFile(form.file_name);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function openForEditing(form: QualityFormArchiveRow) {
    setError("");
    setOpeningId(form.id);
    try {
      const { data, error: downloadError } = await createClient().storage.from("quality-documents").download(form.storage_path);
      if (downloadError || !data) throw new Error("לא ניתן לפתוח את הטופס כרגע");
      const isExcel = form.file_name.toLowerCase().endsWith(".xlsx");
      const isAdhesion = form.file_name.toLowerCase().endsWith(".pdf") && isAdhesionFormDescription(form.description);
      const isEco = form.file_name.toLowerCase().endsWith(".pdf") && isEcoFormDescription(form.description);
      const isDevelopment = form.file_name.toLowerCase().endsWith(".pdf") && isDevelopmentInspectionDescription(form.description);
      const formData = new FormData();
      formData.append("file", data, form.file_name);
      const response = await fetch(isEco ? "/api/forms/eco/import" : isExcel ? "/api/forms/rir/import" : isAdhesion ? "/api/forms/adhesion-leak-test/import" : isDevelopment ? "/api/forms/development-inspection/import" : "/api/forms/shelf-product-inspection/import", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({})) as { payload?: unknown; error?: string };
      if (!response.ok || !result.payload) throw new Error(result.error || "לא ניתן לטעון את הטופס לעריכה");
      const storageKey = isEco ? ECO_ARCHIVE_EDIT_STORAGE_KEY : isExcel ? RIR_ARCHIVE_EDIT_STORAGE_KEY : isAdhesion ? ADHESION_LEAK_TEST_ARCHIVE_EDIT_STORAGE_KEY : isDevelopment ? DEVELOPMENT_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY : SHELF_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY;
      window.sessionStorage.setItem(storageKey, JSON.stringify(result.payload));
      if (isAdhesion) window.sessionStorage.setItem(ADHESION_LEAK_TEST_ARCHIVE_RECORD_STORAGE_KEY, form.id);
      if (isEco) window.sessionStorage.setItem(ECO_ARCHIVE_RECORD_STORAGE_KEY, form.id);
      if (isDevelopment) window.sessionStorage.setItem(DEVELOPMENT_INSPECTION_ARCHIVE_RECORD_STORAGE_KEY, form.id);
      router.push(isEco ? "/forms/eco?source=archive" : isExcel ? "/forms/rir?source=archive" : isAdhesion ? "/forms/adhesion-leak-test?source=archive" : isDevelopment ? "/forms/development-inspection?source=archive" : "/forms/shelf-product-inspection?source=archive");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "לא ניתן לפתוח את הטופס כרגע");
      setOpeningId(null);
    }
  }

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => setTab("all")} className={`flex items-center justify-between rounded-2xl border p-4 text-right transition ${tab === "all" ? "border-slate-950 bg-slate-950 text-white shadow-lg" : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"}`}>
        <span><span className="block font-black">כל הטפסים</span><span className={`mt-1 block text-sm font-semibold ${tab === "all" ? "text-slate-300" : "text-slate-500"}`}>כל הטפסים שנשמרו במערכת</span></span>
        <span className="flex items-center gap-2"><span className="text-2xl font-black">{forms.length}</span><Files className="h-6 w-6" /></span>
      </button>
      <button type="button" onClick={() => setTab("pending")} className={`flex items-center justify-between rounded-2xl border p-4 text-right transition ${tab === "pending" ? "border-amber-500 bg-amber-500 text-white shadow-lg" : "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400"}`}>
        <span><span className="block font-black">ממתינים לחתימה</span><span className={`mt-1 block text-sm font-semibold ${tab === "pending" ? "text-amber-50" : "text-amber-800"}`}>טפסים שעדיין חסרה בהם חתימה</span></span>
        <span className="flex items-center gap-2"><span className="text-2xl font-black">{pendingCount}</span><Clock3 className="h-6 w-6" /></span>
      </button>
    </div>
    <div className="relative max-w-xl"><Search className="absolute right-3 top-3 h-5 w-5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי ספק, תאריך, מק״ט או סוג טופס" className="h-11 w-full rounded-xl border border-slate-300 bg-white pr-10 pl-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></div>
    {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {visibleForms.length ? <div className="divide-y divide-slate-200">{visibleForms.map((form) => {
        const isExcel = form.file_name.toLowerCase().endsWith(".xlsx");
        const isWord = form.file_name.toLowerCase().endsWith(".docx");
        const isAdhesion = form.file_name.toLowerCase().endsWith(".pdf") && isAdhesionFormDescription(form.description);
        const isEco = form.file_name.toLowerCase().endsWith(".pdf") && isEcoFormDescription(form.description);
      const isDevelopment = form.file_name.toLowerCase().endsWith(".pdf") && isDevelopmentInspectionDescription(form.description);
        const pending = isPendingSignatureDescription(form.description);
        const formTitle = parseArchivedFormDescription(form.description).title;
        const Icon = isExcel ? FileSpreadsheet : FileText;
        return <article key={form.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_110px_300px] sm:items-center">
          <div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pending ? "bg-amber-100 text-amber-700" : isExcel ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words font-black text-slate-900">{form.file_name}</h2>{pending ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">ממתין לחתימה</span> : null}</div><p className="mt-1 text-sm font-semibold text-slate-500">{formTitle} · {formatSize(form.file_size)}</p></div></div>
          <time dir="ltr" className="text-left text-sm font-semibold text-slate-500" dateTime={form.created_at}>{formatDate(form.created_at)}</time>
          <div className="flex flex-wrap gap-2">{isExcel || isWord || isAdhesion || isDevelopment || isEco ? <button type="button" disabled={openingId === form.id} onClick={() => openForEditing(form)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-50"><FilePenLine className="h-4 w-4" />{openingId === form.id ? "פותח..." : pending ? "השלמת חתימה" : "פתיחה ועריכה"}</button> : null}<button type="button" disabled={downloadingId === form.id} onClick={() => download(form)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download className="h-4 w-4" />{downloadingId === form.id ? "מוריד..." : "הורדה"}</button>{pending ? <button type="button" disabled={deletingId !== null || openingId === form.id} onClick={() => deleteForm(form)} className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl border border-red-200 px-3 text-sm font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`מחיקת הטופס ${form.file_name}`}><Trash2 className="h-4 w-4" />{deletingId === form.id ? "מוחק..." : "מחיקה"}</button> : null}</div>
        </article>;
      })}</div> : <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center text-slate-500"><FileText className="h-10 w-10" /><p className="mt-3 font-extrabold">{tab === "pending" ? "אין טפסים שממתינים לחתימה" : forms.length ? "לא נמצאו טפסים מתאימים" : "המאגר עדיין ריק"}</p><p className="mt-1 text-sm">{tab === "pending" ? "טפסים שטרם הושלמו יופיעו כאן אוטומטית." : "טופס יופיע כאן אוטומטית לאחר שמירתו או הורדתו."}</p></div>}
    </section>
    <p className="text-sm font-semibold text-slate-500">מוצגים {visibleForms.length} מתוך {tab === "pending" ? pendingCount : forms.length} טפסים</p>
  </div>;
}
