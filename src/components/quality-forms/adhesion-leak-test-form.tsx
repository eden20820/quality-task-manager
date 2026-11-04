"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Download, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { SignaturePad } from "@/components/quality-forms/signature-pad";
import { buildQualityFormDownloadName } from "@/lib/quality-forms/form-archive";
import { createEmptyAdhesionLeakTest, type AdhesionLeakTestPayload, type FinalDecision, type LeakTestMethod, type YesNo } from "@/lib/quality-forms/adhesion-leak-test";

function todayInIsrael() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const inputClass = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "date" | "number" }) {
  return <label className="grid min-h-14 grid-cols-[minmax(135px,0.9fr)_minmax(0,1.7fr)] border-b border-slate-300 last:border-b-0"><span className="flex items-center justify-center border-l border-slate-300 bg-slate-50 px-3 text-center text-sm font-black">{label}</span><span className="flex items-center p-2"><input type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} /></span></label>;
}

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: Array<[T, string]> }) {
  return <div className="flex flex-wrap gap-2">{options.map(([option, label]) => <button key={option} type="button" onClick={() => onChange(value === option ? "" as T : option)} className={`h-10 rounded-lg border px-4 text-sm font-black transition ${value === option ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}</div>;
}

function YesNoChoice({ value, onChange }: { value: YesNo; onChange: (value: YesNo) => void }) {
  return <Choice value={value} onChange={onChange} options={[["yes", "כן"], ["no", "לא"]]} />;
}

export function AdhesionLeakTestForm() {
  const [form, setForm] = useState(() => createEmptyAdhesionLeakTest(todayInIsrael()));
  const [busy, setBusy] = useState<"download" | "save" | null>(null);
  const update = <K extends keyof AdhesionLeakTestPayload>(key: K, value: AdhesionLeakTestPayload[K]) => setForm((current) => ({ ...current, [key]: value }));

  function clearForm() {
    if (!window.confirm("לנקות את כל השדות ולהתחיל טופס חדש?")) return;
    setForm(createEmptyAdhesionLeakTest(todayInIsrael()));
  }

  async function downloadForm() {
    setBusy("download");
    try {
      const response = await fetch("/api/forms/adhesion-leak-test/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "לא ניתן ליצור את הקובץ");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildQualityFormDownloadName(form.testedProduct || "בדיקת-אטימות", "pdf");
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("טופס בדיקת האטימות הורד בהצלחה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "לא ניתן ליצור את הקובץ");
    } finally {
      setBusy(null);
    }
  }

  async function saveForm() {
    setBusy("save");
    try {
      const response = await fetch("/api/forms/adhesion-leak-test/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json().catch(() => null) as { error?: string; emailStatus?: "sent" | "partial" | "failed" } | null;
      if (!response.ok) throw new Error(result?.error ?? "לא ניתן לשמור את הטופס");
      if (result?.emailStatus === "sent") toast.success("הטופס נשמר ונשלחה התראה לעדן ולסרגיי");
      else toast.warning("הטופס נשמר, אך שליחת אחת מהתראות המייל לא הושלמה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "לא ניתן לשמור את הטופס");
    } finally {
      setBusy(null);
    }
  }

  return <div className="space-y-5" dir="rtl"><header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><Link href="/forms" className="inline-flex items-center gap-1 text-sm font-extrabold text-slate-500 hover:text-blue-700"><ArrowRight className="h-4 w-4" />חזרה למילוי טפסים</Link><h1 className="mt-2 text-2xl font-black sm:text-3xl">טופס בדיקת אטימות – הדבקה</h1><p className="mt-1 text-sm text-slate-500">נספח 8.4.2.4.0 · מילוי דיגיטלי, חתימות בעכבר ושמירה למאגר.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={clearForm} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold"><RotateCcw className="h-4 w-4" />ניקוי</button><button type="button" disabled={Boolean(busy)} onClick={downloadForm} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-900 bg-white px-4 text-sm font-extrabold disabled:opacity-50">{busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}הורדה</button><button type="button" disabled={Boolean(busy)} onClick={saveForm} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50">{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}שמירה ושליחת התראה</button></div></header>

    <main className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-8 lg:p-10"><div className="relative mb-6 min-h-24"><Image src="/caeli-logo.png" alt="CAELI" width={150} height={105} className="absolute left-0 top-0 h-auto w-24 object-contain sm:w-32" priority /><h2 className="px-24 pt-7 text-center text-xl font-black underline sm:text-3xl">טופס בדיקת אטימות – הדבקה</h2></div>

      <section className="overflow-hidden border-2 border-slate-900"><Field label="תאריך" type="date" value={form.testDate} onChange={(value) => update("testDate", value)} /><Field label="שם הבודק" value={form.testerName} onChange={(value) => update("testerName", value)} /><Field label="מיקום הבדיקה" value={form.testLocation} onChange={(value) => update("testLocation", value)} /><Field label="תיאור הפעולה" value={form.operationDescription} onChange={(value) => update("operationDescription", value)} /><Field label="המוצר הנבדק" value={form.testedProduct} onChange={(value) => update("testedProduct", value)} /><Field label="חומר המוצר המודבק" value={form.bondedProductMaterial} onChange={(value) => update("bondedProductMaterial", value)} /><Field label="אזור הדבקה" value={form.bondingArea} onChange={(value) => update("bondingArea", value)} /><Field label="חומר המוצר הנדבק" value={form.adheringProductMaterial} onChange={(value) => update("adheringProductMaterial", value)} /><Field label="שטח / אורך תפר ההדבקה" value={form.seamAreaOrLength} onChange={(value) => update("seamAreaOrLength", value)} /><Field label="כמות" type="number" value={form.quantity} onChange={(value) => update("quantity", value)} /></section>

      <section className="mt-6 overflow-hidden border-2 border-slate-900"><h3 className="border-b border-slate-900 bg-slate-100 px-4 py-3 text-lg font-black">פרטי הדבק</h3><Field label="סוג הדבק" value={form.adhesiveType} onChange={(value) => update("adhesiveType", value)} /><Field label="יצרן ודגם" value={form.adhesiveManufacturerModel} onChange={(value) => update("adhesiveManufacturerModel", value)} /><Field label="תאריך תפוגה" type="date" value={form.adhesiveExpiryDate} onChange={(value) => update("adhesiveExpiryDate", value)} /><div className="grid min-h-14 grid-cols-[minmax(135px,0.9fr)_minmax(0,1.7fr)] border-b border-slate-300"><span className="flex items-center justify-center border-l border-slate-300 bg-slate-50 px-3 text-sm font-black">שיטת הקשיה</span><div className="p-2"><Choice value={form.curingMethod} onChange={(value) => update("curingMethod", value)} options={[["epoxy", "אפוקסי"], ["uv", "UV"]]} /></div></div><Field label="זמן חשיפה" value={form.exposureTime} onChange={(value) => update("exposureTime", value)} /><Field label="זמן המתנה לפני בדיקה" value={form.waitingTime} onChange={(value) => update("waitingTime", value)} /></section>

      <section className="mt-6 overflow-hidden border-2 border-slate-900"><h3 className="border-b border-slate-900 bg-slate-100 px-4 py-3 text-lg font-black">תנאי סביבה</h3><Field label="טמפרטורה" value={form.temperature} onChange={(value) => update("temperature", value)} /><Field label="לחות" value={form.humidity} onChange={(value) => update("humidity", value)} /><div className="grid min-h-14 grid-cols-[minmax(135px,0.9fr)_minmax(0,1.7fr)] border-b border-slate-300"><span className="flex items-center justify-center border-l border-slate-300 bg-slate-50 px-3 text-sm font-black">עבודה תחת מנדף</span><div className="p-2"><YesNoChoice value={form.underHood} onChange={(value) => update("underHood", value)} /></div></div><Field label="הערות" value={form.environmentNotes} onChange={(value) => update("environmentNotes", value)} /></section>

      <section className="mt-6 overflow-hidden border-2 border-slate-900"><h3 className="border-b border-slate-900 bg-slate-100 px-4 py-3 text-lg font-black">שיטת בדיקת האטימות</h3><div className="p-3"><Choice<LeakTestMethod> value={form.testMethod} onChange={(value) => update("testMethod", value)} options={[["air-pressure", "בדיקת לחץ אוויר"], ["vacuum", "בדיקת ואקום"], ["bubbles", "בדיקת בועות (מים/סבון)"], ["dye-penetration", "בדיקת חדירות צבע"]]} /></div></section>

      <section className="mt-6 overflow-hidden border-2 border-slate-900"><h3 className="border-b border-slate-900 bg-slate-100 px-4 py-3 text-lg font-black">בדיקה ויזואלית</h3>{([["סדקים", "cracks"], ["בועות", "bubbles"], ["היפרדות חומר", "materialSeparation"]] as const).map(([label, key]) => <div key={key} className="grid min-h-14 grid-cols-[minmax(135px,0.9fr)_minmax(0,1.7fr)] border-b border-slate-300 last:border-b-0"><span className="flex items-center justify-center border-l border-slate-300 bg-slate-50 px-3 text-sm font-black">{label}</span><div className="p-2"><YesNoChoice value={form[key]} onChange={(value) => update(key, value)} /></div></div>)}</section>

      <section className="mt-6 overflow-hidden border-2 border-slate-900"><h3 className="border-b border-slate-900 bg-slate-100 px-4 py-3 text-lg font-black">תוצאות בדיקה</h3><div className="grid min-h-14 grid-cols-[minmax(135px,0.9fr)_minmax(0,1.7fr)] border-b border-slate-300"><span className="flex items-center justify-center border-l border-slate-300 bg-slate-50 px-3 text-sm font-black">נצפתה דליפה</span><div className="p-2"><YesNoChoice value={form.leakObserved} onChange={(value) => update("leakObserved", value)} /></div></div><Field label="מיקום הדליפה" value={form.leakLocation} onChange={(value) => update("leakLocation", value)} /><Field label="ממצאים" value={form.findings} onChange={(value) => update("findings", value)} /></section>

      <section className="mt-6 overflow-hidden border-2 border-slate-900"><h3 className="border-b border-slate-900 bg-slate-100 px-4 py-3 text-lg font-black">סיכום והחלטות</h3><div className="p-3"><Choice<FinalDecision> value={form.decision} onChange={(value) => update("decision", value)} options={[["pass", "תקין"], ["fail", "לא תקין"], ["repair", "נדרש תיקון ובדיקה חוזרת"]]} /></div></section>

      <section className="mt-8 overflow-hidden border-2 border-slate-900"><h3 className="border-b border-slate-900 bg-slate-100 px-4 py-3 text-center text-lg font-black">חתימות</h3><div className="grid gap-5 p-4 lg:grid-cols-2"><div className="space-y-3"><h4 className="font-black">נבדק על ידי</h4><Field label="שם" value={form.checkedByName} onChange={(value) => update("checkedByName", value)} /><Field label="תאריך" type="date" value={form.checkedByDate} onChange={(value) => update("checkedByDate", value)} /><SignaturePad label="חתימת הבודק" value={form.checkedBySignature} onChange={(value) => update("checkedBySignature", value)} /></div><div className="space-y-3"><h4 className="font-black">אושר על ידי</h4><Field label="שם" value={form.approvedByName} onChange={(value) => update("approvedByName", value)} /><Field label="תאריך" type="date" value={form.approvedByDate} onChange={(value) => update("approvedByDate", value)} /><SignaturePad label="חתימת המאשר" value={form.approvedBySignature} onChange={(value) => update("approvedBySignature", value)} /></div></div></section>
      <p className="mt-5 text-left text-sm font-black" dir="rtl">נספח 8.4.2.4.0</p>
    </main></div>;
}
