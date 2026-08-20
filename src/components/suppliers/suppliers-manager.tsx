"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Building2, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { createSupplier, deleteSupplier, setSupplierAlertsEnabled, updateSupplier, type SupplierActionResult } from "@/app/suppliers/actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SupplierRow = {
  id: string;
  supplier_number: string | null;
  supplier_name: string;
  product_service: string | null;
  has_certification: boolean;
  has_experience: boolean;
  status: string;
  certification_type: string | null;
  expiration_date: string | null;
  delivery_score: number | null;
  quality_score: number | null;
  professionalism_score: number | null;
  requirements_score: number | null;
  weighted_score: number | null;
  notes: string | null;
};

type Filter = "all" | "expired" | "upcoming" | "valid" | "missing";
const initialState = { success: false, message: "" };

function daysLeft(value: string | null) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("he-IL").format(new Date(`${value}T12:00:00`)) : "—";
}

function expiryStatus(value: string | null) {
  const days = daysLeft(value);
  if (days === null) return { text: "ללא תאריך", color: "bg-slate-100 text-slate-700" };
  if (days < 0) return { text: `פג לפני ${Math.abs(days)} ימים`, color: "bg-red-100 text-red-700" };
  if (days === 0) return { text: "פג היום", color: "bg-red-100 text-red-700" };
  if (days <= 90) return { text: `בעוד ${days} ימים`, color: "bg-orange-100 text-orange-700" };
  return { text: "בתוקף", color: "bg-emerald-100 text-emerald-700" };
}

function SupplierFields({ row }: { row?: SupplierRow }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <input name="supplier_number" defaultValue={row?.supplier_number ?? ""} placeholder="מספר ספק" className="h-11 rounded-lg border px-3" />
    <input required name="supplier_name" defaultValue={row?.supplier_name ?? ""} placeholder="שם הספק" className="h-11 rounded-lg border px-3" />
    <input name="product_service" defaultValue={row?.product_service ?? ""} placeholder="מוצר / שירות מסופק" className="h-11 rounded-lg border px-3" />
    <select name="status" defaultValue={row?.status ?? "Approved"} className="h-11 rounded-lg border bg-white px-3"><option value="Approved">מאושר</option><option value="Conditional">מאושר בתנאים</option><option value="Not approved">לא מאושר</option></select>
    <input name="certification_type" defaultValue={row?.certification_type ?? ""} placeholder="סוג הסמכה" className="h-11 rounded-lg border px-3" />
    <label className="text-xs font-bold text-slate-500">תוקף ההסמכה<input name="expiration_date" type="date" defaultValue={row?.expiration_date ?? ""} className="mt-1 h-11 w-full rounded-lg border px-3" /></label>
    <input name="delivery_score" type="number" min="0" max="10" step="0.01" defaultValue={row?.delivery_score ?? ""} placeholder="עמידה בלו״ז (30%)" className="h-11 rounded-lg border px-3" />
    <input name="quality_score" type="number" min="0" max="10" step="0.01" defaultValue={row?.quality_score ?? ""} placeholder="איכות מוצר / שירות (30%)" className="h-11 rounded-lg border px-3" />
    <input name="professionalism_score" type="number" min="0" max="10" step="0.01" defaultValue={row?.professionalism_score ?? ""} placeholder="מקצועיות (15%)" className="h-11 rounded-lg border px-3" />
    <input name="requirements_score" type="number" min="0" max="10" step="0.01" defaultValue={row?.requirements_score ?? ""} placeholder="עמידה בדרישות (25%)" className="h-11 rounded-lg border px-3" />
    <input name="weighted_score" type="number" min="0" max="10" step="0.01" defaultValue={row?.weighted_score ?? ""} placeholder="הערכה משוקללת (מחושב אוטומטית)" className="h-11 rounded-lg border px-3" />
    <input name="notes" defaultValue={row?.notes ?? ""} placeholder="הערות" className="h-11 rounded-lg border px-3" />
    <label className="flex items-center gap-2 rounded-lg border p-3 font-bold"><input type="checkbox" name="has_certification" value="true" defaultChecked={row?.has_certification} /> קיימת הסמכה</label>
    <label className="flex items-center gap-2 rounded-lg border p-3 font-bold"><input type="checkbox" name="has_experience" value="true" defaultChecked={row?.has_experience} /> ניסיון קודם</label>
  </div>;
}

