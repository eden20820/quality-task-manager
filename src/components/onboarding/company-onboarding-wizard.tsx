"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { submitCompanyOnboarding } from "@/app/company-onboarding/actions";
import {
  CURRENT_TOOLS,
  EMPTY_INTAKE,
  INDUSTRIES,
  INTEGRATIONS,
  INTAKE_FIELD_LABELS,
  LANGUAGES,
  MODULES,
  sanitizeIntake,
  STANDARDS,
  USER_ROLES,
  validateIntake,
  type IntakeAnswers,
} from "@/lib/company-onboarding";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "qms-company-onboarding-draft-v1";

const STEPS = [
  { title: "החברה", subtitle: "היכרות ופרטי קשר", icon: Building2 },
  { title: "תקינה", subtitle: "תקנים ורגולציה", icon: ShieldCheck },
  { title: "מצב קיים", subtitle: "כלים ואתגרים", icon: ClipboardCheck },
  { title: "היקף", subtitle: "מודולים ומידע", icon: FileCheck2 },
  { title: "תהליכים", subtitle: "אישורים ובקרות", icon: Sparkles },
  { title: "משתמשים", subtitle: "תפקידים והרשאות", icon: Users },
  { title: "חיבורים", subtitle: "אינטגרציות והתראות", icon: Cloud },
  { title: "סיכום", subtitle: "השקה ואישור", icon: CheckCircle2 },
] as const;

const STEP_FIELDS: Array<Array<keyof IntakeAnswers>> = [
  ["companyName", "industry", "industryOther", "employeeRange", "contactName", "contactEmail", "contactPhone"],
  ["standards", "otherStandard", "certificationStage"],
  ["currentTools", "painPoints", "dataMigration", "migrationScope"],
  ["modules"],
  ["electronicSignatures"],
  ["userCount", "userRoles", "ssoRequired", "ssoProvider", "languages"],
  ["integrations", "otherIntegration", "notifications"],
  ["goLiveTarget", "implementationPriority", "successDefinition"],
];

type FieldErrorMap = Partial<Record<keyof IntakeAnswers, string>>;

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-bold text-slate-800">
          {label}{required && <span className="mr-1 text-blue-600">*</span>}
        </label>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs font-semibold text-red-600" role="alert">{error}</p>}
    </div>
  );
}

const inputClass = "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const textareaClass = "min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-base leading-7 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

