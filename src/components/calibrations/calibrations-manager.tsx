"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Bell, BellOff, CalendarCheck2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createCalibration, deleteCalibration, previewCalibrationImport, confirmCalibrationImport, setCalibrationAlertsEnabled, updateCalibration } from "@/app/calibrations/actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExcelImportPreview } from "@/components/imports/excel-import-preview";

export type CalibrationRow = {
  id: string; equipment_name: string; serial_number: string | null; model: string | null; location: string | null;
  last_calibration_date: string | null; next_calibration_date: string | null; certificate_number: string | null;
  calibration_lab: string | null; notes: string | null; is_active: boolean;
};
type Filter = "all" | "expired" | "upcoming" | "valid" | "missing" | "removed";
const initial = { success: false, message: "" };

function daysLeft(value: string | null) {
  if (!value) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("he-IL").format(new Date(`${value}T12:00:00`)) : "—"; }
function dateStatus(value: string | null) {
  const days = daysLeft(value);
  if (days === null) return { text: "חסר מועד", color: "bg-slate-100 text-slate-700" };
  if (days < 0) return { text: `באיחור ${Math.abs(days)} ימים`, color: "bg-red-100 text-red-700" };
  if (days === 0) return { text: "היום", color: "bg-red-100 text-red-700" };
  if (days <= 30) return { text: `בעוד ${days} ימים`, color: "bg-orange-100 text-orange-700" };
  if (days <= 90) return { text: `בעוד ${days} ימים`, color: "bg-amber-100 text-amber-700" };
  return { text: "בתוקף", color: "bg-emerald-100 text-emerald-700" };
}

