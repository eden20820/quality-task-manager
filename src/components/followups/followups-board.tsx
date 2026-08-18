"use client";

import { useActionState } from "react";
import { CheckCircle2, CircleDot, Plus, Trash2 } from "lucide-react";
import { createFollowup, deleteFollowup, toggleFollowup, type FollowupResult } from "@/app/followups/actions";

export type Followup = { id: string; category: "pka" | "nonconformity" | "eco"; reference_number: string; status: "open" | "closed"; opened_at: string; notes: string | null };
const labels = { pka: 'פק"ע', nonconformity: "אי התאמה", eco: "ECO" } as const;
const initial: FollowupResult = { success: false, message: "" };
function today() { return new Date().toISOString().slice(0, 10); }
function dueDate(value: string) { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + 7); return date; }

function Column({ category, rows }: { category: Followup["category"]; rows: Followup[] }) {
  const [state, action, pending] = useActionState(createFollowup, initial);
  return <section className="rounded-2xl border bg-white shadow-sm">
    <div className="border-b p-5"><h2 className="text-center text-2xl font-extrabold">{labels[category]}</h2></div>
    <form action={action} className="space-y-3 border-b bg-slate-50 p-4"><input type="hidden" name="category" value={category} /><input required name="reference_number" placeholder={`מספר ${labels[category]}`} className="h-11 w-full rounded-lg border bg-white px-3" /><input required name="opened_at" type="date" defaultValue={today()} className="h-11 w-full rounded-lg border bg-white px-3" /><select name="status" defaultValue="open" className="h-11 w-full rounded-lg border bg-white px-3 font-bold"><option value="open">נפתח</option><option value="closed">נסגר</option></select><input name="notes" placeholder="הערה (לא חובה)" className="h-11 w-full rounded-lg border bg-white px-3" /><button disabled={pending} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 font-bold text-white"><Plus className="h-4 w-4" />הוספה</button>{state.message && <p className="text-sm font-bold">{state.message}</p>}</form>
    <div className="space-y-3 p-4">{rows.map((row) => { const overdue = row.status === "open" && dueDate(row.opened_at) < new Date(); return <article key={row.id} className={`rounded-xl border p-4 ${overdue ? "border-red-200 bg-red-50" : "bg-white"}`}><div className="flex items-start justify-between gap-2"><div><p className="font-extrabold">{row.reference_number}</p><p className="mt-1 text-xs text-slate-500">נפתחה: {new Intl.DateTimeFormat("he-IL").format(new Date(`${row.opened_at}T12:00:00`))}</p>{row.status === "open" && <p className={`mt-1 text-xs font-bold ${overdue ? "text-red-600" : "text-slate-500"}`}>התראה: {new Intl.DateTimeFormat("he-IL").format(dueDate(row.opened_at))}</p>}{row.notes && <p className="mt-2 text-sm">{row.notes}</p>}</div><form action={deleteFollowup.bind(null, row.id)}><button aria-label="מחיקה" className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></form></div><form action={toggleFollowup.bind(null, row.id, row.status === "open" ? "closed" : "open")}><button className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm font-bold ${row.status === "closed" ? "bg-emerald-50 text-emerald-700" : "bg-white"}`}>{row.status === "closed" ? <CheckCircle2 className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}{row.status === "closed" ? "נסגרה — פתיחה מחדש" : "פתוחה — סימון כסגורה"}</button></form></article>; })}{!rows.length && <p className="py-5 text-center text-sm text-slate-500">אין רשומות</p>}</div>
  </section>;
}

export function FollowupsBoard({ rows }: { rows: Followup[] }) {
  return <div className="space-y-7"><div><h1 className="text-3xl font-extrabold sm:text-4xl">פק״ע, אי התאמה, ECO</h1><p className="mt-2 text-slate-500">מעקב אחר רשומות פתוחות וסגורות. רשומה פתוחה תתריע לאחר שבוע, ולאחר מכן בכל שבוע עד לסגירתה.</p></div><div className="grid items-start gap-5 xl:grid-cols-3">{(["pka", "nonconformity", "eco"] as const).map((category) => <Column key={category} category={category} rows={rows.filter((row) => row.category === category)} />)}</div></div>;
}
