"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";
import { confirmEcoImport, previewEcoImport } from "@/app/followups/actions";
import type { EcoImportAction, EcoImportPreview, EcoImportResolution, EcoImportRow } from "@/lib/eco-import";

const statusStyles: Record<EcoImportAction, string> = {
  new: "bg-emerald-100 text-emerald-800",
  update: "bg-amber-100 text-amber-800",
  duplicate: "bg-violet-100 text-violet-800",
  unchanged: "bg-slate-100 text-slate-700",
  invalid: "bg-red-100 text-red-700",
};

const statusLabels: Record<EcoImportAction, string> = {
  new: "חדש",
  update: "השתנה",
  duplicate: "כפול בקובץ",
  unchanged: "ללא שינוי",
  invalid: "לא תקין",
};

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`rounded-xl border px-3 py-3 text-center ${tone}`}><p className="text-xs font-bold">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}

function ResolutionSelect({ row, onChange }: { row: EcoImportRow; onChange: (resolution: EcoImportResolution) => void }) {
  if (row.action === "new") return <select aria-label={`פעולה עבור ${row.label}`} value={row.resolution} onChange={(event) => onChange(event.target.value as EcoImportResolution)} className="h-9 rounded-lg border bg-white px-2 text-sm font-bold"><option value="import">הוספה</option><option value="skip">דילוג</option></select>;
  if (row.action === "update") return <select aria-label={`פעולה עבור ${row.label}`} value={row.resolution} onChange={(event) => onChange(event.target.value as EcoImportResolution)} className="h-9 rounded-lg border bg-white px-2 text-sm font-bold"><option value="keep">שמירת הקיים</option><option value="import">עדכון מ-Excel</option><option value="skip">דילוג</option></select>;
  return <span className="text-xs font-semibold text-slate-500">לא יישמר</span>;
}

