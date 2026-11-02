import Link from "next/link";
import { ArrowLeft, ClipboardCheck, PackageCheck } from "lucide-react";

import { FormsNavigation } from "@/components/quality-forms/forms-navigation";

const forms = [
  { href: "/forms/rir", title: "דוח ביקורת קבלה", subtitle: "Receiving Inspection Report (RIR)", description: "קליטת פרטי ספק ופריט, הגדרת מאפייני בדיקה, הזנת מדידות, בדיקות Pass/Fail וסיכום תוצאות אוטומטי.", icon: ClipboardCheck, iconClass: "bg-blue-50 text-blue-700", hoverClass: "group-hover:bg-blue-700" },
  { href: "/forms/shelf-product-inspection", title: "ביקורת קבלה למוצר מדף", subtitle: "נספח 8.4.2.1.0", description: "פרטי מוצר וספק, מסמכים נלווים, ארבע בדיקות קבלה, אישור שימוש וחתימות קבועות.", icon: PackageCheck, iconClass: "bg-violet-50 text-violet-700", hoverClass: "group-hover:bg-violet-700" },
];

export default function FormsPage() {
  return <div className="space-y-6"><header><h1 className="text-3xl font-black tracking-tight sm:text-4xl">מילוי טפסים</h1></header><FormsNavigation active="fill" /><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{forms.map((form) => { const Icon = form.icon; return <article key={form.href} className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"><div className="flex items-start justify-between"><span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${form.iconClass}`}><Icon className="h-6 w-6" /></span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">זמין למילוי</span></div><div className="mt-5 flex-1"><h2 className="text-xl font-black">{form.title}</h2><p className="mt-1 text-sm font-bold text-slate-500">{form.subtitle}</p><p className="mt-4 text-sm leading-6 text-slate-600">{form.description}</p></div><Link href={form.href} className={`mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white transition ${form.hoverClass}`}>פתיחת הטופס<ArrowLeft className="h-4 w-4" /></Link></article>; })}</section></div>;
}
