import type { Metadata } from "next";
import { CheckCircle2, Clock3, LockKeyhole, MailCheck, Sparkles } from "lucide-react";

import { CompanyOnboardingWizard } from "@/components/onboarding/company-onboarding-wizard";

export const metadata: Metadata = {
  title: "אפיון מערכת ניהול איכות",
  description: "שאלון אפיון מקצועי להקמת מערכת ניהול איכות המותאמת לתהליכים, לתקנים ולצוות שלכם.",
  robots: { index: false, follow: false },
};

const highlights = [
  { icon: Clock3, title: "כ־12 דקות", text: "הטיוטה נשמרת אוטומטית" },
  { icon: CheckCircle2, title: "שאלות מותאמות", text: "רק מה שרלוונטי לארגון" },
  { icon: MailCheck, title: "סיכום מסודר", text: "אישור ומספר פנייה בדוא״ל" },
];

export default function CompanyOnboardingPage() {
  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f1f5f9_48%,#eef2f7_100%)] text-slate-950">
      <div aria-hidden="true" className="onboarding-orb onboarding-orb-one" />
      <div aria-hidden="true" className="onboarding-orb onboarding-orb-two" />

      <header className="relative z-10 border-b border-white/80 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <strong className="block text-sm font-black text-slate-950 sm:text-base">אפיון מערכת ניהול איכות</strong>
            <span className="text-xs text-slate-500">תכנון מדויק מתחיל באפיון נכון</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm">
            <LockKeyhole className="size-3.5" />טופס מאובטח
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-9 sm:px-8 sm:pt-12 lg:pb-24">
        <div className="onboarding-hero-enter mx-auto max-w-3xl text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-4 py-2 text-xs font-extrabold text-blue-700 shadow-sm">
            <Sparkles className="size-4" />אפיון חכם לפני הקמה
          </div>
          <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
            בונים מערכת איכות שמתאימה בדיוק לארגון שלכם
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            השאלון מרכז את כל המידע הדרוש לתכנון המערכת — מהתקנים והתהליכים ועד הרשאות, התראות והעברת נתונים.
          </p>
        </div>

        <div className="onboarding-features-enter mx-auto mt-7 grid max-w-4xl gap-3 sm:grid-cols-3">
          {highlights.map(({ icon: Icon, title, text }, index) => (
            <div key={title} style={{ animationDelay: `${120 + index * 90}ms` }} className="onboarding-feature-card flex items-center gap-3 rounded-2xl border border-white/90 bg-white/75 p-4 shadow-[0_10px_32px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100"><Icon className="size-5" /></span>
              <div className="text-right"><strong className="block text-sm text-slate-950">{title}</strong><p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p></div>
            </div>
          ))}
        </div>

        <div className="onboarding-wizard-enter mt-8 sm:mt-10">
          <CompanyOnboardingWizard />
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">לא חייבים לדעת את כל התשובות. אפשר לבחור &quot;לא ידוע&quot; ולחדד יחד בהמשך.</p>
      </section>
    </main>
  );
}
