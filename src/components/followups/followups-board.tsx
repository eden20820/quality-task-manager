"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Bell, BellOff, Check, CheckCircle2, CircleDot, LayoutGrid, List, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { createFollowup, deleteFollowup, toggleFollowup, toggleFollowupAlerts, updateFollowup, updateFollowupNotes, updateFollowupOpenedBy, type FollowupResult } from "@/app/followups/actions";
import { EcoImportDialog } from "@/components/followups/eco-import-dialog";
import { NonconformityImportDialog } from "@/components/followups/nonconformity-import-dialog";
import { PkaImportDialog } from "@/components/followups/pka-import-dialog";

export type Followup = { id: string; category: "pka" | "nonconformity" | "eco"; reference_number: string; name: string | null; opened_by_name: string | null; quantity: number | null; status: "open" | "waiting" | "closed"; alerts_enabled: boolean; assignee_key: "eden" | "sergey" | "quality_manager" | null; opened_at: string; closed_at: string | null; created_at: string; notes: string | null; eco_project: string | null; eco_owner_name: string | null; eco_description: string | null; supplier_complaint: string | null; customer_complaint: string | null; effectiveness_due: string | null; effectiveness_actual: string | null };
type Category = Followup["category"];
type StatusFilter = "all" | "active" | Followup["status"];

const categories: Category[] = ["pka", "nonconformity", "eco"];
const labels = { pka: 'פק"ע', nonconformity: "אי התאמה", eco: "ECO" } as const;
const initial: FollowupResult = { success: false, message: "" };
const dateFormatter = new Intl.DateTimeFormat("he-IL");

function today() { return new Date().toISOString().slice(0, 10); }
function dueDate(value: string) { const date = new Date(value); date.setDate(date.getDate() + 7); return date; }
function formatDate(value: string) { return dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00`)); }

function followupsHref(category: Category, status: StatusFilter, query: string) {
  const params = new URLSearchParams({ category, status });
  if (query) params.set("q", query);
  return `/followups?${params.toString()}`;
}

function AddFollowupForm({ category, onClose }: { category: Category; onClose: () => void }) {
  const [state, action, pending] = useActionState(createFollowup, initial);
  return <form action={action} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
    <input type="hidden" name="category" value={category} />
    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-extrabold">הוספת {labels[category]}</h2><p className="text-xs text-slate-500">ההתראות נספרות ממועד ההוספה למערכת</p></div><button type="button" onClick={onClose} aria-label="סגירת טופס ההוספה" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button></div>
    <div className={`grid gap-3 ${category === "pka" ? "lg:grid-cols-8" : "lg:grid-cols-7"}`}>
      <input required name="reference_number" placeholder={`מספר ${labels[category]}`} className="h-10 rounded-lg border bg-white px-3" />
      <input required name="name" placeholder="שם הטופס" className="h-10 rounded-lg border bg-white px-3 lg:col-span-2" />
      <input name="opened_by_name" placeholder="שם הפותח (לא חובה)" className="h-10 rounded-lg border bg-white px-3" />
      {category === "pka" ? <input required name="quantity" type="number" min="0" step="1" placeholder="כמות" className="h-10 rounded-lg border bg-white px-3" /> : null}
      <input required name="opened_at" type="date" defaultValue={today()} aria-label="תאריך הרשומה" className="h-10 rounded-lg border bg-white px-3" />
      <select name="status" defaultValue="open" aria-label="מצב הרשומה" className="h-10 rounded-lg border bg-white px-3 font-bold"><option value="open">נפתח</option>{category === "nonconformity" ? <option value="waiting">ממתין</option> : null}<option value="closed">נסגר</option></select>
      <input name="notes" placeholder="הערה (לא חובה)" className="h-10 rounded-lg border bg-white px-3" />
    </div>
    <div className="mt-3 flex items-center justify-end gap-3">{state.message ? <p role="status" className={`text-sm font-bold ${state.success ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p> : null}<button disabled={pending} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" />{pending ? "שומר..." : "הוספה"}</button></div>
  </form>;
}

