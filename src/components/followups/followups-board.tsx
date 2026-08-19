"use client";

import { useActionState, useMemo, useState } from "react";
import { Bell, BellOff, Check, CheckCircle2, CircleDot, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { createFollowup, deleteFollowup, toggleFollowup, toggleFollowupAlerts, updateFollowupAssignee, updateFollowupNotes, type FollowupResult } from "@/app/followups/actions";

export type Followup = { id: string; category: "pka" | "nonconformity" | "eco"; reference_number: string; name: string | null; quantity: number | null; status: "open" | "waiting" | "closed"; alerts_enabled: boolean; assignee_key: "eden" | "sergey" | "quality_manager" | null; opened_at: string; created_at: string; notes: string | null };
type Category = Followup["category"];
type StatusFilter = "all" | "active" | Followup["status"];

const categories: Category[] = ["pka", "nonconformity", "eco"];
const labels = { pka: 'פק"ע', nonconformity: "אי התאמה", eco: "ECO" } as const;
const initial: FollowupResult = { success: false, message: "" };
const dateFormatter = new Intl.DateTimeFormat("he-IL");

function today() { return new Date().toISOString().slice(0, 10); }
function dueDate(value: string) { const date = new Date(value); date.setDate(date.getDate() + 7); return date; }
function formatDate(value: string) { return dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00`)); }

function AddFollowupForm({ category, onClose }: { category: Category; onClose: () => void }) {
  const [state, action, pending] = useActionState(createFollowup, initial);
  return <form action={action} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
    <input type="hidden" name="category" value={category} />
    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-extrabold">הוספת {labels[category]}</h2><p className="text-xs text-slate-500">ההתראות נספרות ממועד ההוספה למערכת</p></div><button type="button" onClick={onClose} aria-label="סגירת טופס ההוספה" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button></div>
    <div className={`grid gap-3 ${category === "pka" ? "lg:grid-cols-8" : "lg:grid-cols-7"}`}>
      <input required name="reference_number" placeholder={`מספר ${labels[category]}`} className="h-10 rounded-lg border bg-white px-3" />
      <input required name="name" placeholder="שם" className="h-10 rounded-lg border bg-white px-3 lg:col-span-2" />
      {category === "pka" ? <input required name="quantity" type="number" min="0" step="1" placeholder="כמות" className="h-10 rounded-lg border bg-white px-3" /> : null}
      <input required name="opened_at" type="date" defaultValue={today()} aria-label="תאריך הרשומה" className="h-10 rounded-lg border bg-white px-3" />
      <select name="status" defaultValue="open" aria-label="מצב הרשומה" className="h-10 rounded-lg border bg-white px-3 font-bold"><option value="open">נפתח</option>{category === "nonconformity" ? <option value="waiting">ממתין</option> : null}<option value="closed">נסגר</option></select>
      <select required={category !== "nonconformity"} name="assignee_key" defaultValue="" aria-label="אחראי" className="h-10 rounded-lg border bg-white px-3 font-bold"><option value="" disabled={category !== "nonconformity"}>{category === "nonconformity" ? "ללא אחראי" : "בחירת אחראי"}</option><option value="eden">עדן</option><option value="sergey">סרגיי</option>{category !== "pka" ? <option value="quality_manager">עמית</option> : null}</select>
      <input name="notes" placeholder="הערה (לא חובה)" className="h-10 rounded-lg border bg-white px-3" />
    </div>
    <div className="mt-3 flex items-center justify-end gap-3">{state.message ? <p role="status" className={`text-sm font-bold ${state.success ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p> : null}<button disabled={pending} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" />{pending ? "שומר..." : "הוספה"}</button></div>
  </form>;
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

  if (!editing) return <button type="button" onClick={() => setEditing(true)} className={`group flex w-full items-start gap-1.5 text-right ${row.notes ? "text-slate-600" : "font-bold text-sky-700"}`} title={row.notes ? "עריכת הערה" : "הוספת הערה"}><span className="line-clamp-2 flex-1">{row.notes || "הוספת הערה"}</span><Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" /></button>;

  return <form action={save} className="min-w-64 space-y-2"><textarea autoFocus name="notes" defaultValue={row.notes ?? ""} maxLength={2000} rows={3} placeholder="כתיבת הערה..." className="w-full resize-y rounded-lg border bg-white p-2 text-sm" /><div className="flex items-center gap-1"><button disabled={pending} aria-label="שמירת הערה" title="שמירה" className="rounded-lg bg-slate-950 p-2 text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" /></button><button type="button" onClick={() => { setEditing(false); setMessage(""); }} aria-label="ביטול עריכת הערה" title="ביטול" className="rounded-lg border p-2 text-slate-500"><X className="h-3.5 w-3.5" /></button>{pending ? <span className="text-xs text-slate-500">שומר...</span> : null}{message ? <span role="alert" className="text-xs font-bold text-red-600">{message}</span> : null}</div></form>;
}

function FollowupsTable({ category, rows }: { category: Category; rows: Followup[] }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed bg-white py-16 text-center text-sm text-slate-500">אין רשומות מתאימות להצגה</div>;
  return <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[1020px] border-collapse text-right text-sm">
    <thead className="sticky top-0 z-10 bg-slate-100 text-xs text-slate-600 shadow-[0_1px_0_0_#e2e8f0]"><tr><th className="px-4 py-3">מספר</th><th className="px-4 py-3">שם</th>{category === "pka" ? <th className="px-4 py-3">כמות</th> : null}<th className="px-4 py-3">אחראי</th><th className="px-4 py-3">תאריך הרשומה</th><th className="px-4 py-3">מצב</th><th className="px-4 py-3">התראה הבאה</th><th className="px-4 py-3">הערות</th><th className="px-4 py-3 text-center">פעולות</th></tr></thead>
    <tbody className="divide-y divide-slate-100">{rows.map((row) => { const alertDate = dueDate(row.created_at); const overdue = row.alerts_enabled && row.status !== "closed" && alertDate < new Date(); return <tr key={row.id} className={`transition-colors hover:bg-slate-50 ${overdue ? "bg-red-50/70" : ""}`}>
      <td className="whitespace-nowrap px-4 py-3 font-extrabold">{row.reference_number}</td><td className="max-w-56 px-4 py-3 font-semibold text-slate-700"><span className="line-clamp-2">{row.name || "—"}</span></td>{category === "pka" ? <td className="whitespace-nowrap px-4 py-3">{row.quantity ?? "—"}</td> : null}<td className="whitespace-nowrap px-4 py-3"><form action={updateFollowupAssignee.bind(null, row.id)}><select name="assignee_key" defaultValue={row.assignee_key ?? ""} onChange={(event) => event.currentTarget.form?.requestSubmit()} aria-label={`אחראי על ${row.reference_number}`} className={`h-9 rounded-lg border px-2 text-sm font-bold ${row.assignee_key ? "bg-white" : "border-amber-300 bg-amber-50 text-amber-800"}`}><option value="" disabled={category !== "nonconformity"}>{category === "nonconformity" ? "ללא אחראי" : "לא הוגדר"}</option><option value="eden">עדן</option><option value="sergey">סרגיי</option>{category !== "pka" ? <option value="quality_manager">עמית</option> : null}</select></form></td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(row.opened_at)}</td>
      <td className="whitespace-nowrap px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${row.status === "open" ? "bg-amber-100 text-amber-800" : row.status === "waiting" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-700"}`}>{row.status === "closed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}{row.status === "open" ? "פתוחה" : row.status === "waiting" ? "ממתין" : "סגורה"}</span></td>
      <td className="whitespace-nowrap px-4 py-3">{row.status === "closed" ? <span className="text-slate-400">—</span> : !row.alerts_enabled ? <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400"><BellOff className="h-3.5 w-3.5" />כבויה</span> : <span className={`text-xs font-bold ${overdue ? "text-red-600" : "text-slate-600"}`}>{formatDate(alertDate.toISOString())}</span>}</td>
      <td className="max-w-72 px-4 py-3"><NotesEditor row={row} /></td>
      <td className="px-4 py-3"><div className="flex items-center justify-center gap-1"><form action={toggleFollowup.bind(null, row.id, row.status === "closed" ? "open" : "closed")}><button title={row.status === "closed" ? "פתיחה מחדש" : "סימון כסגורה"} aria-label={row.status === "closed" ? "פתיחה מחדש" : "סימון כסגורה"} className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">{row.status === "closed" ? <CircleDot className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</button></form><form action={toggleFollowupAlerts.bind(null, row.id, !row.alerts_enabled)}><button title={row.alerts_enabled ? "כיבוי התראות" : "הפעלת התראות"} aria-label={row.alerts_enabled ? "כיבוי התראות" : "הפעלת התראות"} className={`rounded-lg p-2 hover:bg-amber-50 ${row.alerts_enabled ? "text-amber-600" : "text-slate-400"}`}>{row.alerts_enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}</button></form><form action={deleteFollowup.bind(null, row.id)}><button title="מחיקה" aria-label="מחיקה" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></form></div></td>
    </tr>; })}</tbody>
  </table></div></div>;
}

export function FollowupsBoard({ rows }: { rows: Followup[] }) {
  const [activeCategory, setActiveCategory] = useState<Category>("pka");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [query, setQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const counts = useMemo(() => Object.fromEntries(categories.map((category) => [category, rows.filter((row) => row.category === category && row.status !== "closed").length])) as Record<Category, number>, [rows]);
  const visibleRows = useMemo(() => { const normalizedQuery = query.trim().toLocaleLowerCase("he"); return rows.filter((row) => row.category === activeCategory && (statusFilter === "all" || (statusFilter === "active" ? row.status !== "closed" : row.status === statusFilter)) && (!normalizedQuery || `${row.reference_number} ${row.name ?? ""} ${row.notes ?? ""}`.toLocaleLowerCase("he").includes(normalizedQuery))); }, [activeCategory, query, rows, statusFilter]);

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-extrabold sm:text-4xl">פק״ע, אי התאמה, ECO</h1><p className="mt-2 text-slate-500">מעקב מרוכז אחר רשומות פתוחות וסגורות</p></div><button onClick={() => setShowAddForm((value) => !value)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 font-bold text-white"><Plus className="h-4 w-4" />הוספת {labels[activeCategory]}</button></div>
    <div className="grid grid-cols-3 rounded-2xl border bg-white p-1 shadow-sm" role="tablist" aria-label="סוג רשומה">{categories.map((category) => <button key={category} role="tab" aria-selected={activeCategory === category} onClick={() => { setActiveCategory(category); setShowAddForm(false); }} className={`rounded-xl px-2 py-3 text-sm font-extrabold transition-colors sm:text-base ${activeCategory === category ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}><span>{labels[category]}</span><span className={`me-2 rounded-full px-2 py-0.5 text-xs ${activeCategory === category ? "bg-white/15 text-white" : "bg-amber-100 text-amber-800"}`}>{counts[category]} פעילות</span></button>)}</div>
    {showAddForm ? <AddFollowupForm key={activeCategory} category={activeCategory} onClose={() => setShowAddForm(false)} /> : null}
    <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי מספר, שם או הערה" className="h-10 w-full rounded-lg border bg-slate-50 pr-9 pl-3 text-sm" /></div><div className="grid grid-cols-4 rounded-lg bg-slate-100 p-1 text-sm font-bold">{(["active", "waiting", "closed", "all"] as StatusFilter[]).map((status) => <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-md px-3 py-2 ${statusFilter === status ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>{status === "active" ? "פעילות" : status === "waiting" ? "ממתינות" : status === "closed" ? "סגורות" : "הכול"}</button>)}</div></div>
    <div className="flex items-center justify-between px-1 text-sm text-slate-500"><span>{visibleRows.length} רשומות מוצגות</span><span className="hidden sm:inline">ניתן לגלול בתוך הטבלה בלבד</span></div>
    <FollowupsTable category={activeCategory} rows={visibleRows} />
  </div>;
}
