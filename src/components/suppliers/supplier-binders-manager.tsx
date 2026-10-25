"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { addSupplierBinderEntry, deleteSupplierBinderEntry, updateSupplierBinderEntry, updateSupplierBinderName } from "@/app/supplier-binders/actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { entrySearchScore, findSupplierRecord, isSupplierSearchMatch, supplierNameScore, type SupplierBinder, type SupplierBinderEntry, type SupplierBinderRecord } from "@/lib/supplier-binders";

type EntryEditor = { mode: "add"; binder: SupplierBinder } | { mode: "edit"; binder: SupplierBinder; entry: SupplierBinderEntry };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL").format(new Date(`${value}T12:00:00`));
}

function approvalLabel(status: string) {
  const normalized = status.trim().toLocaleLowerCase("en-US");
  if (normalized === "approved" || normalized === "מאושר") return { text: "מאושר", className: "text-emerald-700", dot: "bg-emerald-500" };
  if (normalized === "conditional" || normalized.includes("תנאי")) return { text: "מאושר בתנאים", className: "text-amber-700", dot: "bg-amber-500" };
  if (normalized === "not approved" || normalized === "לא מאושר") return { text: "לא מאושר", className: "text-red-700", dot: "bg-red-500" };
  return { text: status || "ללא סטטוס", className: "text-slate-600", dot: "bg-slate-400" };
}

function supplierMeta(supplier: SupplierBinderRecord | null, today: string) {
  if (!supplier) return { text: "לא נמצא במעקב ספקים", className: "text-amber-700", dot: "bg-amber-400", warning: true };
  const approval = approvalLabel(supplier.status);
  const expiration = supplier.expiration_date ? `תוקף: ${formatDate(supplier.expiration_date)}` : "ללא תאריך תוקף";
  const expired = Boolean(supplier.expiration_date && supplier.expiration_date < today);
  return {
    text: `${approval.text} · ${expiration}${expired ? " · פג תוקף" : ""}`,
    className: expired ? "text-red-700" : approval.className,
    dot: expired ? "bg-red-500" : approval.dot,
    warning: expired || approval.text === "לא מאושר",
  };
}

function BinderEditorDialog({ binder, onClose, onAdd, onEdit, onDelete }: { binder: SupplierBinder; onClose: () => void; onAdd: () => void; onEdit: (entry: SupplierBinderEntry) => void; onDelete: (entry: SupplierBinderEntry) => void }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, startSaving] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("binder_id", binder.id);
    setMessage("");
    startSaving(async () => {
      const result = await updateSupplierBinderName(formData);
      if (result.success) { router.refresh(); onClose(); } else setMessage(result.message);
    });
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>עריכת קלסר {binder.label}</DialogTitle><DialogDescription>מכאן אפשר לשנות את שם הקלסר ולנהל את כל רשימת הספקים שלו.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-3"><label className="block text-sm font-bold text-slate-700">שם הקלסר<div className="mt-2 flex gap-2"><input name="label" required maxLength={40} defaultValue={binder.label} className="h-11 min-w-0 flex-1 rounded-xl border px-3 font-bold" /><button disabled={saving} className="h-11 shrink-0 rounded-xl bg-slate-950 px-4 font-bold text-white disabled:opacity-50">{saving ? "שומר..." : "שינוי שם"}</button></div></label>{message ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p> : null}</form>
    <section className="mt-2"><div className="mb-2 flex items-center justify-between"><div><h3 className="font-black text-slate-900">ספקים בקלסר</h3><p className="text-xs text-slate-500">{binder.suppliers.length} ספקים</p></div><button type="button" onClick={onAdd} className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-extrabold text-blue-800 hover:bg-blue-100"><Plus className="h-4 w-4" />הוספת ספק</button></div>
      <div className="divide-y overflow-hidden rounded-xl border bg-white">{binder.suppliers.map((entry, index) => <div key={entry.id ?? `${binder.id}-${index}`} className="flex items-center gap-2 px-3 py-2.5"><span className="min-w-0 flex-1 break-words text-sm font-bold text-slate-800">{entry.name}</span><button type="button" onClick={() => onEdit(entry)} aria-label={`עריכת ${entry.name}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => onDelete(entry)} aria-label={`הסרת ${entry.name}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>)}{!binder.suppliers.length ? <p className="p-6 text-center text-sm text-slate-500">אין ספקים בקלסר</p> : null}</div>
    </section>
    <DialogFooter><button type="button" onClick={onClose} className="h-10 rounded-xl border px-5 font-bold">סגירה</button></DialogFooter>
  </DialogContent></Dialog>;
}

