"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, FileSpreadsheet, Plus, Trash2, Upload } from "lucide-react";
import { createCalibration, deleteCalibration, importCalibrations } from "@/app/calibrations/actions";

export type CalibrationRow = { id: string; equipment_name: string; equipment_code: string | null; serial_number: string | null; location: string | null; next_calibration_date: string; notes: string | null };
const initial = { success: false, message: "" };

export function CalibrationsManager({ rows }: { rows: CalibrationRow[] }) {
  const router = useRouter(); const fileRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(createCalibration, initial);
  const [uploading, startUpload] = useTransition(); const [uploadMessage, setUploadMessage] = useState("");
  function upload(file?: File) {
    if (!file) return; const data = new FormData(); data.set("file", file); setUploadMessage("");
    startUpload(async () => { const result = await importCalibrations(data); setUploadMessage(result.message); if (result.success) router.refresh(); if (fileRef.current) fileRef.current.value = ""; });
  }
  return <div className="space-y-7">
    <div><h1 className="text-3xl font-extrabold sm:text-4xl">מעקב כיולים</h1><p className="mt-2 text-slate-500">מעקב אחר מועדי הכיול הבאים של ציוד ומכשירים</p></div>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-extrabold"><FileSpreadsheet className="text-emerald-600" /> ייבוא מקובץ Excel</h2>
        <p className="mt-2 text-sm text-slate-500">הקובץ צריך לכלול שם ציוד ותאריך כיול הבא. ניתן לצרף גם מספר ציוד, מספר סידורי ומיקום.</p>
        <input ref={fileRef} hidden type="file" accept=".xlsx,.xls" onChange={(event) => upload(event.target.files?.[0])} />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-5 font-bold text-white disabled:opacity-50"><Upload className="h-5 w-5" />{uploading ? "מייבא..." : "בחירת קובץ Excel"}</button>
        {uploadMessage && <p className="mt-3 text-sm font-bold text-slate-700">{uploadMessage}</p>}
      </div>
      <form action={action} className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-extrabold"><Plus /> הוספה ידנית</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><input required name="equipment_name" placeholder="שם ציוד" className="h-11 rounded-lg border px-3" /><input name="equipment_code" placeholder="מספר ציוד" className="h-11 rounded-lg border px-3" /><input name="serial_number" placeholder="מספר סידורי" className="h-11 rounded-lg border px-3" /><input name="location" placeholder="מיקום" className="h-11 rounded-lg border px-3" /><input required name="next_calibration_date" type="date" className="h-11 rounded-lg border px-3" /><input name="notes" placeholder="הערה" className="h-11 rounded-lg border px-3" /></div>
        <button disabled={pending} className="mt-4 h-11 rounded-lg bg-slate-950 px-5 font-bold text-white disabled:opacity-50">{pending ? "שומר..." : "הוסף כיול"}</button>{state.message && <span className="mr-3 text-sm font-bold">{state.message}</span>}
      </form>
    </section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-5"><h2 className="flex items-center gap-2 text-xl font-extrabold"><CalendarCheck2 /> רשימת כיולים ({rows.length})</h2></div>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right"><thead className="bg-slate-50 text-sm"><tr><th className="p-4">ציוד</th><th className="p-4">מספר ציוד</th><th className="p-4">מספר סידורי</th><th className="p-4">מיקום</th><th className="p-4">כיול הבא</th><th className="p-4" /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="p-4 font-bold">{row.equipment_name}</td><td className="p-4">{row.equipment_code || "—"}</td><td className="p-4">{row.serial_number || "—"}</td><td className="p-4">{row.location || "—"}</td><td className="p-4 font-bold">{new Intl.DateTimeFormat("he-IL").format(new Date(`${row.next_calibration_date}T12:00:00`))}</td><td className="p-4"><form action={deleteCalibration.bind(null, row.id)}><button aria-label="מחיקת כיול" className="text-slate-400 hover:text-red-600"><Trash2 className="h-5 w-5" /></button></form></td></tr>)}</tbody></table></div> : <p className="p-10 text-center text-slate-500">טרם נוספו פריטי כיול</p>}
    </section>
  </div>;
}
