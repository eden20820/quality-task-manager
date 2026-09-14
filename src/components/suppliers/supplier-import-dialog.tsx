"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";

import { confirmSupplierImport, previewSupplierImport } from "@/app/suppliers/actions";
import type { EcoImportAction, EcoImportResolution } from "@/lib/eco-import";
import type { SupplierImportPreview } from "@/lib/supplier-import";

const styles: Record<EcoImportAction, string> = { new: "bg-emerald-100 text-emerald-800", update: "bg-amber-100 text-amber-800", duplicate: "bg-violet-100 text-violet-800", unchanged: "bg-slate-100 text-slate-700", invalid: "bg-red-100 text-red-700" };
const labels: Record<EcoImportAction, string> = { new: "חדש", update: "השתנה", duplicate: "כפול בקובץ", unchanged: "ללא שינוי", invalid: "לא תקין" };

export function SupplierImportDialog() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<SupplierImportPreview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, startSaving] = useTransition();
  const close = () => { if (!saving) { setOpen(false); setPreview(null); setError(""); } };

  async function readFile(file?: File) {
    if (!file) return;
    setReading(true); setError(""); setMessage("");
    const formData = new FormData(); formData.set("file", file);
    try { const result = await previewSupplierImport(formData); if (result.success) setPreview(result.preview); else setError(result.message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "קריאת הקובץ נכשלה"); }
    finally { setReading(false); }
  }

  function updateRow(index: number, resolution: EcoImportResolution) { setPreview((current) => current ? { ...current, rows: current.rows.map((row, i) => i === index ? { ...row, resolution } : row) } : null); }
  function applyToUpdates(resolution: EcoImportResolution) { setPreview((current) => current ? { ...current, rows: current.rows.map((row) => row.action === "update" ? { ...row, resolution } : row) } : null); }
  function confirm() { if (!preview) return; setError(""); startSaving(async () => { const result = await confirmSupplierImport(preview.rows); if (result.success) { setMessage(result.message); setOpen(false); setPreview(null); } else setError(result.message); }); }
  const selected = preview?.rows.filter((row) => (row.action === "new" || row.action === "update") && row.resolution === "import").length ?? 0;

  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 font-bold text-slate-800 shadow-sm hover:bg-slate-50"><Upload className="h-4 w-4" />ייבוא ספקים מ-Excel</button>
    {message ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="ml-2 inline h-4 w-4" />{message}</p> : null}
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="supplier-import-title">
      <button type="button" aria-label="סגירת חלון הייבוא" className="absolute inset-0 bg-slate-950/60" onClick={close} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b p-5"><div><h2 id="supplier-import-title" className="text-2xl font-extrabold">ייבוא ספקים מ-Excel</h2><p className="mt-1 text-sm text-slate-500">הלשונית Approved Suppliers List נסרקת ומושווית לספקים הקיימים לפני השמירה. ספקים לא פעילים אינם מיובאים.</p></div><button type="button" onClick={close} disabled={saving} aria-label="סגירה" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        {!preview ? <div className="overflow-auto p-6"><button type="button" onClick={() => inputRef.current?.click()} disabled={reading} className="flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-slate-400 disabled:opacity-60">{reading ? <LoaderCircle className="mb-3 h-10 w-10 animate-spin" /> : <FileSpreadsheet className="mb-3 h-10 w-10 text-emerald-600" />}<span className="text-lg font-extrabold">{reading ? "סורק ומשווה..." : "בחירת קובץ Excel"}</span><span className="mt-2 text-sm text-slate-500">XLSX או XLS, עד 10MB</span></button><input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={(event) => readFile(event.target.files?.[0])} /></div> : <>
          <div className="border-b bg-slate-50 p-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[["חדשים", preview.newCount, "text-emerald-700"], ["עדכונים", preview.updatedCount, "text-amber-700"], ["כפילויות", preview.duplicateCount, "text-violet-700"], ["ללא שינוי", preview.unchangedCount, "text-slate-700"], ["לא תקינים", preview.invalidCount, "text-red-700"]].map(([label, value, tone]) => <div key={String(label)} className={`rounded-xl border bg-white p-3 text-center ${tone}`}><p className="text-xs font-bold">{label}</p><p className="text-2xl font-black">{value}</p></div>)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{preview.fileName}{preview.ignoredCount ? ` • ${preview.ignoredCount} שורות שאינן ספקים דולגו` : ""}</span>{preview.updatedCount ? <div className="flex gap-2"><button type="button" onClick={() => applyToUpdates("keep")} className="rounded border bg-white px-2 py-1">שמירת הקיים</button><button type="button" onClick={() => applyToUpdates("import")} className="rounded border bg-white px-2 py-1">עדכון מ-Excel</button><button type="button" onClick={() => applyToUpdates("skip")} className="rounded border bg-white px-2 py-1">דילוג</button></div> : null}</div></div>
          <div className="overflow-auto p-4"><table className="w-full min-w-[920px] text-right text-sm"><thead className="sticky top-0 bg-white text-xs text-slate-500"><tr><th className="p-3">ספק</th><th className="p-3">סיווג</th><th className="p-3">השוואה</th><th className="p-3">פעולה</th></tr></thead><tbody className="divide-y">{preview.rows.map((row, index) => <tr key={row.key} className="align-top"><td className="p-3 font-extrabold">{row.label}<span className="block text-xs font-normal text-slate-400">שורה {row.rowNumber}</span></td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${styles[row.action]}`}>{labels[row.action]}</span></td><td className="p-3">{row.error ? <p className="font-semibold text-red-700">{row.error}</p> : row.changes.length ? <div className="space-y-2">{row.changes.map((change) => <div key={change.field} className="grid grid-cols-[120px_1fr_1fr] gap-2 rounded-lg bg-slate-50 p-2"><b>{change.field}</b><span><small className="block">קיים</small>{change.before}</span><span className="text-amber-900"><small className="block">Excel</small>{change.after}</span></div>)}</div> : <span className="text-slate-500">{row.action === "new" ? "ספק חדש" : "זהה לספק הקיים"}</span>}</td><td className="p-3">{row.action === "new" || row.action === "update" ? <select value={row.resolution} onChange={(event) => updateRow(index, event.target.value as EcoImportResolution)} className="h-9 rounded-lg border bg-white px-2 font-bold"><option value={row.action === "update" ? "keep" : "import"}>{row.action === "update" ? "שמירת הקיים" : "הוספה"}</option>{row.action === "update" ? <option value="import">עדכון מ-Excel</option> : null}<option value="skip">דילוג</option></select> : <span className="text-xs text-slate-500">לא יישמר</span>}</td></tr>)}</tbody></table></div>
        </>}
        {error ? <p role="alert" className="mx-5 mb-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700"><AlertTriangle className="ml-2 inline h-4 w-4" />{error}</p> : null}
        <div className="flex items-center justify-between border-t p-4"><button type="button" onClick={preview ? () => { setPreview(null); setError(""); } : close} disabled={saving} className="h-10 rounded-lg border px-4 font-bold text-slate-600">{preview ? "בחירת קובץ אחר" : "ביטול"}</button>{preview ? <button type="button" onClick={confirm} disabled={saving || !selected} className="flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-6 font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{saving ? "שומר..." : `אישור ושמירת ${selected} שינויים`}</button> : null}</div>
      </div>
    </div> : null}
  </>;
}