function OpenedByEditor({ row }: { row: Followup }) {
  const [value, setValue] = useState(row.opened_by_name ?? "");
  const [pending, setPending] = useState(false);
  async function save() {
    const openedByName = value.trim();
    if (openedByName === (row.opened_by_name ?? "")) return;
    setPending(true);
    const formData = new FormData();
    formData.set("opened_by_name", openedByName);
    await updateFollowupOpenedBy(row.id, formData);
    setPending(false);
  }
  return <input value={value} onChange={(event) => setValue(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} disabled={pending} placeholder="שם הפותח" aria-label={`שם הפותח עבור ${row.reference_number}`} className="h-8 min-w-32 rounded-md border bg-white px-2 text-xs font-semibold disabled:opacity-60" />;
}

function NotesEditor({ row }: { row: Followup }) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save(formData: FormData) {
    setPending(true);
    setMessage("");
    const result = await updateFollowupNotes(row.id, formData);
    setPending(false);
    if (result.success) setEditing(false);
    else setMessage(result.message);
  }

  if (!editing) return <button type="button" onClick={() => setEditing(true)} className={`group flex w-full items-start gap-1.5 whitespace-normal text-right ${row.notes ? "text-slate-600" : "font-bold text-sky-700"}`} title={row.notes ? "עריכת הערה" : "הוספת הערה"}><span className="min-w-0 flex-1 break-words">{row.notes || "הוספת הערה"}</span><Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" /></button>;

  return <form action={save} className="min-w-64 space-y-2"><textarea autoFocus name="notes" defaultValue={row.notes ?? ""} maxLength={2000} rows={3} placeholder="כתיבת הערה..." className="w-full resize-y rounded-lg border bg-white p-2 text-sm" /><div className="flex items-center gap-1"><button disabled={pending} aria-label="שמירת הערה" title="שמירה" className="rounded-lg bg-slate-950 p-2 text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" /></button><button type="button" onClick={() => { setEditing(false); setMessage(""); }} aria-label="ביטול עריכת הערה" title="ביטול" className="rounded-lg border p-2 text-slate-500"><X className="h-3.5 w-3.5" /></button>{pending ? <span className="text-xs text-slate-500">שומר...</span> : null}{message ? <span role="alert" className="text-xs font-bold text-red-600">{message}</span> : null}</div></form>;
}