function EntryEditorDialog({ editor, suppliers, onClose }: { editor: EntryEditor; suppliers: SupplierBinderRecord[]; onClose: () => void }) {
  const router = useRouter();
  const editingEntry = editor.mode === "edit" ? editor.entry : null;
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState(editingEntry?.supplierId ?? "");
  const [message, setMessage] = useState("");
  const [saving, startSaving] = useTransition();
  const visibleSuppliers = useMemo(() => {
    const query = supplierSearch.trim();
    return (query ? suppliers.filter((supplier) => supplierNameScore(query, supplier.supplier_name) >= 62) : suppliers).slice(0, 40);
  }, [supplierSearch, suppliers]);
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

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editor.mode === "add" ? `הוספת ספק לקלסר ${editor.binder.label}` : `עריכת ספק בקלסר ${editor.binder.label}`}</DialogTitle><DialogDescription>שם התצוגה הוא מה שכתוב על מדבקת הקלסר. קישור למעקב הספקים מושך אוטומטית את הסטטוס והתוקף.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5">
    <label className="block text-sm font-bold text-slate-700">שם הספק על המדבקה<input name="display_name" required maxLength={300} defaultValue={editingEntry?.name ?? ""} placeholder="לדוגמה: Nautec" className="mt-2 h-11 w-full rounded-xl border px-3 font-semibold" /></label>
    <section><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-bold text-slate-700">קישור למעקב ספקים</p><p className="mt-1 text-xs text-slate-500">החיפוש מזהה גם כתיב עברי ואנגלי, למשל אלון ו־ALON.</p></div>{selectedSupplier ? <button type="button" onClick={() => setSelectedSupplierId("")} className="shrink-0 text-xs font-bold text-red-600">הסרת קישור</button> : null}</div>
      {selectedSupplier ? <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div><p className="font-extrabold text-emerald-900">{selectedSupplier.supplier_name}</p><p className="mt-0.5 text-xs font-semibold text-emerald-700">{selectedSupplier.expiration_date ? `תוקף: ${formatDate(selectedSupplier.expiration_date)}` : "ללא תאריך תוקף"}</p></div><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div> : null}
      <div className="relative mt-3"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="חיפוש ספק בעברית או באנגלית..." className="h-10 w-full rounded-xl border bg-slate-50 pr-9 pl-3 text-sm" /></div>
      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border p-1.5">{visibleSuppliers.map((supplier) => <button key={supplier.id} type="button" onClick={() => setSelectedSupplierId(supplier.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm transition ${selectedSupplierId === supplier.id ? "bg-slate-950 text-white" : "hover:bg-slate-100"}`}><span className="font-bold">{supplier.supplier_name}</span>{selectedSupplierId === supplier.id ? <Check className="h-4 w-4" /> : <span className="text-xs opacity-60">{supplier.expiration_date ? formatDate(supplier.expiration_date) : "ללא תוקף"}</span>}</button>)}{!visibleSuppliers.length ? <p className="p-4 text-center text-sm text-slate-500">לא נמצאו ספקים</p> : null}</div>
    </section>
    {message ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p> : null}
    <DialogFooter><button type="button" onClick={onClose} className="h-10 rounded-xl border px-5 font-bold">ביטול</button><button disabled={saving} className="h-10 rounded-xl bg-slate-950 px-5 font-bold text-white disabled:opacity-50">{saving ? "שומר..." : editor.mode === "add" ? "הוספה לקלסר" : "שמירת שינויים"}</button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function LabelSupplierRow({ entry, supplier, today, editable, onEdit }: { entry: SupplierBinderEntry; supplier: SupplierBinderRecord | null; today: string; editable: boolean; onEdit: () => void }) {
  const meta = supplierMeta(supplier, today);
  return <div title={`${meta.text}${editable ? " · לחיצה כפולה לעריכה" : ""}`} onDoubleClick={editable ? onEdit : undefined} onKeyDown={editable ? (event) => { if (event.key === "Enter") onEdit(); } : undefined} role={editable ? "button" : undefined} tabIndex={editable ? 0 : undefined} className={`flex min-h-6 items-start border-b border-dashed border-slate-200 py-1 last:border-0 ${editable ? "cursor-pointer rounded-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" : ""}`}><span className="min-w-0 flex-1 break-words text-[11px] font-extrabold leading-tight text-slate-900">{entry.name}</span></div>;
}