export function EcoImportDialog() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<EcoImportPreview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, startSaving] = useTransition();

  function close() {
    if (saving) return;
    setOpen(false);
    setPreview(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function readFile(file?: File) {
    if (!file) return;
    setReading(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await previewEcoImport(formData);
      if (result.success) setPreview(result.preview);
      else setError(result.message);
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "קריאת הקובץ נכשלה");
    } finally {
      setReading(false);
    }
  }

  function updateRow(index: number, resolution: EcoImportResolution) {
    setPreview((current) => current ? { ...current, rows: current.rows.map((row, rowIndex) => rowIndex === index ? { ...row, resolution } : row) } : current);
  }

  function applyToUpdates(resolution: EcoImportResolution) {
    setPreview((current) => current ? { ...current, rows: current.rows.map((row) => row.action === "update" ? { ...row, resolution } : row) } : current);
  }

  function confirm() {
    if (!preview) return;
    setError("");
    startSaving(async () => {
      const result = await confirmEcoImport(preview.rows, preview.fileName);
      if (result.success) {
        setMessage(result.message);
        setOpen(false);
        setPreview(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError(result.message);
      }
    });
  }

  const selectedCount = preview?.rows.filter((row) => (row.action === "new" || row.action === "update") && row.resolution === "import").length ?? 0;

  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 font-bold text-slate-800 shadow-sm hover:bg-slate-50"><Upload className="h-4 w-4" />ייבוא ECO מ-Excel</button>
    {message ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="ml-2 inline h-4 w-4" />{message}</p> : null}
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="eco-import-title">
      <button type="button" aria-label="סגירת חלון הייבוא" className="absolute inset-0 bg-slate-950/60" onClick={close} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div><h2 id="eco-import-title" className="text-2xl font-extrabold">ייבוא מעקב ECO</h2><p className="mt-1 text-sm text-slate-500">הקובץ נסרק ומושווה לרשומות הקיימות לפני כל שמירה.</p></div>
          <button type="button" onClick={close} disabled={saving} aria-label="סגירה" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        {!preview ? <div className="overflow-auto p-6">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={reading} className="flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-slate-400 disabled:opacity-60">
            {reading ? <LoaderCircle className="mb-3 h-10 w-10 animate-spin text-slate-500" /> : <FileSpreadsheet className="mb-3 h-10 w-10 text-emerald-600" />}
            <span className="text-lg font-extrabold">{reading ? "סורק ומשווה..." : "בחירת קובץ Excel"}</span><span className="mt-2 text-sm text-slate-500">XLSX או XLS, עד 10MB</span>
          </button>
          <input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={(event) => readFile(event.target.files?.[0])} />
        </div> : <>
          <div className="border-b bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <SummaryCard label="חדשים" value={preview.newCount} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
              <SummaryCard label="עדכונים" value={preview.updatedCount} tone="border-amber-200 bg-amber-50 text-amber-800" />
              <SummaryCard label="כפילויות" value={preview.duplicateCount} tone="border-violet-200 bg-violet-50 text-violet-800" />
              <SummaryCard label="ללא שינוי" value={preview.unchangedCount} tone="border-slate-200 bg-white text-slate-700" />
              <SummaryCard label="לא תקינים" value={preview.invalidCount} tone="border-red-200 bg-red-50 text-red-700" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{preview.fileName}{preview.ignoredCount ? ` • ${preview.ignoredCount} שורות חתימה/אישור זוהו ודולגו` : ""}</span>{preview.updatedCount ? <div className="flex items-center gap-2"><span className="font-bold text-slate-700">החלה על כל העדכונים:</span><button type="button" onClick={() => applyToUpdates("keep")} className="rounded border bg-white px-2 py-1">שמירת הקיים</button><button type="button" onClick={() => applyToUpdates("import")} className="rounded border bg-white px-2 py-1">עדכון מ-Excel</button><button type="button" onClick={() => applyToUpdates("skip")} className="rounded border bg-white px-2 py-1">דילוג</button></div> : null}</div>
          </div>
          <div className="overflow-auto p-4">
            <table className="w-full min-w-[920px] text-right text-sm"><thead className="sticky top-0 z-10 bg-white text-xs text-slate-500 shadow-[0_1px_0_#e2e8f0]"><tr><th className="p-3">ECO</th><th className="p-3">סיווג</th><th className="p-3">השוואה</th><th className="p-3">פעולה</th></tr></thead>
              <tbody className="divide-y">{preview.rows.map((row, index) => <tr key={row.key} className="align-top hover:bg-slate-50"><td className="whitespace-nowrap p-3"><p className="font-extrabold">{row.label}</p><p className="text-xs text-slate-400">שורה {row.rowNumber}</p></td><td className="p-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[row.action]}`}>{statusLabels[row.action]}</span></td><td className="p-3">{row.error ? <p className="font-semibold text-red-700">{row.error}</p> : row.changes.length ? <div className="space-y-2">{row.changes.map((change) => <div key={change.field} className="grid grid-cols-[110px_1fr_1fr] gap-2 rounded-lg bg-slate-50 p-2"><b>{change.field}</b><span className="rounded bg-white px-2 py-1 text-slate-500"><span className="block text-[10px] font-bold uppercase">קיים</span>{change.before}</span><span className="rounded bg-amber-50 px-2 py-1 text-amber-900"><span className="block text-[10px] font-bold uppercase">Excel</span>{change.after}</span></div>)}</div> : <span className="text-slate-500">{row.action === "new" ? "רשומה חדשה" : "זהה לרשומה הקיימת"}</span>}</td><td className="p-3"><ResolutionSelect row={row} onChange={(resolution) => updateRow(index, resolution)} /></td></tr>)}</tbody>
            </table>
          </div>
        </>}

        {error ? <p role="alert" className="mx-5 mb-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700"><AlertTriangle className="ml-2 inline h-4 w-4" />{error}</p> : null}
        <div className="flex items-center justify-between gap-3 border-t p-4"><button type="button" onClick={preview ? () => { setPreview(null); setError(""); if (inputRef.current) inputRef.current.value = ""; } : close} disabled={saving} className="h-10 rounded-lg border px-4 font-bold text-slate-600">{preview ? "בחירת קובץ אחר" : "ביטול"}</button>{preview ? <button type="button" onClick={confirm} disabled={saving || selectedCount === 0} className="flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-6 font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{saving ? "שומר..." : `אישור ושמירת ${selectedCount} שינויים`}</button> : null}</div>
      </div>
    </div> : null}
  </>;
}
