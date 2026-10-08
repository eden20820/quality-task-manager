export const INDUSTRIES = [
  "תעשייה וייצור",
  "מכשור רפואי",
  "תעופה וביטחון",
  "פארמה וביוטכנולוגיה",
  "מזון וקוסמטיקה",
  "מעבדות ושירותים מקצועיים",
  "טכנולוגיה ותוכנה",
  "אחר",
] as const;

export const STANDARDS = [
  "ISO 9001",
  "ISO 13485",
  "AS9100",
  "ISO 17025",
  "GMP",
  "ISO 14001",
  "ISO 45001",
  "עדיין לא הוגדר",
  "אחר",
] as const;

export const MODULES = [
  "משימות ותוכניות עבודה",
  "אי התאמות ו-CAPA",
  "ECO ובקרת שינויים",
  "פק״עות / הוראות ייצור",
  "ספקים מאושרים והערכות ספק",
  "כיולים וציוד מדידה",
  "תוקף חומרים ומלאי",
  "מסמכים, נהלים וגרסאות",
  "הדרכות והסמכות עובדים",
  "מבדקים פנימיים וחיצוניים",
  "תלונות לקוח",
  "סיכונים והזדמנויות",
] as const;

export const CURRENT_TOOLS = [
  "Excel",
  "SharePoint / OneDrive",
  "Google Drive",
  "מערכת QMS קיימת",
  "ERP / Priority / SAP",
  "טפסים ידניים / נייר",
  "אין מערכת מסודרת",
] as const;

export const INTEGRATIONS = [
  "Microsoft 365 / SharePoint",
  "Google Workspace / Drive",
  "ERP / Priority / SAP",
  "Monday / ClickUp / Jira",
  "Teams / Slack",
  "מערכת BI",
  "לא נדרשת אינטגרציה בשלב הראשון",
  "אחר",
] as const;

export const LANGUAGES = ["עברית", "אנגלית", "ערבית", "שפה נוספת"] as const;

export const USER_ROLES = [
  "מנהל/ת איכות",
  "הנהלה",
  "עובדי איכות",
  "עובדי ייצור / תפעול",
  "מחסן ורכש",
  "מהנדסים",
  "ספקים או משתמשים חיצוניים",
] as const;

export type IntakeAnswers = {
  companyName: string;
  legalName: string;
  industry: string;
  industryOther: string;
  website: string;
  employeeRange: string;
  siteCount: string;
  locations: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  standards: string[];
  otherStandard: string;
  certificationStage: string;
  certificationDeadline: string;
  regulatoryNotes: string;
  currentTools: string[];
  currentSystemDetails: string;
  painPoints: string;
  dataMigration: string;
  migrationScope: string;
  modules: string[];
  otherModules: string;
  modulePriorities: string;
  estimatedRecords: string;
  workflowDescription: string;
  approvalRequirements: string;
  numberingRequirements: string;
  electronicSignatures: string;
  attachmentRequirements: string;
  userCount: string;
  userRoles: string[];
  permissionNotes: string;
  ssoRequired: string;
  ssoProvider: string;
  languages: string[];
  integrations: string[];
  otherIntegration: string;
  notifications: string[];
  reminderRules: string;
  branding: string;
  preferredDomain: string;
  goLiveTarget: string;
  implementationPriority: string;
  successDefinition: string;
  additionalNotes: string;
};

export const EMPTY_INTAKE: IntakeAnswers = {
  companyName: "", legalName: "", industry: "", industryOther: "", website: "",
  employeeRange: "", siteCount: "", locations: "", contactName: "", contactRole: "",
  contactEmail: "", contactPhone: "", standards: [], otherStandard: "",
  certificationStage: "", certificationDeadline: "", regulatoryNotes: "", currentTools: [],
  currentSystemDetails: "", painPoints: "", dataMigration: "", migrationScope: "", modules: [],
  otherModules: "", modulePriorities: "", estimatedRecords: "", workflowDescription: "",
  approvalRequirements: "", numberingRequirements: "", electronicSignatures: "",
  attachmentRequirements: "", userCount: "", userRoles: [], permissionNotes: "",
  ssoRequired: "", ssoProvider: "", languages: [], integrations: [], otherIntegration: "",
  notifications: [], reminderRules: "", branding: "", preferredDomain: "", goLiveTarget: "",
  implementationPriority: "", successDefinition: "", additionalNotes: "",
};

