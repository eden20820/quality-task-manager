import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2, Clock3, LockKeyhole, MailCheck } from "lucide-react";

import { CompanyOnboardingWizard } from "@/components/onboarding/company-onboarding-wizard";

export const metadata: Metadata = {
  title: "אפיון מערכת ניהול איכות | Caeli Quality Hub",
  description: "שאלון אפיון מקצועי להקמת מערכת ניהול איכות המותאמת לתהליכים, לתקנים ולצוות שלכם.",
  robots: { index: false, follow: false },
};

export default function CompanyOnboardingPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top_right,#dbeafe_0,transparent_34%),linear-gradient(to_bottom,#f8fafc,#eef2f7)] text-slate-950">
      <header className="border-b border-white/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3"><Image src="/caeli-logo.png" alt="Caeli" width={88} height={50} priority className="h-auto w-[76px] sm:w-[88px]" /><span className="hidden h-8 w-px bg-slate-200 sm:block" /><div className="hidden sm:block"><strong className="block text-sm text-slate-950">Quality Hub</strong><span className="text-xs text-slate-500">אפיון מערכת חכם</span></div></div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><LockKeyhole className="size-3.5" />טופס מאובטח</div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:pb-24">
        <div className="grid items-start gap-9 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-14">
          <div className="min-w-0 order-2 lg:order-1"><CompanyOnboardingWizard /></div>
          <aside className="order-1 lg:sticky lg:top-8 lg:order-2">
            <p className="text-xs font-extrabold tracking-[0.2em] text-blue-600">אפיון לפני הקמה</p>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-[2.65rem]">מערכת איכות שמתאימה לארגון שלכם</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">השאלון מרכז את המידע הנדרש לתכנון מערכת מדויקת — מהתקנים והתהליכים ועד הרשאות, התראות והעברת נתונים.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[{ icon: Clock3, title: "כ-12 דקות", text: "אפשר לעצור ולהמשיך מאותו מכשיר" }, { icon: CheckCircle2, title: "שאלות מותאמות", text: "יוצגו רק פרטים שרלוונטיים לכם" }, { icon: MailCheck, title: "אישור מסודר", text: "בסיום תקבלו מספר פנייה בדוא״ל" }].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span><div><strong className="text-sm text-slate-950">{title}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>)}
            </div>
            <p className="mt-6 text-xs leading-5 text-slate-500">לא חייבים לדעת את כל התשובות. ניתן לבחור &quot;לא ידוע&quot; ולחדד יחד בשיחת האפיון.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
