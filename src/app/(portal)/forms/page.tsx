import Link from "next/link";
import { ClipboardCheck, FilePenLine, FlaskConical, PackageCheck, ShieldCheck } from "lucide-react";

import { FormsNavigation } from "@/components/quality-forms/forms-navigation";

const forms = [
  { href: "/forms/eco", title: "טופס ECO", icon: FilePenLine, iconClass: "bg-indigo-50 text-indigo-700" },
  { href: "/forms/rir", title: "דוח ביקורת קבלה (RIR)", icon: ClipboardCheck, iconClass: "bg-blue-50 text-blue-700" },
  { href: "/forms/shelf-product-inspection", title: "ביקורת קבלה למוצר מדף", icon: PackageCheck, iconClass: "bg-violet-50 text-violet-700" },
  { href: "/forms/adhesion-leak-test", title: "בדיקת אטימות – הדבקה", icon: ShieldCheck, iconClass: "bg-cyan-50 text-cyan-700" },
  { href: "/forms/development-inspection", title: "ביקורת קבלה – מוצרי פיתוח", icon: FlaskConical, iconClass: "bg-amber-50 text-amber-700" },
];

export default function FormsPage() {
  return (
    <div dir="rtl" className="space-y-5">
      <header>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">מילוי טפסים</h1>
      </header>
      <FormsNavigation active="fill" />
      <section aria-label="טפסים למילוי" className="mx-auto flex max-w-[54rem] flex-wrap justify-center gap-3">
        {forms.map(({ href, title, icon: Icon, iconClass }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[4.25rem] w-full max-w-[17.5rem] items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-950 transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconClass}`}>
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-center text-base font-extrabold leading-snug">{title}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
