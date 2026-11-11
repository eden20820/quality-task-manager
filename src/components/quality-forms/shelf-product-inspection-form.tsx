"use client";
import { CatalogInput } from "./catalog-input";
import { resolveCatalogItem, type CatalogItem } from "@/lib/quality-forms/parts-catalog";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Download, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buildQualityFormDownloadName, SHELF_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY } from "@/lib/quality-forms/form-archive";

import {
  createEmptyShelfInspection,
  normalizeShelfInspection,
  SHELF_INSPECTION_ITEMS,
  type InspectionResult,
  type ShelfProductInspectionPayload,
} from "@/lib/quality-forms/shelf-product-inspection";
import { SupplierBinderNotice } from "@/components/quality-forms/supplier-binder-notice";
import type { SupplierBinderDirectoryEntry } from "@/lib/supplier-binders";

function todayInIsrael() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function focusShelfEntry(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
  if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const form = event.currentTarget.closest<HTMLElement>('[data-shelf-form]');
  if (!form) return;
  const entries = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-shelf-entry]')).filter((entry) => !entry.disabled && entry.getClientRects().length > 0);
  const index = entries.indexOf(event.currentTarget);
  const offset = event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey) ? -1 : 1;
  const next = entries[index + offset];
  if (!next) return;
  event.preventDefault();
  next.focus();
  if (next instanceof HTMLInputElement) next.select();
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date"; placeholder?: string }) {
  return <label className="grid min-h-14 grid-cols-[minmax(125px,0.8fr)_minmax(0,1.7fr)] border-b border-slate-300 last:border-b-0"><span className="flex items-center justify-center border-l border-slate-300 bg-slate-50 px-3 text-center text-sm font-black text-slate-800">{label}</span><span className="flex items-center p-2"><input data-shelf-entry type={type} min={type === "number" ? 0 : undefined} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onKeyDown={focusShelfEntry} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></span></label>;
}

