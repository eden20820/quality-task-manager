"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ExternalLink, FolderOpen, Minus, Pencil, Plus, Search, ShieldAlert, Trash2, X } from "lucide-react";

import { addSupplierBinderEntry, deleteSupplierBinderEntry, updateSupplierBinderEntry } from "@/app/supplier-binders/actions";
import { PrefetchLink } from "@/components/layout/prefetch-link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { entrySearchScore, findSupplierRecord, isSupplierSearchMatch, type SupplierBinder, type SupplierBinderEntry, type SupplierBinderRecord } from "@/lib/supplier-binders";

type Density = "compact" | "comfortable" | "large";
type Editor = { mode: "add"; binder: SupplierBinder } | { mode: "edit"; binder: SupplierBinder; entry: SupplierBinderEntry };

const densityOrder: Density[] = ["compact", "comfortable", "large"];
const densityLabels: Record<Density, string> = { compact: "מצומצם", comfortable: "רגיל", large: "מוגדל" };
const densityStyles: Record<Density, { grid: string; card: string; header: string; row: string; title: string; meta: string; spacing: string }> = {
  compact: { grid: "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", card: "rounded-xl", header: "px-3 py-2.5", row: "min-h-11 gap-2 rounded-lg px-2 py-1.5", title: "text-xs", meta: "text-[10px]", spacing: "space-y-1 p-2" },
  comfortable: { grid: "lg:grid-cols-2 2xl:grid-cols-3", card: "rounded-2xl", header: "px-4 py-3", row: "min-h-[54px] gap-3 rounded-xl px-3 py-2", title: "text-sm", meta: "text-xs", spacing: "space-y-2 p-3" },
  large: { grid: "xl:grid-cols-2", card: "rounded-2xl", header: "px-5 py-4", row: "min-h-[62px] gap-3 rounded-xl px-4 py-3", title: "text-base", meta: "text-sm", spacing: "space-y-2.5 p-4" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL").format(new Date(`${value}T12:00:00`));
}

function approvalLabel(status: string) {
  const normalized = status.trim().toLocaleLowerCase("en-US");
  if (normalized === "approved" || normalized === "מאושר") return { text: "מאושר", className: "text-emerald-700" };
  if (normalized === "conditional" || normalized.includes("תנאי")) return { text: "מאושר בתנאים", className: "text-amber-700" };
  if (normalized === "not approved" || normalized === "לא מאושר") return { text: "לא מאושר", className: "text-red-700" };
  return { text: status || "ללא סטטוס", className: "text-slate-600" };
}

function supplierMeta(supplier: SupplierBinderRecord | null, today: string) {
  if (!supplier) return { text: "לא נמצא במעקב ספקים", className: "text-amber-700", warning: true };
  const approval = approvalLabel(supplier.status);
  const expiration = supplier.expiration_date ? `תוקף: ${formatDate(supplier.expiration_date)}` : "ללא תאריך תוקף";
  const expired = Boolean(supplier.expiration_date && supplier.expiration_date < today);
  return { text: `${approval.text} · ${expiration}${expired ? " · פג תוקף" : ""}`, className: expired ? "text-red-700" : approval.className, warning: expired || approval.text === "לא מאושר" };
}

function EntryEditorDialog({ editor, suppliers, onClose }: { editor: Editor; suppliers: SupplierBinderRecord[]; onClose: () => void }) {
  const router = useRouter();
  const editingEntry = editor.mode === "edit" ? editor.entry : null;
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState(editingEntry?.supplierId ?? "");
  const [message, setMessage] = useState("");
  const [saving, startSaving] = useTransition();
  const normalizedSearch = supplierSearch.trim().toLocaleLowerCase("he-IL");
  const visibleSuppliers = (normalizedSearch ? suppliers.filter((supplier) => supplier.supplier_name.toLocaleLowerCase("he-IL").includes(normalizedSearch)) : suppliers).slice(0, 30);
  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("supplier_id", selectedSupplierId);
    formData.set("binder_id", editor.binder.id);
    if (editingEntry?.id) formData.set("entry_id", editingEntry.id);
    setMessage("");
    startSaving(async () => {
      const result = editor.mode === "add" ? await addSupplierBinderEntry(formData) : await updateSupplierBinderEntry(formData);
      if (result.success) { router.refresh(); onClose(); } else setMessage(result.message);
    });
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editor.mode === "add" ? `הוספת ספק לקלסר ${editor.binder.label}` : `עריכת ספק בקלסר ${editor.binder.label}`}</DialogTitle><DialogDescription>שם התצוגה הוא מה שכתוב על הקלסר. הקישור למעקב הספקים מושך משם אוטומטית את הסטטוס והתוקף.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5">
    <label className="block text-sm font-bold text-slate-700">שם הספק בקלסר<input name="display_name" required maxLength={300} defaultValue={editingEntry?.name ?? ""} placeholder="לדוגמה: Nautec" className="mt-2 h-11 w-full rounded-xl border px-3 font-semibold" /></label>
    <section><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-bold text-slate-700">קישור למעקב ספקים</p><p className="mt-1 text-xs text-slate-500">אם ההתאמה האוטומטית אינה נכונה, בחרו כאן את הרשומה המתאימה.</p></div>{selectedSupplier ? <button type="button" onClick={() => setSelectedSupplierId("")} className="shrink-0 text-xs font-bold text-red-600">הסרת קישור</button> : null}</div>
      {selectedSupplier ? <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div><p className="font-extrabold text-emerald-900">{selectedSupplier.supplier_name}</p><p className="mt-0.5 text-xs font-semibold text-emerald-700">{selectedSupplier.expiration_date ? `תוקף: ${formatDate(selectedSupplier.expiration_date)}` : "ללא תאריך תוקף"}</p></div><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div> : null}
      <div className="relative mt-3"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="חיפוש ברשימת מעקב הספקים..." className="h-10 w-full rounded-xl border bg-slate-50 pr-9 pl-3 text-sm" /></div>
      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border p-1.5">{visibleSuppliers.map((supplier) => <button key={supplier.id} type="button" onClick={() => setSelectedSupplierId(supplier.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm transition ${selectedSupplierId === supplier.id ? "bg-slate-950 text-white" : "hover:bg-slate-100"}`}><span className="font-bold">{supplier.supplier_name}</span>{selectedSupplierId === supplier.id ? <Check className="h-4 w-4" /> : <span className="text-xs opacity-60">{supplier.expiration_date ? formatDate(supplier.expiration_date) : "ללא תוקף"}</span>}</button>)}{!visibleSuppliers.length ? <p className="p-4 text-center text-sm text-slate-500">לא נמצאו ספקים</p> : null}</div>
    </section>
    {message ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p> : null}
    <DialogFooter><button type="button" onClick={onClose} className="h-10 rounded-xl border px-5 font-bold">ביטול</button><button disabled={saving} className="h-10 rounded-xl bg-slate-950 px-5 font-bold text-white disabled:opacity-50">{saving ? "שומר..." : editor.mode === "add" ? "הוספה לקלסר" : "שמירת שינויים"}</button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function SupplierLine({ entry, position, supplier, today, fuzzy, density, editable, onEdit, onDelete }: { entry: SupplierBinderEntry; position: number; supplier: SupplierBinderRecord | null; today: string; fuzzy: boolean; density: Density; editable: boolean; onEdit: () => void; onDelete: () => void }) {
  const meta = supplierMeta(supplier, today);
  const styles = densityStyles[density];
  return <div className={`flex items-center border border-slate-200 bg-white text-right transition hover:border-slate-300 hover:bg-slate-50 ${styles.row}`}><span className={`flex shrink-0 items-center justify-center bg-slate-100 font-black text-slate-500 ${density === "compact" ? "h-6 w-6 rounded-md text-[10px]" : "h-7 w-7 rounded-lg text-xs"}`}>{position}</span><div className="min-w-0 flex-1">{supplier ? <PrefetchLink href={`/suppliers?q=${encodeURIComponent(supplier.supplier_name)}`} className="group inline-flex min-w-0 items-center gap-1" aria-label={`פתיחת הספק ${supplier.supplier_name} במעקב ספקים`}><span className={`break-words font-extrabold text-slate-950 group-hover:text-blue-700 ${styles.title}`}>{entry.name}</span><ExternalLink className="h-3 w-3 shrink-0 text-slate-400" /></PrefetchLink> : <span className={`break-words font-extrabold text-slate-950 ${styles.title}`}>{entry.name}</span>}<span className={`block font-bold ${meta.className} ${styles.meta}`}>({meta.text})</span>{fuzzy ? <span className="mt-0.5 inline-block rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">התאמה קרובה</span> : null}</div>{meta.warning ? <ShieldAlert className={`h-4 w-4 shrink-0 ${meta.className}`} /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}{editable ? <div className="flex shrink-0 gap-1"><button type="button" onClick={onEdit} aria-label={`עריכת ${entry.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4" /></button><button type="button" onClick={onDelete} aria-label={`הסרת ${entry.name} מהקלסר`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div> : null}</div>;
}

export function SupplierBindersManager({ binders, suppliers, today, editable }: { binders: SupplierBinder[]; suppliers: SupplierBinderRecord[]; today: string; editable: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<Density>("compact");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [deleting, startDeleting] = useTransition();
  const deferredSearch = useDeferredValue(search.trim());

  function changeDensity(direction: -1 | 1) { const next = densityOrder[Math.max(0, Math.min(densityOrder.length - 1, densityOrder.indexOf(density) + direction))]; setDensity(next); }

  const recordByEntry = useMemo(() => { const records = new Map<string, SupplierBinderRecord | null>(); for (const binder of binders) binder.suppliers.forEach((entry, index) => records.set(entry.id ?? `${binder.id}-${index}`, findSupplierRecord(entry, suppliers))); return records; }, [binders, suppliers]);
  const visibleBinders = useMemo(() => binders.flatMap((binder) => { const entries = binder.suppliers.flatMap((entry, index) => { const linkedSupplier = recordByEntry.get(entry.id ?? `${binder.id}-${index}`); const matchesLinkedName = Boolean(deferredSearch && linkedSupplier?.supplier_name.toLocaleLowerCase("he-IL").includes(deferredSearch.toLocaleLowerCase("he-IL"))); if (deferredSearch && !matchesLinkedName && !isSupplierSearchMatch(deferredSearch, entry)) return []; return [{ entry, index, score: deferredSearch ? Math.max(entrySearchScore(deferredSearch, entry), matchesLinkedName ? 100 : 0) : 100 }]; }); return entries.length ? [{ ...binder, entries }] : []; }), [binders, deferredSearch, recordByEntry]);

  function removeEntry(entry: SupplierBinderEntry) { if (!entry.id || !window.confirm(`להסיר את ${entry.name} מהקלסר? הספק עצמו לא יימחק ממעקב הספקים.`)) return; setActionMessage(""); startDeleting(async () => { const result = await deleteSupplierBinderEntry(entry.id!); setActionMessage(result.message); if (result.success) router.refresh(); }); }

  const totalPlacements = binders.reduce((total, binder) => total + binder.suppliers.length, 0);
  const visiblePlacements = visibleBinders.reduce((total, binder) => total + binder.entries.length, 0);
  const matchedRecords = Array.from(recordByEntry.values()).filter(Boolean).length;
  const styles = densityStyles[density];

  return <div className="space-y-5"><header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="mb-1 text-sm font-extrabold text-blue-700">איתור מהיר במחלקת האיכות</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">מעקב קלסרי ספקים</h1><p className="mt-2 max-w-2xl text-slate-500">ניהול מיקום הספקים בקלסרים, עם סטטוס ותוקף חיים ממעקב הספקים.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex h-11 items-center rounded-xl border bg-white p-1 shadow-sm"><button type="button" onClick={() => changeDensity(-1)} disabled={density === "compact"} aria-label="הקטנת התצוגה" className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30"><Minus className="h-4 w-4" /></button><span className="min-w-20 text-center text-xs font-extrabold">{densityLabels[density]}</span><button type="button" onClick={() => changeDensity(1)} disabled={density === "large"} aria-label="הגדלת התצוגה" className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30"><Plus className="h-4 w-4" /></button></div><div className="grid grid-cols-3 gap-2"><div className="rounded-xl border bg-white px-3 py-2 text-center"><b>{binders.length}</b><span className="mr-1 text-[10px] text-slate-500">קלסרים</span></div><div className="rounded-xl border bg-white px-3 py-2 text-center"><b>{totalPlacements}</b><span className="mr-1 text-[10px] text-slate-500">מיקומים</span></div><div className="rounded-xl border bg-white px-3 py-2 text-center"><b className="text-emerald-700">{matchedRecords}</b><span className="mr-1 text-[10px] text-slate-500">מקושרים</span></div></div></div></header>
    {!editable ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">הקלסרים מוצגים במצב קריאה. יש להפעיל את עדכון מסד הנתונים החדש כדי לאפשר עריכה.</p> : null}{actionMessage ? <p aria-live="polite" className={`rounded-xl p-3 text-sm font-bold ${actionMessage.includes("נכשלה") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{deleting ? "מבצע..." : actionMessage}</p> : null}
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="relative"><Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="באיזה קלסר נמצא הספק? חיפוש בעברית או באנגלית..." autoComplete="off" className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pr-12 pl-12 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="ניקוי החיפוש" className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-slate-200"><X className="h-4 w-4" /></button> : null}</div>{deferredSearch ? <p aria-live="polite" className="mt-2 text-xs font-extrabold text-blue-700">{visiblePlacements ? `${visiblePlacements} מיקומים נמצאו` : "לא נמצאה התאמה"}</p> : <p className="mt-2 text-[11px] font-semibold text-slate-500">החיפוש סלחני לשגיאות כתיב, רווחים ושמות חלופיים.</p>}</section>
    {visibleBinders.length ? <section className={`grid items-start gap-3 ${styles.grid}`}>{visibleBinders.map((binder) => <article key={binder.id} className={`overflow-hidden border border-slate-200 bg-white shadow-sm [content-visibility:auto] ${styles.card}`}><div className={`flex items-center justify-between bg-gradient-to-l from-slate-950 to-slate-800 text-white ${styles.header}`}><div className="flex items-center gap-2"><FolderOpen className="h-5 w-5" /><div><h2 className="font-black">קלסר {binder.label}</h2>{density !== "compact" ? <p className="text-[10px] font-semibold text-slate-300">לפי סדר הרשימה הפיזית</p> : null}</div></div><div className="flex items-center gap-2"><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-extrabold">{binder.entries.length}{deferredSearch ? `/${binder.suppliers.length}` : " ספקים"}</span>{editable ? <button type="button" onClick={() => setEditor({ mode: "add", binder })} aria-label={`הוספת ספק לקלסר ${binder.label}`} className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2 text-[10px] font-extrabold text-slate-950 hover:bg-blue-50"><Plus className="h-3.5 w-3.5" />הוספה</button> : null}</div></div><div className={styles.spacing}>{binder.entries.map(({ entry, index, score }) => <SupplierLine key={entry.id ?? `${binder.id}-${index}`} entry={entry} position={entry.sortOrder ?? index + 1} supplier={recordByEntry.get(entry.id ?? `${binder.id}-${index}`) ?? null} today={today} fuzzy={Boolean(deferredSearch && score < 92)} density={density} editable={editable} onEdit={() => setEditor({ mode: "edit", binder, entry })} onDelete={() => removeEntry(entry)} />)}</div></article>)}</section> : <section className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center"><Search className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-3 text-xl font-black">לא נמצא ספק בשם הזה</h2><button type="button" onClick={() => setSearch("")} className="mt-4 rounded-xl bg-slate-950 px-5 py-2.5 font-bold text-white">הצגת כל הקלסרים</button></section>}
    {editor ? <EntryEditorDialog key={`${editor.mode}-${editor.binder.id}-${editor.mode === "edit" ? editor.entry.id : "new"}`} editor={editor} suppliers={suppliers} onClose={() => setEditor(null)} /> : null}
  </div>;
}