export function SuppliersManager({ rows, alertsEnabled }: { rows: SupplierRow[]; alertsEnabled: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [createState, createAction, creating] = useActionState(async (previousState: SupplierActionResult, formData: FormData) => {
    const result = await createSupplier(previousState, formData);
    if (result.success) {
      setAdding(false);
      router.refresh();
    }
    return result;
  }, initialState);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [savingEdit, startEdit] = useTransition();

  const counts = useMemo(() => ({
    all: rows.length,
    expired: rows.filter((row) => { const days = daysLeft(row.expiration_date); return days !== null && days < 0; }).length,
    upcoming: rows.filter((row) => { const days = daysLeft(row.expiration_date); return days !== null && days >= 0 && days <= 90; }).length,
    missing: rows.filter((row) => !row.expiration_date).length,
  }), [rows]);

  const visible = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    const matches = !query || [row.supplier_number, row.supplier_name, row.product_service, row.certification_type, row.notes].some((value) => value?.toLowerCase().includes(query));
    if (!matches) return false;
    const days = daysLeft(row.expiration_date);
    if (filter === "expired") return days !== null && days < 0;
    if (filter === "upcoming") return days !== null && days >= 0 && days <= 90;
    if (filter === "valid") return days !== null && days > 90;
    if (filter === "missing") return days === null;
    return true;
  }), [rows, search, filter]);

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setEditMessage("");
    startEdit(async () => {
      const result = await updateSupplier(formData);
      setEditMessage(result.message);
      if (result.success) { setEditing(null); router.refresh(); }
    });
  }

  const cards: Array<[Filter, string, number, string]> = [
    ["all", "כל הספקים", counts.all, "text-slate-950"],
    ["expired", "תוקף פג", counts.expired, "text-red-600"],
    ["upcoming", "תוקף עד 90 יום", counts.upcoming, "text-orange-600"],
    ["missing", "ללא תאריך תוקף", counts.missing, "text-slate-500"],
  ];

  return <div className="space-y-7">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div><h1 className="text-3xl font-extrabold sm:text-4xl">מעקב ספקים</h1><p className="mt-2 text-slate-500">ניהול ספקים, הערכת ביצועים ותוקף הסמכות</p></div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setAdding(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-5 font-bold text-white"><Plus className="h-5 w-5" />הוספת ספק ידנית</button>
        <form action={setSupplierAlertsEnabled.bind(null, !alertsEnabled)}>
          <button type="submit" className={`inline-flex h-11 items-center gap-2 rounded-lg border px-5 font-bold transition ${alertsEnabled ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"}`}>
            {alertsEnabled ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}{alertsEnabled ? "כיבוי כל התראות הספקים" : "הפעלת התראות ספקים"}
          </button>
        </form>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([key, title, value, color]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-2xl border bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 ${filter === key ? "ring-2 ring-slate-900" : ""}`}><p className="text-sm font-bold text-slate-500">{title}</p><p className={`mt-2 text-4xl font-extrabold ${color}`}>{value}</p></button>)}</div>

    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Building2 />רשימת ספקים ({visible.length})</h2>
          <p className="mt-1 text-xs text-slate-500">ניתן לערוך באמצעות כפתור העריכה או בלחיצה כפולה על שורת הספק</p>
        </div>
        <div className="flex flex-wrap gap-2"><label className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש ספק..." className="h-10 rounded-lg border pr-9 pl-3" /></label><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="h-10 rounded-lg border bg-white px-3"><option value="all">כל הספקים</option><option value="expired">תוקף פג</option><option value="upcoming">עד 90 יום</option><option value="valid">בתוקף</option><option value="missing">ללא תאריך</option></select></div>
      </div>
      {visible.length ? <div className="w-full"><table className="w-full table-fixed break-words text-right text-[8px] leading-tight sm:text-[9px] xl:text-[10px] 2xl:text-[11px]"><thead className="sticky top-0 bg-slate-50"><tr>{["#", "שם הספק", "מוצר / שירות", "הסמכה", "ניסיון", "סטטוס", "סוג הסמכה", "תאריך תפוגה", "מצב תוקף", "עמידה בלו״ז 30%", "איכות 30%", "מקצועיות 15%", "עמידה בדרישות 25%", "הערכה משוקללת", "הערות", "פעולות"].map((heading) => <th key={heading} className={`break-words p-1.5 ${heading === "פעולות" ? "border-r bg-slate-50" : ""}`}>{heading}</th>)}</tr></thead><tbody>{visible.map((row) => { const status = expiryStatus(row.expiration_date); return <tr key={row.id} onDoubleClick={() => { setEditing(row); setEditMessage(""); }} className="group cursor-pointer border-t align-top hover:bg-slate-50"><td className="p-1.5 font-bold">{row.supplier_number || "—"}</td><td className="max-w-64 p-1.5 font-bold">{row.supplier_name}</td><td className="max-w-56 p-1.5">{row.product_service || "—"}</td><td className="p-1.5">{row.has_certification ? "כן" : "לא"}</td><td className="p-1.5">{row.has_experience ? "כן" : "לא"}</td><td className="p-1.5">{row.status === "Approved" ? "מאושר" : row.status}</td><td className="max-w-64 p-1.5">{row.certification_type || "—"}</td><td className="break-words p-1.5 font-bold">{formatDate(row.expiration_date)}</td><td className="p-1.5"><span className={`inline-block break-words rounded-md px-1 py-0.5 text-[inherit] font-bold ${status.color}`}>{status.text}</span></td><td className="p-1.5 text-center">{row.delivery_score ?? "—"}</td><td className="p-1.5 text-center">{row.quality_score ?? "—"}</td><td className="p-1.5 text-center">{row.professionalism_score ?? "—"}</td><td className="p-1.5 text-center">{row.requirements_score ?? "—"}</td><td className="p-1.5 text-center font-extrabold">{row.weighted_score ?? "—"}</td><td className="max-w-72 p-1.5">{row.notes || "—"}</td><td onDoubleClick={(event) => event.stopPropagation()} className="border-r bg-white p-1.5 group-hover:bg-slate-50"><div className="flex flex-wrap items-center justify-center gap-1"><button type="button" onClick={() => { setEditing(row); setEditMessage(""); }} className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 font-bold text-blue-700 transition hover:bg-blue-100"><Pencil className="h-3 w-3 shrink-0" />עריכה</button><form action={deleteSupplier.bind(null, row.id)}><button aria-label={`מחיקת הספק ${row.supplier_name}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></form></div></td></tr>; })}</tbody></table></div> : <p className="p-10 text-center text-slate-500">אין ספקים להצגה בסינון זה</p>}
    </section>

    <Dialog open={adding} onOpenChange={setAdding}><DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>הוספת ספק ידנית</DialogTitle><DialogDescription>ניתן להזין ציונים או להשאירם ריקים. ההערכה המשוקללת תחושב אוטומטית כאשר כל ארבעת הציונים קיימים.</DialogDescription></DialogHeader><form action={createAction}><SupplierFields />{createState.message && <p className={`mt-3 text-sm font-bold ${createState.success ? "text-emerald-600" : "text-red-600"}`}>{createState.message}</p>}<DialogFooter className="mt-5"><button type="button" onClick={() => setAdding(false)} className="h-10 rounded-lg border px-5 font-bold">ביטול</button><button disabled={creating} className="h-10 rounded-lg bg-slate-950 px-5 font-bold text-white disabled:opacity-50">{creating ? "שומר..." : "הוסף ספק"}</button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>עריכת ספק</DialogTitle><DialogDescription>עדכון פרטי הספק, ההסמכה והערכת הביצועים.</DialogDescription></DialogHeader>{editing && <form onSubmit={saveEdit}><input type="hidden" name="id" value={editing.id} /><SupplierFields row={editing} />{editMessage && <p className="mt-3 text-sm font-bold text-red-600">{editMessage}</p>}<DialogFooter className="mt-5"><button type="button" onClick={() => setEditing(null)} className="h-10 rounded-lg border px-5 font-bold">ביטול</button><button disabled={savingEdit} className="h-10 rounded-lg bg-slate-950 px-5 font-bold text-white disabled:opacity-50">{savingEdit ? "שומר..." : "שמירת שינויים"}</button></DialogFooter></form>}</DialogContent></Dialog>
  </div>;
}
