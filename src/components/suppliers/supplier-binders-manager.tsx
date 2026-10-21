"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, FolderOpen, Search, ShieldAlert, X } from "lucide-react";

import { PrefetchLink } from "@/components/layout/prefetch-link";
import {
  entrySearchScore,
  findSupplierRecord,
  isSupplierSearchMatch,
  supplierBinders,
  type SupplierBinderEntry,
  type SupplierBinderRecord,
} from "@/lib/supplier-binders";

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
  return {
    text: `${approval.text} · ${expiration}${expired ? " · פג תוקף" : ""}`,
    className: expired ? "text-red-700" : approval.className,
    warning: expired || approval.text === "לא מאושר",
  };
}

function SupplierLine({
  entry,
  position,
  supplier,
  today,
  fuzzy,
}: {
  entry: SupplierBinderEntry;
  position: number;
  supplier: SupplierBinderRecord | null;
  today: string;
  fuzzy: boolean;
}) {
  const meta = supplierMeta(supplier, today);
  const content = <>
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-500">{position}</span>
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="break-words font-extrabold text-slate-950">{entry.name}</span>
        {fuzzy ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">התאמה קרובה</span> : null}
      </span>
      <span className={`mt-0.5 block text-xs font-bold ${meta.className}`}>({meta.text})</span>
    </span>
    {meta.warning ? <ShieldAlert className={`h-4 w-4 shrink-0 ${meta.className}`} /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
    {supplier ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
  </>;

  const className = "flex min-h-[58px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right transition hover:border-slate-300 hover:bg-slate-50";
  return supplier ? (
    <PrefetchLink className={className} href={`/suppliers?q=${encodeURIComponent(supplier.supplier_name)}`} aria-label={`פתיחת הספק ${supplier.supplier_name} במעקב ספקים`}>
      {content}
    </PrefetchLink>
  ) : <div className={className}>{content}</div>;
}

export function SupplierBindersManager({ suppliers, today }: { suppliers: SupplierBinderRecord[]; today: string }) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());

  const recordByEntry = useMemo(() => {
    const records = new Map<string, SupplierBinderRecord | null>();
    for (const binder of supplierBinders) {
      binder.suppliers.forEach((entry, index) => records.set(`${binder.id}-${index}`, findSupplierRecord(entry, suppliers)));
    }
    return records;
  }, [suppliers]);

  const visibleBinders = useMemo(() => supplierBinders.flatMap((binder) => {
    const entries = binder.suppliers.flatMap((entry, index) => {
      if (deferredSearch && !isSupplierSearchMatch(deferredSearch, entry)) return [];
      return [{ entry, index, score: deferredSearch ? entrySearchScore(deferredSearch, entry) : 100 }];
    });
    return entries.length ? [{ ...binder, entries }] : [];
  }), [deferredSearch]);

  const totalPlacements = supplierBinders.reduce((total, binder) => total + binder.suppliers.length, 0);
  const visiblePlacements = visibleBinders.reduce((total, binder) => total + binder.entries.length, 0);
  const matchedRecords = Array.from(recordByEntry.values()).filter(Boolean).length;

  return <div className="space-y-6">
    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="mb-2 text-sm font-extrabold text-blue-700">איתור מהיר במחלקת האיכות</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">מעקב קלסרי ספקים</h1>
        <p className="mt-2 max-w-2xl text-slate-500">כל קלסרי הספקים לפי הסדר, עם סטטוס האישור ותוקף ההסמכה המעודכנים ממעקב הספקים.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-2xl border bg-white px-4 py-3 text-center shadow-sm"><p className="text-2xl font-black">{supplierBinders.length}</p><p className="text-xs font-bold text-slate-500">קלסרים</p></div>
        <div className="rounded-2xl border bg-white px-4 py-3 text-center shadow-sm"><p className="text-2xl font-black">{totalPlacements}</p><p className="text-xs font-bold text-slate-500">מיקומי ספקים</p></div>
        <div className="rounded-2xl border bg-white px-4 py-3 text-center shadow-sm"><p className="text-2xl font-black text-emerald-700">{matchedRecords}</p><p className="text-xs font-bold text-slate-500">מקושרים למעקב</p></div>
      </div>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <label htmlFor="binder-search" className="mb-2 block text-sm font-extrabold text-slate-700">באיזה קלסר נמצא הספק?</label>
      <div className="relative">
        <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          id="binder-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="חיפוש לפי שם הספק, בעברית או באנגלית..."
          autoComplete="off"
          className="h-13 w-full rounded-xl border border-slate-300 bg-slate-50 pr-12 pl-12 text-base font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
        {search ? <button type="button" onClick={() => setSearch("")} aria-label="ניקוי החיפוש" className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span>החיפוש סלחני לשגיאות כתיב, רווחים וסימני פיסוק. לדוגמה: נאוטק, נאותק או Nautec.</span>
        {deferredSearch ? <span aria-live="polite" className="rounded-full bg-blue-50 px-3 py-1 font-extrabold text-blue-700">{visiblePlacements ? `${visiblePlacements} מיקומים נמצאו` : "לא נמצאה התאמה"}</span> : null}
      </div>
    </section>

    {visibleBinders.length ? <section className="grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
      {visibleBinders.map((binder) => <article key={binder.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm [content-visibility:auto]">
        <div className="flex items-center justify-between bg-gradient-to-l from-slate-950 to-slate-800 px-5 py-4 text-white">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><FolderOpen className="h-5 w-5" /></span><div><h2 className="text-xl font-black">קלסר {binder.label}</h2><p className="text-xs font-semibold text-slate-300">לפי סדר הרשימה הפיזית</p></div></div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold">{binder.entries.length}{deferredSearch ? ` מתוך ${binder.suppliers.length}` : " ספקים"}</span>
        </div>
        <div className="space-y-2 p-3 sm:p-4">
          {binder.entries.map(({ entry, index, score }) => <SupplierLine key={`${binder.id}-${index}`} entry={entry} position={index + 1} supplier={recordByEntry.get(`${binder.id}-${index}`) ?? null} today={today} fuzzy={Boolean(deferredSearch && score < 92)} />)}
        </div>
      </article>)}
    </section> : <section className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center"><Search className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 text-xl font-black">לא נמצא ספק בשם הזה</h2><p className="mt-2 text-sm text-slate-500">אפשר לנסות איות מעט שונה, שם חלקי או שם באנגלית.</p><button type="button" onClick={() => setSearch("")} className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 font-bold text-white">הצגת כל הקלסרים</button></section>}
  </div>;
}