function ChoiceGroup({ value, onChange, options, columns = 3 }: { value: string; onChange: (value: string) => void; options: readonly string[]; columns?: 2 | 3 | 4 }) {
  return (
    <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3", columns === 4 && "sm:grid-cols-2 xl:grid-cols-4")}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <button key={option} type="button" onClick={() => onChange(option)} aria-pressed={selected}
            className={cn("min-h-12 rounded-xl border px-4 py-3 text-right text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100", selected ? "border-blue-600 bg-blue-50 text-blue-950 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")}>
            <span className="flex items-center gap-2"><span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300")}>{selected && <Check className="size-3.5" />}</span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}

function MultiChoice({ values, onChange, options }: { values: string[]; onChange: (values: string[]) => void; options: readonly string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {options.map((option) => {
        const selected = values.includes(option);
        return (
          <button key={option} type="button" onClick={() => onChange(selected ? values.filter((item) => item !== option) : [...values, option])} aria-pressed={selected}
            className={cn("min-h-12 rounded-xl border px-4 py-3 text-right text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100", selected ? "border-blue-600 bg-blue-50 text-blue-950 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")}>
            <span className="flex items-center gap-2"><span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300")}>{selected && <Check className="size-3.5" />}</span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}

function SectionIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mb-7"><p className="mb-2 text-xs font-extrabold tracking-[0.18em] text-blue-600">{eyebrow}</p><h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p></div>;
}

function Summary({ answers }: { answers: IntakeAnswers }) {
  const groups: Array<{ title: string; keys: Array<keyof IntakeAnswers> }> = [
    { title: "חברה ואיש קשר", keys: ["companyName", "legalName", "industry", "industryOther", "website", "employeeRange", "siteCount", "locations", "contactName", "contactRole", "contactEmail", "contactPhone"] },
    { title: "תקינה ומצב קיים", keys: ["standards", "otherStandard", "certificationStage", "certificationDeadline", "regulatoryNotes", "currentTools", "currentSystemDetails", "painPoints", "dataMigration", "migrationScope"] },
    { title: "היקף, תהליכים ומשתמשים", keys: ["modules", "otherModules", "modulePriorities", "estimatedRecords", "workflowDescription", "approvalRequirements", "numberingRequirements", "electronicSignatures", "attachmentRequirements", "userCount", "userRoles", "permissionNotes", "ssoRequired", "ssoProvider", "languages"] },
    { title: "יישום וחיבורים", keys: ["integrations", "otherIntegration", "notifications", "reminderRules", "branding", "preferredDomain", "goLiveTarget", "implementationPriority", "successDefinition", "additionalNotes"] },
  ];
  return <div className="grid gap-4 lg:grid-cols-2">{groups.map((group) => <section key={group.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"><h3 className="mb-4 font-black text-slate-950">{group.title}</h3><dl className="space-y-3">{group.keys.map((key) => { const value = answers[key]; const text = Array.isArray(value) ? value.join(", ") : value; if (!text) return null; return <div key={key} className="grid gap-1 sm:grid-cols-[8rem_1fr]"><dt className="text-xs font-bold text-slate-500">{INTAKE_FIELD_LABELS[key]}</dt><dd className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-800">{text}</dd></div>; })}</dl></section>)}</div>;
}

export function CompanyOnboardingWizard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(EMPTY_INTAKE);
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ referenceCode: string } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const startedAt = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      startedAt.current = Date.now();
      try {
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) setAnswers(sanitizeIntake(JSON.parse(draft)));
      } catch { localStorage.removeItem(DRAFT_KEY); }
      setDraftLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!draftLoaded || result) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
      setSavedAt(new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [answers, draftLoaded, result]);

  const completion = Math.round(((step + 1) / STEPS.length) * 100);
  const allErrors = useMemo(() => validateIntake(answers), [answers]);

  function update<K extends keyof IntakeAnswers>(key: K, value: IntakeAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function scrollToTop() {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function next() {
    const currentErrors: FieldErrorMap = {};
    for (const key of STEP_FIELDS[step]) if (allErrors[key]) currentErrors[key] = allErrors[key];
    if (Object.keys(currentErrors).length) { setErrors(currentErrors); return; }
    setErrors({}); setStep((current) => Math.min(current + 1, STEPS.length - 1)); scrollToTop();
  }

  function previous() { setErrors({}); setStep((current) => Math.max(current - 1, 0)); scrollToTop(); }

  function submit() {
    const validation = validateIntake(answers);
    if (Object.keys(validation).length) { setErrors(validation); setSubmitError("חסרים מספר פרטים. עברו לשלבים המסומנים ובדקו את שדות החובה."); return; }
    setSubmitError("");
    startTransition(async () => {
      const response = await submitCompanyOnboarding(answers, { website, startedAt: startedAt.current });
      if (!response.success || !response.referenceCode) { setSubmitError(response.message); return; }
      localStorage.removeItem(DRAFT_KEY);
      setResult({ referenceCode: response.referenceCode });
      scrollToTop();
    });
  }

  if (result) return (
    <div ref={panelRef} className="rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)] sm:p-12">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-8" /></div>
      <p className="mt-6 text-xs font-extrabold tracking-[0.18em] text-emerald-700">האפיון התקבל בהצלחה</p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">תודה, מכאן אנחנו ממשיכים</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">הפרטים נשמרו ונשלח אישור לכתובת הדוא״ל שהזנתם. נעבור על הדרישות וניצור קשר לצורך השלמת האפיון ותכנון ההקמה.</p>
      <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-slate-100 px-5 py-4"><span className="block text-xs font-bold text-slate-500">מספר פנייה</span><strong className="mt-1 block text-lg tracking-wide text-slate-950" dir="ltr">{result.referenceCode}</strong></div>
    </div>
  );

  return (
    <div ref={panelRef} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-black text-slate-950">שלב {step + 1} מתוך {STEPS.length}</p><p className="mt-1 text-xs text-slate-500">{STEPS[step].subtitle}</p></div><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Save className="size-4" />{savedAt ? `הטיוטה נשמרה ב-${savedAt}` : "הטיוטה נשמרת אוטומטית"}</div></div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-l from-blue-600 to-cyan-500 transition-all duration-500" style={{ width: `${completion}%` }} /></div>
        <nav className="mt-5 hidden grid-cols-8 gap-2 lg:grid" aria-label="שלבי האפיון">{STEPS.map((item, index) => { const Icon = item.icon; return <button type="button" key={item.title} onClick={() => index < step && setStep(index)} disabled={index > step} className={cn("rounded-xl px-2 py-2 text-center transition", index === step ? "bg-slate-950 text-white" : index < step ? "text-slate-700 hover:bg-white" : "text-slate-400")}><Icon className="mx-auto mb-1 size-4" /><span className="text-[11px] font-bold">{item.title}</span></button>; })}</nav>
      </div>

      <div className="px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        {step === 0 && <div className="space-y-6"><SectionIntro eyebrow="01 · היכרות" title="נתחיל מהחברה ומהאנשים" description="פרטים בסיסיים שיעזרו לנו להתאים את סביבת העבודה, ההרשאות ואופן הליווי." /><div className="grid gap-5 sm:grid-cols-2"><Field label="שם החברה" required error={errors.companyName}><input className={inputClass} value={answers.companyName} onChange={(event) => update("companyName", event.target.value)} placeholder="לדוגמה: Acme Medical" /></Field><Field label="שם משפטי / ח.פ." hint="אופציונלי"><input className={inputClass} value={answers.legalName} onChange={(event) => update("legalName", event.target.value)} /></Field></div><Field label="תחום הפעילות" required error={errors.industry}><ChoiceGroup value={answers.industry} onChange={(value) => update("industry", value)} options={INDUSTRIES} columns={4} /></Field>{answers.industry === "אחר" && <Field label="מהו תחום הפעילות?" required error={errors.industryOther}><input className={inputClass} value={answers.industryOther} onChange={(event) => update("industryOther", event.target.value)} /></Field>}<div className="grid gap-5 sm:grid-cols-3"><Field label="מספר עובדים" required error={errors.employeeRange}><select className={inputClass} value={answers.employeeRange} onChange={(event) => update("employeeRange", event.target.value)}><option value="">בחירה</option>{["1–10", "11–50", "51–100", "101–250", "251–500", "מעל 500"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="מספר אתרים"><input className={inputClass} type="number" min="1" value={answers.siteCount} onChange={(event) => update("siteCount", event.target.value)} /></Field><Field label="אתר אינטרנט"><input className={inputClass} type="url" dir="ltr" value={answers.website} onChange={(event) => update("website", event.target.value)} placeholder="https://" /></Field></div><Field label="מיקומי החברה" hint="מפעלים, משרדים או מחסנים"><input className={inputClass} value={answers.locations} onChange={(event) => update("locations", event.target.value)} /></Field><div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5"><h3 className="mb-4 font-black text-slate-900">איש/אשת הקשר לפרויקט</h3><div className="grid gap-5 sm:grid-cols-2"><Field label="שם מלא" required error={errors.contactName}><input className={inputClass} autoComplete="name" value={answers.contactName} onChange={(event) => update("contactName", event.target.value)} /></Field><Field label="תפקיד"><input className={inputClass} value={answers.contactRole} onChange={(event) => update("contactRole", event.target.value)} /></Field><Field label="דוא״ל" required error={errors.contactEmail}><input className={inputClass} type="email" dir="ltr" autoComplete="email" value={answers.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} /></Field><Field label="טלפון" required error={errors.contactPhone}><input className={inputClass} type="tel" dir="ltr" autoComplete="tel" value={answers.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} /></Field></div></div></div>}

        {step === 1 && <div className="space-y-6"><SectionIntro eyebrow="02 · תאימות" title="לאילו דרישות המערכת צריכה להתאים?" description="אפשר לבחור כמה תקנים. המידע יסייע לנו לבנות תהליכים, הרשאות ותיעוד שמתאימים לביקורות שלכם." /><Field label="תקנים ודרישות רגולטוריות" required error={errors.standards}><MultiChoice values={answers.standards} onChange={(value) => update("standards", value)} options={STANDARDS} /></Field>{answers.standards.includes("אחר") && <Field label="תקן או דרישה נוספת" required error={errors.otherStandard}><input className={inputClass} value={answers.otherStandard} onChange={(event) => update("otherStandard", event.target.value)} /></Field>}<Field label="מהו שלב ההסמכה הנוכחי?" required error={errors.certificationStage}><ChoiceGroup value={answers.certificationStage} onChange={(value) => update("certificationStage", value)} options={["מוסמכים כיום", "בתהליך הסמכה", "מתכוננים להסמכה", "טרם הוחלט", "לא נדרשת הסמכה"]} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="תאריך יעד להסמכה / מבדק"><input className={inputClass} type="date" value={answers.certificationDeadline} onChange={(event) => update("certificationDeadline", event.target.value)} /></Field><Field label="שוקי יעד או גופים רגולטוריים"><input className={inputClass} value={answers.regulatoryNotes} onChange={(event) => update("regulatoryNotes", event.target.value)} placeholder="FDA, CE, משרד הבריאות..." /></Field></div></div>}

        {step === 2 && <div className="space-y-6"><SectionIntro eyebrow="03 · תמונת מצב" title="איך האיכות מנוהלת היום?" description="נזהה מה כדאי לשמר, מה נדרש להעביר ומה גורם כרגע לבזבוז זמן או לסיכון." /><Field label="באילו כלים אתם משתמשים כיום?" required error={errors.currentTools}><MultiChoice values={answers.currentTools} onChange={(value) => update("currentTools", value)} options={CURRENT_TOOLS} /></Field>{answers.currentTools.includes("מערכת QMS קיימת") && <Field label="איזו מערכת קיימת ומה תרצו לשמר ממנה?"><textarea className={textareaClass} value={answers.currentSystemDetails} onChange={(event) => update("currentSystemDetails", event.target.value)} /></Field>}<Field label="מהם שלושת האתגרים המרכזיים היום?" required error={errors.painPoints} hint="לדוגמה: מעקב ידני, פיגורים, חוסר שקיפות"><textarea className={textareaClass} value={answers.painPoints} onChange={(event) => update("painPoints", event.target.value)} placeholder="ספרו בקצרה מה לא עובד מספיק טוב היום..." /></Field><Field label="האם נדרש להעביר מידע קיים למערכת?" required error={errors.dataMigration}><ChoiceGroup value={answers.dataMigration} onChange={(value) => update("dataMigration", value)} options={["כן", "לא", "עדיין לא ידוע"]} /></Field>{answers.dataMigration === "כן" && <Field label="אילו קבצים או רשומות צריך להעביר?" required error={errors.migrationScope}><textarea className={textareaClass} value={answers.migrationScope} onChange={(event) => update("migrationScope", event.target.value)} placeholder="שמות קבצים, סוגי רשומות, היקף משוער ואיכות הנתונים..." /></Field>}</div>}

        {step === 3 && <div className="space-y-6"><SectionIntro eyebrow="04 · היקף" title="אילו אזורים ייכללו במערכת?" description="בחרו את כל המודולים הרלוונטיים. בשלב התכנון נחלק אותם לגרסת השקה ולהמשך הדרך." /><Field label="מודולים נדרשים" required error={errors.modules}><MultiChoice values={answers.modules} onChange={(value) => update("modules", value)} options={MODULES} /></Field><Field label="מודולים או תהליכים נוספים"><textarea className={textareaClass} value={answers.otherModules} onChange={(event) => update("otherModules", event.target.value)} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="מה חייב להיכלל בגרסה הראשונה?"><textarea className={textareaClass} value={answers.modulePriorities} onChange={(event) => update("modulePriorities", event.target.value)} /></Field><Field label="היקף רשומות משוער"><textarea className={textareaClass} value={answers.estimatedRecords} onChange={(event) => update("estimatedRecords", event.target.value)} placeholder="לדוגמה: 200 ספקים, 80 מכשירי מדידה..." /></Field></div></div>}

        {step === 4 && <div className="space-y-6"><SectionIntro eyebrow="05 · תהליך" title="כך נעצב את זרימת העבודה" description="אין צורך לנסח מפרט טכני. תארו מי פותח, מי מאשר ומה צריך לקרות עד לסגירת רשומה." /><Field label="תארו תהליך מרכזי אחד מתחילתו ועד סופו"><textarea className={textareaClass} value={answers.workflowDescription} onChange={(event) => update("workflowDescription", event.target.value)} placeholder="לדוגמה: עובד פותח אי התאמה, מנהל איכות מסווג, אחראי מבצע פעולה מתקנת..." /></Field><Field label="אילו אישורים נדרשים ובאילו שלבים?"><textarea className={textareaClass} value={answers.approvalRequirements} onChange={(event) => update("approvalRequirements", event.target.value)} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="כללי מספור או מזהים קיימים"><input className={inputClass} value={answers.numberingRequirements} onChange={(event) => update("numberingRequirements", event.target.value)} placeholder="NCR-2026-001, ECO-001..." /></Field><Field label="האם נדרשות חתימות אלקטרוניות?" required error={errors.electronicSignatures}><select className={inputClass} value={answers.electronicSignatures} onChange={(event) => update("electronicSignatures", event.target.value)}><option value="">בחירה</option>{["כן, חובה", "רצוי", "לא בשלב הראשון", "לא ידוע"].map((item) => <option key={item}>{item}</option>)}</select></Field></div><Field label="דרישות לקבצים, תמונות ונספחים"><textarea className={textareaClass} value={answers.attachmentRequirements} onChange={(event) => update("attachmentRequirements", event.target.value)} placeholder="סוגי קבצים, מגבלות, תיעוד תמונות, תעודות..." /></Field></div>}

        {step === 5 && <div className="space-y-6"><SectionIntro eyebrow="06 · גישה" title="מי ישתמש במערכת ומה מותר לכל אחד?" description="הגדרה נכונה של תפקידים והרשאות היא בסיס למערכת איכות מבוקרת ונוחה." /><Field label="כמה משתמשים צפויים?" required error={errors.userCount}><ChoiceGroup value={answers.userCount} onChange={(value) => update("userCount", value)} options={["1–10", "11–25", "26–50", "51–100", "מעל 100"]} /></Field><Field label="סוגי משתמשים" required error={errors.userRoles}><MultiChoice values={answers.userRoles} onChange={(value) => update("userRoles", value)} options={USER_ROLES} /></Field><Field label="הרשאות או הפרדות מיוחדות"><textarea className={textareaClass} value={answers.permissionNotes} onChange={(event) => update("permissionNotes", event.target.value)} placeholder="לדוגמה: הפרדה בין אתרים, מנהלים רואים רק את המחלקה שלהם..." /></Field><Field label="האם נדרשת התחברות עם חשבון החברה (SSO)?" required error={errors.ssoRequired}><ChoiceGroup value={answers.ssoRequired} onChange={(value) => update("ssoRequired", value)} options={["כן", "לא", "לא ידוע"]} /></Field>{answers.ssoRequired === "כן" && <Field label="באמצעות איזה ספק?" required error={errors.ssoProvider}><ChoiceGroup value={answers.ssoProvider} onChange={(value) => update("ssoProvider", value)} options={["Microsoft 365 / Entra ID", "Google Workspace", "ספק אחר"]} /></Field>}<Field label="שפות נדרשות במערכת" required error={errors.languages}><MultiChoice values={answers.languages} onChange={(value) => update("languages", value)} options={LANGUAGES} /></Field></div>}

        {step === 6 && <div className="space-y-6"><SectionIntro eyebrow="07 · אוטומציה" title="חיבורים, התראות ותזכורות" description="נגדיר כיצד המערכת משתלבת בסביבת העבודה ומוודאת ששום פעולה או תוקף לא נשכחים." /><Field label="אילו חיבורים נדרשים?" required error={errors.integrations}><MultiChoice values={answers.integrations} onChange={(value) => update("integrations", value)} options={INTEGRATIONS} /></Field>{answers.integrations.includes("אחר") && <Field label="איזו אינטגרציה נוספת?" required error={errors.otherIntegration}><input className={inputClass} value={answers.otherIntegration} onChange={(event) => update("otherIntegration", event.target.value)} /></Field>}<Field label="איך תרצו לקבל התראות?" required error={errors.notifications}><MultiChoice values={answers.notifications} onChange={(value) => update("notifications", value)} options={["דוא״ל", "התראה בתוך המערכת", "סיכום יומי", "סיכום שבועי", "Teams / Slack", "ללא התראות אוטומטיות"]} /></Field><Field label="כללי תזכורת והסלמה רצויים"><textarea className={textareaClass} value={answers.reminderRules} onChange={(event) => update("reminderRules", event.target.value)} placeholder="לדוגמה: 30 יום לפני תוקף, תזכורת נוספת לאחר 7 ימים, העברה למנהל..." /></Field></div>}

        {step === 7 && <div className="space-y-6"><SectionIntro eyebrow="08 · כמעט סיימנו" title="מה ייחשב להצלחה?" description="הפרטים האחרונים יעזרו לנו להציע סדר הקמה מציאותי ולמדוד שהמערכת אכן נותנת ערך." /><div className="grid gap-5 sm:grid-cols-2"><Field label="יעד לעלייה לאוויר" required error={errors.goLiveTarget}><select className={inputClass} value={answers.goLiveTarget} onChange={(event) => update("goLiveTarget", event.target.value)}><option value="">בחירה</option>{["בהקדם האפשרי", "תוך חודש", "תוך 3 חודשים", "תוך 6 חודשים", "בהמשך השנה", "אין עדיין יעד"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="עדיפות ההקמה" required error={errors.implementationPriority}><select className={inputClass} value={answers.implementationPriority} onChange={(event) => update("implementationPriority", event.target.value)}><option value="">בחירה</option>{["קריטית – צורך מיידי", "גבוהה", "בינונית", "בשלב בחינה"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="מיתוג רצוי"><input className={inputClass} value={answers.branding} onChange={(event) => update("branding", event.target.value)} placeholder="לוגו, צבעי מותג, white-label..." /></Field><Field label="כתובת מערכת רצויה"><input className={inputClass} dir="ltr" value={answers.preferredDomain} onChange={(event) => update("preferredDomain", event.target.value)} placeholder="quality.company.com" /></Field></div><Field label="איך תדעו שהפרויקט הצליח?" required error={errors.successDefinition}><textarea className={textareaClass} value={answers.successDefinition} onChange={(event) => update("successDefinition", event.target.value)} placeholder="לדוגמה: מעבר מלא מאקסל, ירידה בפיגורים, הכנה מהירה למבדק..." /></Field><Field label="הערות, מגבלות או מידע נוסף"><textarea className={textareaClass} value={answers.additionalNotes} onChange={(event) => update("additionalNotes", event.target.value)} /></Field><div className="border-t border-slate-200 pt-7"><h3 className="mb-4 text-xl font-black text-slate-950">סיכום הפרטים</h3><Summary answers={answers} /></div><div className="absolute -right-[10000px]" aria-hidden="true"><label htmlFor="company-site">Company site</label><input id="company-site" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>{submitError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{submitError}</div>}</div>}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
        <button type="button" onClick={previous} disabled={step === 0 || isPending} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:invisible"><ArrowRight className="size-4" />חזרה</button>
        <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><LockKeyhole className="size-4" />המידע מועבר ונשמר באופן מאובטח</div>
        {step < STEPS.length - 1 ? <button type="button" onClick={next} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800">המשך<ArrowLeft className="size-4" /></button> : <button type="button" onClick={submit} disabled={isPending} className="inline-flex h-11 min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">{isPending ? <><LoaderCircle className="size-4 animate-spin" />שולחים...</> : <><CheckCircle2 className="size-4" />שליחת האפיון</>}</button>}
      </div>
    </div>
  );
}