function EditFollowupDialog({ row }: { row: Followup }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function save(formData: FormData) { setPending(true); setMessage(""); const result = await updateFollowup(row.id, formData); setPending(false); if (result.success) setOpen(false); else setMessage(result.message); }
  const input = "mt-1 h-10 w-full rounded-lg border px-3 font-normal";
  return <><button type="button" onClick={() => setOpen(true)} title="עריכת כל השדות" aria-label={`עריכת ${row.reference_number}`} className="rounded-lg p-2 text-slate-500 hover:bg-sky-50 hover:text-sky-700"><Pencil className="h-4 w-4" /></button>{open ? <div className="fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={`עריכת ${row.reference_number}`}><button type="button" aria-label="סגירה" className="absolute inset-0 bg-slate-950/60" onClick={() => !pending && setOpen(false)} /><form action={save} className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"><input type="hidden" name="category" value={row.category} /><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-extrabold">עריכת {labels[row.category]}</h2><p className="text-sm text-slate-500">ניתן לערוך את כל שדות הרשומה</p></div><button type="button" onClick={() => setOpen(false)} aria-label="סגירה" className="rounded-lg p-2"><X className="h-5 w-5" /></button></div><div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-bold">מספר<input required name="reference_number" defaultValue={row.reference_number} className={input} /></label>
    <label className="text-sm font-bold">{row.category === "eco" ? "תיאור הטופס" : "שם הטופס"}<input required name="name" defaultValue={row.category === "eco" ? row.eco_description ?? row.name ?? "" : row.name ?? ""} className={input} /></label>
    <label className="text-sm font-bold">שם הפותח<input name="opened_by_name" defaultValue={row.opened_by_name ?? ""} className={input} /></label>
    {row.category === "pka" ? <label className="text-sm font-bold">כמות<input required type="number" min="0" name="quantity" defaultValue={row.quantity ?? ""} className={input} /></label> : null}
    {row.category === "eco" ? <><label className="text-sm font-bold">פרויקט<input name="eco_project" defaultValue={row.eco_project ?? ""} className={input} /></label><label className="text-sm font-bold">אחראי ECO<input name="eco_owner_name" defaultValue={row.eco_owner_name ?? ""} className={input} /></label></> : null}
    {row.category === "nonconformity" ? <><label className="text-sm font-bold">תלונת ספק<input name="supplier_complaint" defaultValue={row.supplier_complaint ?? ""} className={input} /></label><label className="text-sm font-bold">תלונת לקוח<input name="customer_complaint" defaultValue={row.customer_complaint ?? ""} className={input} /></label><label className="text-sm font-bold">יעד לבדיקת אפקטיביות<input name="effectiveness_due" defaultValue={row.effectiveness_due ?? ""} className={input} /></label><label className="text-sm font-bold">בדיקת אפקטיביות בפועל<input name="effectiveness_actual" defaultValue={row.effectiveness_actual ?? ""} className={input} /></label></> : null}
    <label className="text-sm font-bold">תאריך פתיחה<input required type="date" name="opened_at" defaultValue={row.opened_at.slice(0, 10)} className={input} /></label>
    <label className="text-sm font-bold">מצב<select name="status" defaultValue={row.status} className={input}><option value="open">פתוחה</option>{row.category === "nonconformity" ? <option value="waiting">ממתינה לאפקטיביות</option> : null}<option value="closed">סגורה</option></select></label>
    <label className="text-sm font-bold">תאריך סגירה<input type="date" name="closed_at" defaultValue={row.closed_at?.slice(0, 10) ?? ""} className={input} /></label>
    <label className="text-sm font-bold sm:col-span-2">הערות<textarea name="notes" defaultValue={row.notes ?? ""} rows={3} className="mt-1 w-full rounded-lg border p-3 font-normal" /></label>
  </div>{message ? <p role="alert" className="mt-3 text-sm font-bold text-red-600">{message}</p> : null}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border px-4 font-bold">ביטול</button><button disabled={pending} className="h-10 rounded-lg bg-slate-950 px-6 font-bold text-white disabled:opacity-50">{pending ? "שומר..." : "שמירת שינויים"}</button></div></form></div> : null}</>;
}

function FollowupsTable({ category, rows }: { category: Category; rows: Followup[] }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed bg-white py-16 text-center text-sm text-slate-500">אין רשומות מתאימות להצגה</div>;
  return <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="max-h-[72vh] overflow-auto"><table className={`h-fit w-full table-auto border-collapse text-right text-xs leading-4 ${category === "eco" || category === "nonconformity" ? "min-w-[1780px]" : "min-w-[1120px]"}`}>
    <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] text-slate-600 shadow-[0_1px_0_0_#e2e8f0]"><tr><th className="px-3 py-2">מספר</th>{category === "eco" ? <th className="px-3 py-2">פרויקט</th> : null}<th className="px-3 py-2">{category === "eco" ? "תיאור הטופס" : "שם הטופס"}</th>{category === "pka" ? <th className="px-3 py-2">כמות</th> : null}{category === "nonconformity" ? <><th className="px-3 py-2">תלונת ספק</th><th className="px-3 py-2">תלונת לקוח</th><th className="px-3 py-2">יעד אפקטיביות</th><th className="px-3 py-2">אפקטיביות בפועל</th></> : null}<th className="px-3 py-2">שם הפותח</th><th className="px-3 py-2">תאריך הרשומה</th><th className="px-3 py-2">מצב</th>{category === "eco" || category === "nonconformity" ? <th className="px-3 py-2">תאריך סגירה</th> : null}<th className="px-3 py-2">התראה הבאה</th><th className="px-3 py-2">הערות</th><th className="px-3 py-2 text-center">פעולות</th></tr></thead>
    <tbody className="divide-y divide-slate-100 align-top">{rows.map((row) => { const alertDate = dueDate(row.created_at); const overdue = row.alerts_enabled && row.status !== "closed" && alertDate < new Date(); return <tr key={row.id} className={`h-auto align-top transition-colors hover:bg-slate-50 ${overdue ? "bg-red-50/70" : ""}`}>
      <td className="whitespace-nowrap px-3 py-2 font-extrabold">{row.reference_number}</td>{category === "eco" ? <td className="min-w-44 whitespace-normal px-3 py-2 text-slate-600"><span className="block break-words">{row.eco_project || "—"}</span></td> : null}<td className="min-w-72 whitespace-normal px-3 py-2 font-semibold text-slate-700"><span className="block break-words">{category === "eco" ? row.eco_description || row.name || "—" : row.name || "—"}</span></td>{category === "pka" ? <td className="whitespace-nowrap px-3 py-2">{row.quantity ?? "—"}</td> : null}{category === "nonconformity" ? <><td className="min-w-36 whitespace-normal break-words px-3 py-2">{row.supplier_complaint || "—"}</td><td className="min-w-36 whitespace-normal break-words px-3 py-2">{row.customer_complaint || "—"}</td><td className="min-w-56 whitespace-normal px-3 py-2"><span className="block break-words">{row.effectiveness_due || "—"}</span></td><td className="min-w-56 whitespace-normal px-3 py-2"><span className="block break-words">{row.effectiveness_actual || "—"}</span></td></> : null}<td className="whitespace-nowrap px-3 py-2"><OpenedByEditor row={row} /></td><td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDate(row.opened_at)}</td>
      <td className="whitespace-nowrap px-3 py-2"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${row.status === "open" ? "bg-amber-100 text-amber-800" : row.status === "waiting" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-700"}`}>{row.status === "closed" ? <CheckCircle2 className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}{row.status === "open" ? "פתוחה" : row.status === "waiting" ? "ממתין" : "סגורה"}</span></td>{category === "eco" || category === "nonconformity" ? <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.closed_at ? formatDate(row.closed_at) : "—"}</td> : null}
      <td className="whitespace-nowrap px-3 py-2">{row.status === "closed" ? <span className="text-slate-400">—</span> : !row.alerts_enabled ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400"><BellOff className="h-3 w-3" />כבויה</span> : <span className={`text-[11px] font-bold ${overdue ? "text-red-600" : "text-slate-600"}`}>{formatDate(alertDate.toISOString())}</span>}</td>
      <td className="min-w-72 px-3 py-2"><NotesEditor row={row} /></td>
      <td className="px-3 py-2"><div className="flex items-center justify-center gap-0.5"><EditFollowupDialog row={row} /><form action={toggleFollowup.bind(null, row.id, row.status === "closed" ? "open" : "closed")}><button title={row.status === "closed" ? "פתיחה מחדש" : "סימון כסגורה"} aria-label={row.status === "closed" ? "פתיחה מחדש" : "סימון כסגורה"} className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">{row.status === "closed" ? <CircleDot className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}</button></form><form action={toggleFollowupAlerts.bind(null, row.id, !row.alerts_enabled)}><button title={row.alerts_enabled ? "כיבוי התראות" : "הפעלת התראות"} aria-label={row.alerts_enabled ? "כיבוי התראות" : "הפעלת התראות"} className={`rounded-md p-1.5 hover:bg-amber-50 ${row.alerts_enabled ? "text-amber-600" : "text-slate-400"}`}>{row.alerts_enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}</button></form><form action={deleteFollowup.bind(null, row.id)}><button title="מחיקה" aria-label="מחיקה" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></form></div></td>
    </tr>; })}</tbody>
  </table></div></div>;
}

function statusText(status: Followup["status"]) { return status === "open" ? "פתוחה" : status === "waiting" ? "ממתינה" : "סגורה"; }
function recordTitle(row: Followup) { return row.category === "eco" ? row.eco_description || row.name || "ללא תיאור" : row.name || "ללא שם"; }

function FollowupDetailsDialog({ row, onClose }: { row: Followup; onClose: () => void }) {
  const fields = [
    ["מספר", row.reference_number], ["שם הפותח", row.opened_by_name || "—"], ["תאריך פתיחה", formatDate(row.opened_at)], ["מצב", statusText(row.status)],
    ...(row.category === "pka" ? [["כמות", String(row.quantity ?? "—")]] : []),
    ...(row.category === "eco" ? [["פרויקט", row.eco_project || "—"], ["אחראי ECO", row.eco_owner_name || "—"]] : []),
    ...(row.category === "nonconformity" ? [["תלונת ספק", row.supplier_complaint || "—"], ["תלונת לקוח", row.customer_complaint || "—"], ["יעד אפקטיביות", row.effectiveness_due || "—"], ["אפקטיביות בפועל", row.effectiveness_actual || "—"]] : []),
    ...(row.closed_at ? [["תאריך סגירה", formatDate(row.closed_at)]] : []),
  ];
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby={`details-${row.id}`}><button type="button" aria-label="סגירת פרטי הרשומה" className="absolute inset-0 bg-slate-950/60" onClick={onClose} /><section dir="rtl" className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{labels[row.category]}</span><h2 id={`details-${row.id}`} className="mt-3 text-2xl font-extrabold">{recordTitle(row)}</h2></div><button type="button" onClick={onClose} aria-label="סגירה" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><dl className="mt-6 grid gap-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="rounded-xl border bg-slate-50 p-3"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-semibold text-slate-800">{value}</dd></div>)}</dl><div className="mt-4 rounded-xl border p-4"><h3 className="text-sm font-extrabold">הערות</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{row.notes || "אין הערות"}</p></div><div className="mt-5 flex justify-end"><EditFollowupDialog row={row} /></div></section></div>;
}