export function CalibrationsManager({ rows, alertsEnabled }: { rows: CalibrationRow[]; alertsEnabled: boolean }) {
  const [state, action, pending] = useActionState(createCalibration, initial);
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<CalibrationRow | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [savingEdit, startEdit] = useTransition();
  const counts = useMemo(() => ({
    all: rows.filter((r) => r.is_active).length,
    expired: rows.filter((r) => { const d = daysLeft(r.next_calibration_date); return r.is_active && d !== null && d < 0; }).length,
    upcoming: rows.filter((r) => { const d = daysLeft(r.next_calibration_date); return r.is_active && d !== null && d >= 0 && d <= 90; }).length,
    missing: rows.filter((r) => r.is_active && !r.next_calibration_date).length,
  }), [rows]);
  const visible = useMemo(() => rows.filter((row) => {
    const q = search.trim().toLowerCase();
    const matches = !q || [row.equipment_name, row.serial_number, row.model, row.location, row.certificate_number, row.calibration_lab].some((v) => v?.toLowerCase().includes(q));
    if (!matches) return false; const d = daysLeft(row.next_calibration_date);
    if (filter === "removed") return !row.is_active;
    if (!row.is_active) return false;
    if (filter === "expired") return d !== null && d < 0;
    if (filter === "upcoming") return d !== null && d >= 0 && d <= 90;
    if (filter === "valid") return d !== null && d > 90;
    if (filter === "missing") return d === null;
    return true;
  }), [rows, search, filter]);
  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formData = new FormData(event.currentTarget); setEditMessage("");
    startEdit(async () => { const result = await updateCalibration(formData); setEditMessage(result.message); if (result.success) setEditing(null); });
  }
  const cards: Array<[Filter, string, number, string]> = [["all", "כלים פעילים", counts.all, "text-slate-950"], ["expired", "כיול באיחור", counts.expired, "text-red-600"], ["upcoming", "כיול עד 90 יום", counts.upcoming, "text-orange-600"], ["missing", "חסר מועד", counts.missing, "text-slate-500"]];
  return <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-3xl font-extrabold sm:text-4xl">מעקב כיולים</h1><p className="mt-2 text-slate-500">רשימת ציוד לכיול לפי טופס 7.1.5.1.0</p></div>
      <form action={setCalibrationAlertsEnabled.bind(null, !alertsEnabled)}>
        <button type="submit" className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-5 font-bold transition ${alertsEnabled ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"}`}>
          {alertsEnabled ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {alertsEnabled ? "כיבוי התראות כיולים" : "הפעלת התראות כיולים"}
        </button>
      </form>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([key, title, value, color]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-2xl border bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 ${filter === key ? "ring-2 ring-slate-900" : ""}`}><p className="text-sm font-bold text-slate-500">{title}</p><p className={`mt-2 text-4xl font-extrabold ${color}`}>{value}</p></button>)}</div>
    <section className="grid gap-5 lg:grid-cols-2">
      <ExcelImportPreview title="סנכרון קובץ בקרת כיולים" description="לפני השמירה יוצגו כלים חדשים וכל שינוי בתאריכים ובפרטים. מספר סידורי זהה מעדכן את הכלי הקיים." previewAction={previewCalibrationImport} confirmAction={confirmCalibrationImport} />
      <form action={action} className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-extrabold"><Plus /> הוספת מכשיר ידנית</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><input required name="equipment_name" placeholder="שם המכשיר" className="h-11 rounded-lg border px-3" /><input name="serial_number" placeholder="מספר סידורי / משקל" className="h-11 rounded-lg border px-3" /><input name="location" placeholder="מיקום" className="h-11 rounded-lg border px-3" /><input name="model" placeholder="דגם מכשיר" className="h-11 rounded-lg border px-3" /><label className="text-xs font-bold text-slate-500">כיול אחרון<input name="last_calibration_date" type="date" className="mt-1 h-11 w-full rounded-lg border px-3" /></label><label className="text-xs font-bold text-slate-500">כיול הבא<input name="next_calibration_date" type="date" className="mt-1 h-11 w-full rounded-lg border px-3" /></label><input name="certificate_number" placeholder="מספר תעודת כיול" className="h-11 rounded-lg border px-3" /><input name="calibration_lab" placeholder="מעבדה מכיילת" className="h-11 rounded-lg border px-3" /><input name="notes" placeholder="הערות" className="h-11 rounded-lg border px-3 sm:col-span-2" /></div><button disabled={pending} className="mt-4 h-11 rounded-lg bg-slate-950 px-5 font-bold text-white disabled:opacity-50">{pending ? "שומר..." : "הוסף מכשיר"}</button>{state.message && <span className="mr-3 text-sm font-bold">{state.message}</span>}</form>
    </section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between"><h2 className="flex items-center gap-2 text-xl font-extrabold"><CalendarCheck2 /> רשימת ציוד ({visible.length})</h2><div className="flex flex-wrap gap-2"><label className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש ציוד..." className="h-10 rounded-lg border pr-9 pl-3" /></label><select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="h-10 rounded-lg border bg-white px-3"><option value="all">כל הפעילים</option><option value="expired">כיול באיחור</option><option value="upcoming">עד 90 יום</option><option value="valid">בתוקף</option><option value="missing">חסר מועד</option><option value="removed">כלים שהוסרו</option></select></div></div>
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-right text-sm"><thead className="bg-slate-50"><tr>{["שם המכשיר", "מס׳ סידורי / משקל", "מיקום", "דגם", "כיול אחרון", "כיול הבא", "מצב", "תעודה", "מעבדה", "הערות", "פעולות"].map((h) => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{visible.map((row) => { const status = dateStatus(row.next_calibration_date); return <tr key={row.id} className={`border-t ${!row.is_active ? "bg-slate-50 text-slate-500" : ""}`}><td className="p-4 font-bold">{row.equipment_name}</td><td className="p-4">{row.serial_number || "—"}</td><td className="p-4">{row.location || "—"}</td><td className="p-4">{row.model || "—"}</td><td className="p-4">{formatDate(row.last_calibration_date)}</td><td className="p-4 font-bold">{formatDate(row.next_calibration_date)}</td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.is_active ? status.color : "bg-slate-200 text-slate-600"}`}>{row.is_active ? status.text : "הוסר"}</span></td><td className="p-4">{row.certificate_number || "—"}</td><td className="p-4">{row.calibration_lab || "—"}</td><td className="max-w-52 p-4">{row.notes || "—"}</td><td className="p-4"><div className="flex gap-3"><button type="button" onClick={() => { setEditing(row); setEditMessage(""); }} aria-label="עריכת מכשיר" className="text-slate-500 hover:text-blue-600"><Pencil className="h-5 w-5" /></button><form action={deleteCalibration.bind(null, row.id)}><button aria-label="מחיקת מכשיר" className="text-slate-400 hover:text-red-600"><Trash2 className="h-5 w-5" /></button></form></div></td></tr>; })}</tbody></table></div> : <p className="p-10 text-center text-slate-500">אין ציוד להצגה בסינון זה</p>}
    </section>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>עריכת פרטי מכשיר</DialogTitle><DialogDescription>ניתן לעדכן את כל השדות והמצב של הכלי.</DialogDescription></DialogHeader>{editing && <form onSubmit={saveEdit}><input type="hidden" name="id" value={editing.id} /><div className="grid gap-3 sm:grid-cols-2"><input required name="equipment_name" defaultValue={editing.equipment_name} placeholder="שם המכשיר" className="h-11 rounded-lg border px-3" /><input name="serial_number" defaultValue={editing.serial_number ?? ""} placeholder="מספר סידורי / משקל" className="h-11 rounded-lg border px-3" /><input name="location" defaultValue={editing.location ?? ""} placeholder="מיקום" className="h-11 rounded-lg border px-3" /><input name="model" defaultValue={editing.model ?? ""} placeholder="דגם" className="h-11 rounded-lg border px-3" /><label className="text-xs font-bold text-slate-500">כיול אחרון<input name="last_calibration_date" type="date" defaultValue={editing.last_calibration_date ?? ""} className="mt-1 h-11 w-full rounded-lg border px-3" /></label><label className="text-xs font-bold text-slate-500">כיול הבא<input name="next_calibration_date" type="date" defaultValue={editing.next_calibration_date ?? ""} className="mt-1 h-11 w-full rounded-lg border px-3" /></label><input name="certificate_number" defaultValue={editing.certificate_number ?? ""} placeholder="מספר תעודה" className="h-11 rounded-lg border px-3" /><input name="calibration_lab" defaultValue={editing.calibration_lab ?? ""} placeholder="מעבדה מכיילת" className="h-11 rounded-lg border px-3" /><input name="notes" defaultValue={editing.notes ?? ""} placeholder="הערות" className="h-11 rounded-lg border px-3 sm:col-span-2" /><label className="flex items-center gap-2 rounded-lg border p-3 font-bold sm:col-span-2"><input type="checkbox" name="is_active" value="true" defaultChecked={editing.is_active} /> כלי פעיל</label></div>{editMessage && <p className="mt-3 text-sm font-bold text-red-600">{editMessage}</p>}<DialogFooter className="mt-5"><button type="button" onClick={() => setEditing(null)} className="h-10 rounded-lg border px-5 font-bold">ביטול</button><button disabled={savingEdit} className="h-10 rounded-lg bg-slate-950 px-5 font-bold text-white disabled:opacity-50">{savingEdit ? "שומר..." : "שמירת שינויים"}</button></DialogFooter></form>}</DialogContent></Dialog>
  </div>;
}