export const INTAKE_SECTION_LABELS = {
  company: "החברה ואיש הקשר",
  compliance: "תקינה ורגולציה",
  currentState: "המצב הקיים",
  modules: "מודולים והיקף",
  workflow: "תהליכים ואישורים",
  users: "משתמשים והרשאות",
  integrations: "חיבורים והתראות",
  launch: "השקה והצלחה",
} as const;

export const INTAKE_FIELD_LABELS: Record<keyof IntakeAnswers, string> = {
  companyName: "שם החברה", legalName: "שם משפטי / ח.פ.", industry: "תחום פעילות",
  industryOther: "תחום פעילות אחר", website: "אתר אינטרנט", employeeRange: "מספר עובדים",
  siteCount: "מספר אתרים", locations: "מיקומים", contactName: "איש/אשת קשר",
  contactRole: "תפקיד", contactEmail: "דוא״ל", contactPhone: "טלפון",
  standards: "תקנים ודרישות", otherStandard: "תקן אחר", certificationStage: "שלב הסמכה",
  certificationDeadline: "יעד להסמכה / מבדק", regulatoryNotes: "דרישות רגולטוריות נוספות",
  currentTools: "כלים קיימים", currentSystemDetails: "פירוט המערכת הקיימת",
  painPoints: "האתגרים המרכזיים", dataMigration: "העברת מידע קיים",
  migrationScope: "קבצים ומידע להעברה", modules: "מודולים נדרשים", otherModules: "מודולים נוספים",
  modulePriorities: "סדר עדיפויות", estimatedRecords: "היקף רשומות משוער",
  workflowDescription: "תהליך העבודה הרצוי", approvalRequirements: "שרשרת אישורים",
  numberingRequirements: "מספור ומזהים", electronicSignatures: "חתימות אלקטרוניות",
  attachmentRequirements: "קבצים ונספחים", userCount: "מספר משתמשים",
  userRoles: "סוגי משתמשים", permissionNotes: "הרשאות מיוחדות", ssoRequired: "התחברות ארגונית",
  ssoProvider: "ספק התחברות", languages: "שפות מערכת", integrations: "אינטגרציות",
  otherIntegration: "אינטגרציה נוספת", notifications: "ערוצי התראה",
  reminderRules: "תזמון והסלמת התראות", branding: "מיתוג", preferredDomain: "כתובת מערכת רצויה",
  goLiveTarget: "יעד לעלייה לאוויר", implementationPriority: "עדיפות ההקמה",
  successDefinition: "מדדי הצלחה", additionalNotes: "הערות נוספות",
};

export function validateIntake(answers: IntakeAnswers) {
  const errors: Partial<Record<keyof IntakeAnswers, string>> = {};
  if (answers.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.contactEmail.trim())) {
    errors.contactEmail = "כתובת הדוא״ל אינה תקינה";
  }
  return errors;
}

export function sanitizeIntake(raw: unknown): IntakeAnswers {
  if (!raw || typeof raw !== "object") throw new Error("המידע שהתקבל אינו תקין");
  const source = raw as Record<string, unknown>;
  const result = { ...EMPTY_INTAKE };
  for (const key of Object.keys(EMPTY_INTAKE) as Array<keyof IntakeAnswers>) {
    const emptyValue = EMPTY_INTAKE[key];
    if (Array.isArray(emptyValue)) {
      const value = source[key];
      (result[key] as string[]) = Array.isArray(value)
        ? value.slice(0, 30).map((item) => String(item).replace(/\s+/g, " ").trim().slice(0, 160)).filter(Boolean)
        : [];
    } else {
      (result[key] as string) = String(source[key] ?? "").replace(/\u0000/g, "").trim().slice(0, 5000);
    }
  }
  return result;
}

export function createReferenceCode(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `QMS-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}