export function SupplierBindersManager({ binders, suppliers, today, editable }: { binders: SupplierBinder[]; suppliers: SupplierBinderRecord[]; today: string; editable: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [entryEditor, setEntryEditor] = useState<EntryEditor | null>(null);
  const [binderEditor, setBinderEditor] = useState<SupplierBinder | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [deleting, startDeleting] = useTransition();
  const deferredSearch = useDeferredValue(search.trim());

  const recordByEntry = useMemo(() => {
    const records = new Map<string, SupplierBinderRecord | null>();
    for (const binder of binders) binder.suppliers.forEach((entry, index) => records.set(entry.id ?? `${binder.id}-${index}`, findSupplierRecord(entry, suppliers)));
    return records;
  }, [binders, suppliers]);

  const visibleBinders = useMemo(() => binders.flatMap((binder) => {
    const entries = binder.suppliers.flatMap((entry, index) => {
      const linkedSupplier = recordByEntry.get(entry.id ?? `${binder.id}-${index}`);
      const linkedScore = deferredSearch && linkedSupplier ? supplierNameScore(deferredSearch, linkedSupplier.supplier_name) : 0;
      if (deferredSearch && linkedScore < 62 && !isSupplierSearchMatch(deferredSearch, entry)) return [];
      return [{ entry, index, score: deferredSearch ? Math.max(entrySearchScore(deferredSearch, entry), linkedScore) : 100 }];
    });
    return entries.length ? [{ ...binder, entries }] : [];
  }), [binders, deferredSearch, recordByEntry]);

  function removeEntry(entry: SupplierBinderEntry) {
    if (!entry.id || !window.confirm(`להסיר את ${entry.name} מהקלסר? הספק עצמו לא יימחק ממעקב הספקים.`)) return;
    setActionMessage("");
    startDeleting(async () => {
      const result = await deleteSupplierBinderEntry(entry.id!);
      setActionMessage(result.message);
      if (result.success) router.refresh();
    });
  }

  const totalPlacements = binders.reduce((total, binder) => total + binder.suppliers.length, 0);
  const visiblePlacements = visibleBinders.reduce((total, binder) => total + binder.entries.length, 0);
  const matchedRecords = Array.from(recordByEntry.values()).filter(Boolean).length;

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><h1 className="text-3xl font-black tracking-tight sm:text-4xl">מעקב קלסרים</h1><div className="grid grid-cols-3 gap-2"><div className="rounded-xl border bg-white px-3 py-2 text-center"><b>{binders.length}</b><span className="mr-1 text-[10px] text-slate-500">קלסרים</span></div><div className="rounded-xl border bg-white px-3 py-2 text-center"><b>{totalPlacements}</b><span className="mr-1 text-[10px] text-slate-500">מיקומים</span></div><div className="rounded-xl border bg-white px-3 py-2 text-center"><b className="text-emerald-700">{matchedRecords}</b><span className="mr-1 text-[10px] text-slate-500">מקושרים</span></div></div></header>
    {!editable ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">אפשרויות העריכה ממתינות להפעלת עדכון מסד הנתונים של הקלסרים. הרשימות מוצגות כעת לקריאה בלבד.</p> : null}
    {actionMessage ? <p aria-live="polite" className={`rounded-xl p-3 text-sm font-bold ${actionMessage.includes("נכשלה") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{deleting ? "מבצע..." : actionMessage}</p> : null}
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="relative"><Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש ספק בעברית או באנגלית, למשל אלון או ALON..." autoComplete="off" className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pr-12 pl-12 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="ניקוי החיפוש" className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-slate-200"><X className="h-4 w-4" /></button> : null}</div>{deferredSearch ? <p aria-live="polite" className="mt-2 text-xs font-extrabold text-blue-700">{visiblePlacements ? `${visiblePlacements} מיקומים נמצאו` : "לא נמצאה התאמה"}</p> : <p className="mt-2 text-[11px] font-semibold text-slate-500">החיפוש סלחני לשגיאות כתיב, הבדלי שפה, רווחים וסימני פיסוק.</p>}</section>
    {visibleBinders.length ? <section className="rounded-2xl border border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200 p-3 shadow-inner sm:p-4"><div className="grid items-end gap-2 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">{visibleBinders.map((binder, binderIndex) => <article key={binder.id} className={`relative flex min-h-[380px] flex-col overflow-hidden rounded-t-lg border-2 border-b-0 shadow-md [content-visibility:auto] ${binderIndex % 3 === 0 ? "border-blue-950 bg-blue-900" : binderIndex % 3 === 1 ? "border-slate-700 bg-slate-600" : "border-blue-800 bg-blue-700"}`}>
      <div className="flex min-h-12 items-center justify-between gap-1 border-b border-white/20 px-2 py-2 text-white"><div className="min-w-0"><h2 className="truncate text-sm font-black">קלסר {binder.label}</h2><p className="text-[9px] font-bold text-white/70">{binder.suppliers.length} ספקים</p></div>{editable ? <button type="button" onClick={() => setBinderEditor(binder)} aria-label={`עריכת קלסר ${binder.label}`} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 text-[10px] font-extrabold hover:bg-white/20"><Pencil className="h-3.5 w-3.5" />עריכה</button> : null}</div>
      <div className="m-2 flex-1 rounded-sm border border-slate-300 bg-[#fffef8] p-2 shadow-inner"><div className="mb-1 flex items-center justify-between border-b-2 border-slate-800 pb-1"><span className="text-[10px] font-black text-slate-900">רשימת ספקים</span><span className="text-[9px] font-bold text-slate-500">{binder.entries.length}{deferredSearch ? `/${binder.suppliers.length}` : ""}</span></div>{binder.entries.map(({ entry, index }) => <LabelSupplierRow key={entry.id ?? `${binder.id}-${index}`} entry={entry} supplier={recordByEntry.get(entry.id ?? `${binder.id}-${index}`) ?? null} today={today} editable={editable} onEdit={() => setEntryEditor({ mode: "edit", binder, entry })} />)}{!binder.entries.length ? <p className="py-4 text-center text-[10px] font-bold text-slate-400">הקלסר ריק</p> : null}</div>
      <div className="mx-auto mb-2 h-4 w-4 rounded-full border-2 border-black/50 bg-slate-950 shadow-inner" />
    </article>)}</div><div className="h-4 rounded-b-lg border-x border-b border-slate-400 bg-gradient-to-b from-slate-500 to-slate-700 shadow-lg" /></section> : <section className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center"><Search className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-3 text-xl font-black">לא נמצא ספק בשם הזה</h2><button type="button" onClick={() => setSearch("")} className="mt-4 rounded-xl bg-slate-950 px-5 py-2.5 font-bold text-white">הצגת כל הקלסרים</button></section>}
    {entryEditor ? <EntryEditorDialog key={`${entryEditor.mode}-${entryEditor.binder.id}-${entryEditor.mode === "edit" ? entryEditor.entry.id : "new"}`} editor={entryEditor} suppliers={suppliers} onClose={() => setEntryEditor(null)} /> : null}
    {binderEditor ? <BinderEditorDialog key={binderEditor.id} binder={binderEditor} onClose={() => setBinderEditor(null)} onAdd={() => { const binder = binderEditor; setBinderEditor(null); setEntryEditor({ mode: "add", binder }); }} onEdit={(entry) => { const binder = binderEditor; setBinderEditor(null); setEntryEditor({ mode: "edit", binder, entry }); }} onDelete={(entry) => { setBinderEditor(null); removeEntry(entry); }} /> : null}
  </div>;
}