function FollowupCard({ row }: { row: Followup }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const alertDate = dueDate(row.created_at);
  const overdue = row.alerts_enabled && row.status !== "closed" && alertDate < new Date();
  return <><article className={`group flex min-h-64 cursor-pointer flex-col rounded-2xl border bg-white p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${overdue ? "border-red-200 bg-red-50/40" : "border-slate-200"}`} onClick={() => setDetailsOpen(true)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDetailsOpen(true); } }} role="button" tabIndex={0} aria-label={`פתיחת פרטי ${row.reference_number}`}>
    <div className="flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${row.category === "eco" ? "bg-violet-100 text-violet-700" : row.category === "nonconformity" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{labels[row.category]}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.status === "open" ? "bg-amber-100 text-amber-800" : row.status === "waiting" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-700"}`}>{statusText(row.status)}</span></div>
    <h3 className="mt-4 text-lg font-extrabold leading-7 text-slate-950">{recordTitle(row)}</h3><p className="mt-1 font-bold text-slate-500">{row.reference_number}</p>
    {row.category === "eco" && row.eco_project ? <p className="mt-3 break-words text-sm text-slate-600"><b>פרויקט:</b> {row.eco_project}</p> : null}
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="block text-xs text-slate-400">שם הפותח</span><b className="break-words">{row.opened_by_name || "—"}</b></div><div><span className="block text-xs text-slate-400">תאריך פתיחה</span><b>{formatDate(row.opened_at)}</b></div></div>
    {row.notes ? <p className="mt-4 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{row.notes}</p> : null}
    <div className="mt-auto flex items-end justify-between gap-3 pt-5"><span className={`text-xs font-bold ${overdue ? "text-red-600" : "text-slate-400"}`}>{row.status === "closed" ? "ללא התראה" : row.alerts_enabled ? `התראה: ${formatDate(alertDate.toISOString())}` : "התראות כבויות"}</span><span className="font-bold text-sky-700 group-hover:underline">פתיחת פרטים</span></div>
  </article>{detailsOpen ? <FollowupDetailsDialog row={row} onClose={() => setDetailsOpen(false)} /> : null}</>;
}

function FollowupsCards({ rows }: { rows: Followup[] }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed bg-white py-16 text-center text-sm text-slate-500">אין רשומות מתאימות להצגה</div>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <FollowupCard key={row.id} row={row} />)}</div>;
}

export function FollowupsBoard({ rows, activeCategory, statusFilter, query, total, counts }: { rows: Followup[]; activeCategory: Category; statusFilter: StatusFilter; query: string; total: number; counts: Record<Category, number> }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-extrabold sm:text-4xl">פק״ע, אי התאמה, ECO</h1><p className="mt-2 text-slate-500">מעקב מרוכז אחר רשומות פתוחות וסגורות</p></div><div className="flex flex-col gap-2 sm:flex-row">{activeCategory === "pka" ? <PkaImportDialog /> : null}{activeCategory === "eco" ? <EcoImportDialog /> : null}{activeCategory === "nonconformity" ? <NonconformityImportDialog /> : null}<button onClick={() => setShowAddForm((value) => !value)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 font-bold text-white"><Plus className="h-4 w-4" />הוספת {labels[activeCategory]}</button></div></div>
    <div className="grid grid-cols-3 rounded-2xl border bg-white p-1 shadow-sm" role="tablist" aria-label="סוג רשומה">{categories.map((category) => <Link key={category} role="tab" aria-selected={activeCategory === category} href={followupsHref(category, statusFilter, query)} onClick={() => setShowAddForm(false)} className={`rounded-xl px-2 py-3 text-center text-sm font-extrabold transition-colors sm:text-base ${activeCategory === category ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}><span>{labels[category]}</span><span className={`me-2 rounded-full px-2 py-0.5 text-xs ${activeCategory === category ? "bg-white/15 text-white" : "bg-amber-100 text-amber-800"}`}>{counts[category]} פעילות</span></Link>)}</div>
    {showAddForm ? <AddFollowupForm key={activeCategory} category={activeCategory} onClose={() => setShowAddForm(false)} /> : null}
    <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"><form action="/followups" method="get" className="flex w-full gap-2 sm:max-w-md"><input type="hidden" name="category" value={activeCategory} /><input type="hidden" name="status" value={statusFilter} /><div className="relative min-w-0 flex-1"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={query} placeholder="חיפוש לפי מספר, שם או הערה" className="h-10 w-full rounded-lg border bg-slate-50 pr-9 pl-3 text-sm" /></div><button className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white">חיפוש</button>{query ? <Link href={followupsHref(activeCategory, statusFilter, "")} aria-label="ניקוי חיפוש" title="ניקוי חיפוש" className="flex h-10 w-10 items-center justify-center rounded-lg border text-slate-500"><X className="h-4 w-4" /></Link> : null}</form><div className="grid grid-cols-4 rounded-lg bg-slate-100 p-1 text-sm font-bold">{(["active", "waiting", "closed", "all"] as StatusFilter[]).map((status) => <Link key={status} href={followupsHref(activeCategory, status, query)} className={`rounded-md px-3 py-2 text-center ${statusFilter === status ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>{status === "active" ? "פעילות" : status === "waiting" ? "ממתינות" : status === "closed" ? "סגורות" : "הכול"}</Link>)}</div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-slate-500"><span>{total} רשומות מתאימות</span><div className="flex rounded-lg border bg-white p-1" role="group" aria-label="בחירת תצוגה"><button type="button" onClick={() => setView("table")} aria-pressed={view === "table"} className={`flex h-9 items-center gap-2 rounded-md px-3 font-bold ${view === "table" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}><List className="h-4 w-4" />טבלה</button><button type="button" onClick={() => setView("cards")} aria-pressed={view === "cards"} className={`flex h-9 items-center gap-2 rounded-md px-3 font-bold ${view === "cards" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}><LayoutGrid className="h-4 w-4" />כרטיסים</button></div></div>
    {view === "table" ? <FollowupsTable category={activeCategory} rows={rows} /> : <FollowupsCards rows={rows} />}
  </div>;
}