function ResultButtons({ value, onChange }: { value: InspectionResult; onChange: (value: InspectionResult) => void }) {
  return <div className="flex items-center justify-center gap-2"><button type="button" onClick={() => onChange(value === "pass" ? "" : "pass")} aria-pressed={value === "pass"} className={`h-10 min-w-16 rounded-lg border text-sm font-black transition ${value === "pass" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}>תקין</button><button type="button" onClick={() => onChange(value === "fail" ? "" : "fail")} aria-pressed={value === "fail"} className={`h-10 min-w-20 rounded-lg border text-sm font-black transition ${value === "fail" ? "border-red-600 bg-red-600 text-white" : "border-red-200 bg-white text-red-700 hover:bg-red-50"}`}>לא תקין</button></div>;
}

export function ShelfProductInspectionForm({ binderDirectory, catalogItems }: { binderDirectory: SupplierBinderDirectoryEntry[]; catalogItems: CatalogItem[] }) {
  const [form, setForm] = useState(() => createEmptyShelfInspection(todayInIsrael()));
  const [downloading, setDownloading] = useState(false);
  const productsRef = useRef<HTMLDivElement>(null);
  const update = <K extends keyof ShelfProductInspectionPayload>(key: K, value: ShelfProductInspectionPayload[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleDocument = (key: keyof ShelfProductInspectionPayload["documents"]) => setForm((current) => ({ ...current, documents: { ...current.documents, [key]: !current.documents[key] } }));

  useEffect(() => {
    const archived = window.sessionStorage.getItem(SHELF_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY);
    if (!archived) return;
    window.sessionStorage.removeItem(SHELF_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY);
    const timer = window.setTimeout(() => {
      try {
        setForm(normalizeShelfInspection(JSON.parse(archived) as ShelfProductInspectionPayload));
        toast.success("הטופס נטען מהמאגר וניתן לעריכה");
      } catch {
        toast.error("לא ניתן לטעון את הטופס מהמאגר");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateInspection(index: number, patch: Partial<ShelfProductInspectionPayload["inspections"][number]>) {
    setForm((current) => ({ ...current, inspections: current.inspections.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  }

  function focusProduct(row: number, column: number) {
    window.requestAnimationFrame(() => {
      const input = productsRef.current?.querySelector<HTMLInputElement>(`[data-product-row="${row}"][data-product-column="${column}"]`);
      input?.focus();
      input?.select();
    });
  }

  function updateProduct(index: number, key: "productName" | "catalogNumber" | "quantity", value: string, selected?: CatalogItem) {
    setForm((current) => {
      const known = selected ?? (key !== "quantity" ? resolveCatalogItem(catalogItems, key === "productName" ? "partName" : "catalogNumber", value) : null);
      const products = current.products.map((product, productIndex) => productIndex === index ? { ...product, [key]: value, ...(known ? { productName: known.partName, catalogNumber: known.catalogNumber } : {}) } : product);
      return { ...current, products, productName: products[0].productName, catalogNumber: products[0].catalogNumber, quantity: products[0].quantity };
    });
  }

  function addProduct(focusColumn = 0) {
    setForm((current) => ({ ...current, products: [...current.products, { productName: "", catalogNumber: "", quantity: "" }] }));
    focusProduct(form.products.length, focusColumn);
  }

  function removeProduct(index: number) {
    setForm((current) => {
      const products = current.products.length === 1 ? [{ productName: "", catalogNumber: "", quantity: "" }] : current.products.filter((_, productIndex) => productIndex !== index);
      return { ...current, products, productName: products[0].productName, catalogNumber: products[0].catalogNumber, quantity: products[0].quantity };
    });
  }

  function navigateProduct(event: React.KeyboardEvent<HTMLInputElement>, row: number, column: number) {
    let targetRow = row;
    let targetColumn = column;
    if (event.key === "Enter" || event.key === "ArrowDown") targetRow += 1;
    else if (event.key === "ArrowUp") targetRow -= 1;
    else if (event.key === "ArrowLeft") targetColumn += 1;
    else if (event.key === "ArrowRight") targetColumn -= 1;
    else return;
    if (targetColumn < 0 || targetColumn > 2 || targetRow < 0) return;
    event.preventDefault();
    if (targetRow >= form.products.length) {
      setForm((current) => ({ ...current, products: [...current.products, { productName: "", catalogNumber: "", quantity: "" }] }));
    }
    focusProduct(targetRow, targetColumn);
  }

  function clearForm() {
    if (!window.confirm("לנקות את כל השדות ולהתחיל טופס חדש?")) return;
    setForm(createEmptyShelfInspection(todayInIsrael()));
  }

  async function downloadForm() {
    setDownloading(true);
    try {
      const response = await fetch("/api/forms/shelf-product-inspection/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "לא ניתן ליצור את הקובץ");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildQualityFormDownloadName(form.catalogNumber, "docx");
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("הטופס נוצר והורד בהצלחה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "לא ניתן ליצור את הקובץ");
    } finally {
      setDownloading(false);
    }
  }

  return <div data-shelf-form className="space-y-5" dir="rtl"><header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><Link href="/forms" className="inline-flex items-center gap-1 text-sm font-extrabold text-slate-500 hover:text-blue-700"><ArrowRight className="h-4 w-4" />חזרה למילוי טפסים</Link><h1 className="mt-2 text-2xl font-black sm:text-3xl">טופס ביקורת קבלה למוצר מדף</h1><p className="mt-1 text-sm text-slate-500">מילוי דיגיטלי והורדת מסמך Word במבנה הטופס המקורי.</p></div><div className="flex gap-2"><button type="button" onClick={clearForm} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" />ניקוי</button><button type="button" disabled={downloading} onClick={downloadForm} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}הורדת הטופס</button></div></header>

    <SupplierBinderNotice supplierName={form.supplierName} directory={binderDirectory} />

    <main className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-8 lg:p-12"><div className="relative mb-7 min-h-24"><Image src="/caeli-logo.png" alt="CAELI" width={150} height={105} className="absolute left-0 top-0 h-auto w-24 object-contain sm:w-32" priority /><h2 className="px-24 pt-6 text-center text-xl font-black underline sm:text-3xl">טופס ביקורת קבלה למוצר מדף</h2></div>
      <section className="overflow-hidden border-2 border-slate-900"><div className="overflow-x-auto border-b border-slate-900"><div ref={productsRef} className="min-w-[620px]"><div className="grid grid-cols-[48px_minmax(180px,1.5fr)_minmax(140px,1fr)_minmax(90px,0.6fr)_48px] bg-slate-100 text-sm font-black"><span className="p-3 text-center">#</span><span className="border-r border-slate-300 p-3">שם מוצר מתקבל</span><span className="border-r border-slate-300 p-3">מק״ט</span><span className="border-r border-slate-300 p-3">כמות</span><span className="border-r border-slate-300" /></div>{form.products.map((product, row) => <div key={row} className="grid grid-cols-[48px_minmax(180px,1.5fr)_minmax(140px,1fr)_minmax(90px,0.6fr)_48px] border-t border-slate-300 first:border-t-0"><span className="flex items-center justify-center bg-blue-50 text-sm font-black text-blue-800">{row + 1}</span>{([['productName', product.productName, 'text'], ['catalogNumber', product.catalogNumber, 'text'], ['quantity', product.quantity, 'number']] as const).map(([key, value, type], column) => <span key={key} className="border-r border-slate-300 p-2">{key !== "quantity" ? <CatalogInput data-product-row={row} data-product-column={column} aria-label={key === "productName" ? "שם מוצר" : "מק״ט"} field={key === "productName" ? "partName" : "catalogNumber"} value={value} items={catalogItems} onInputValue={value => updateProduct(row, key, value)} onPick={item => updateProduct(row, key, key === "productName" ? item.partName : item.catalogNumber, item)} onKeyDown={event => navigateProduct(event, row, column)} /> : <input data-product-row={row} data-product-column={column} type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => updateProduct(row, key, event.target.value)} onKeyDown={(event) => navigateProduct(event, row, column)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />}</span>)}<span className="flex items-center justify-center border-r border-slate-300"><button type="button" onClick={() => removeProduct(row)} aria-label={`הסרת פריט ${row + 1}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></span></div>)}</div></div><div className="border-b border-slate-300 p-2"><button type="button" onClick={() => addProduct()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-extrabold text-blue-800 hover:bg-blue-100"><Plus className="h-4 w-4" />הוספת מוצר</button><span className="mr-3 text-xs font-semibold text-slate-500">Enter או חץ למטה מוסיפים ומקדמים לשורה הבאה</span></div><Field label="שם הספק" value={form.supplierName} onChange={(value) => update("supplierName", value)} /><Field label="מספר אצווה" value={form.batchNumber} onChange={(value) => update("batchNumber", value)} /><Field label="תאריך קליטה" type="date" value={form.receiptDate} onChange={(value) => update("receiptDate", value)} /><div className="grid min-h-16 grid-cols-[minmax(125px,0.8fr)_minmax(0,1.7fr)]"><span className="flex items-center justify-center border-l border-slate-300 bg-slate-50 px-3 text-sm font-black">מסמכים נלווים</span><div className="flex flex-wrap items-center gap-2 p-2">{([['coc', 'COC'], ['coa', 'COA'], ['cot', 'COT'], ['other', 'אחר']] as const).map(([key, label]) => <label key={key} className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-black ${form.documents[key] ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200"}`}><input type="checkbox" checked={form.documents[key]} onChange={() => toggleDocument(key)} className="h-4 w-4 accent-blue-600" />{label}</label>)}{form.documents.other ? <input data-shelf-entry value={form.otherDocument} onChange={(event) => update("otherDocument", event.target.value)} onKeyDown={focusShelfEntry} placeholder="שם המסמך האחר" className="h-10 min-w-44 flex-1 rounded-lg border border-slate-300 px-3 text-sm font-bold outline-none focus:border-blue-500" /> : null}</div></div></section>

      <section className="mt-7 overflow-x-auto"><table className="w-full min-w-[720px] border-collapse border-2 border-slate-900 text-sm"><thead><tr className="bg-slate-100"><th className="border border-slate-900 p-3 text-right">פרמטר לבדיקה</th><th className="w-40 border border-slate-900 p-3">תוצאה</th><th className="w-[32%] border border-slate-900 p-3">הערות</th></tr></thead><tbody>{SHELF_INSPECTION_ITEMS.map((item, index) => <tr key={item}><th className="border border-slate-900 p-3 text-right font-bold">{item}</th><td className="border border-slate-900 p-2"><ResultButtons value={form.inspections[index].result} onChange={(result) => updateInspection(index, { result })} /></td><td className="border border-slate-900 p-2"><input data-shelf-entry value={form.inspections[index].comment} onChange={(event) => updateInspection(index, { comment: event.target.value })} onKeyDown={focusShelfEntry} aria-label={`הערה עבור ${item}`} className="h-10 w-full rounded-lg border border-slate-300 px-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></td></tr>)}</tbody></table></section>

      <ol className="mt-4 list-decimal space-y-1 pr-6 text-sm font-semibold text-slate-700"><li>סמן תקין / לא תקין בהתאם לממצאים.</li><li>יש לצרף טופס זה למסמכי הקליטה של החומר.</li></ol>
      <section className="mt-7 grid overflow-hidden border-2 border-slate-900 md:grid-cols-[180px_1fr]"><h3 className="flex items-center justify-center border-b border-slate-900 bg-slate-50 p-3 font-black md:border-b-0 md:border-l">אישור לשימוש</h3><div className="flex flex-wrap gap-2 p-3">{([['approved', 'מאושר לשימוש'], ['rejected', 'לא מאושר לשימוש'], ['conditional', 'מאושר מותנה (לפרטים בהערות)']] as const).map(([value, label]) => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-black ${form.usageApproval === value ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200"}`}><input type="radio" name="usage-approval" checked={form.usageApproval === value} onChange={() => update("usageApproval", value)} className="h-4 w-4 accent-blue-600" />{label}</label>)}</div></section>
      <label className="mt-7 block text-base font-black">הערות<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>

      <section className="mt-10 overflow-x-auto"><table className="w-full min-w-[650px] border-collapse border-2 border-slate-900 text-sm"><tbody><tr><th colSpan={4} className="border border-slate-900 bg-slate-100 p-3 text-right text-base">נבדק על ידי</th></tr><tr><th className="border border-slate-900 p-2"><label className="flex items-center gap-2 font-bold">שם<select data-shelf-entry value={form.inspectorName} onChange={(event) => update("inspectorName", event.target.value as ShelfProductInspectionPayload["inspectorName"])} onKeyDown={focusShelfEntry} className="h-10 min-w-40 flex-1 rounded-lg border border-slate-300 bg-white px-2"><option value="Eden Aharon">Eden Aharon</option><option value="Sergey Dror">Sergey Dror</option></select></label></th><th className="border border-slate-900 p-3">תפקיד: QC</th><td className="border border-slate-900 p-2"><label className="flex items-center gap-2 font-bold">תאריך<input data-shelf-entry type="date" value={form.inspectorDate} onChange={(event) => update("inspectorDate", event.target.value)} onKeyDown={focusShelfEntry} className="h-10 flex-1 rounded-lg border border-slate-300 px-2" /></label></td><td className="border border-slate-900 p-3 text-center font-bold text-slate-500">חתימת {form.inspectorName} תצורף אוטומטית</td></tr><tr><th colSpan={4} className="border border-slate-900 bg-slate-100 p-3 text-right text-base">אושר על ידי</th></tr><tr><th className="border border-slate-900 p-3">שם: עוזי ברזילי</th><th className="border border-slate-900 p-3">תפקיד: משנה למנכ״ל</th><td className="border border-slate-900 p-2"><label className="flex items-center gap-2 font-bold">תאריך<input data-shelf-entry type="date" value={form.approverDate} onChange={(event) => update("approverDate", event.target.value)} onKeyDown={focusShelfEntry} className="h-10 flex-1 rounded-lg border border-slate-300 px-2" /></label></td><td className="border border-slate-900 p-3 text-center font-bold text-slate-500">חתימה מצורפת אוטומטית</td></tr></tbody></table></section>
    </main></div>;
}
