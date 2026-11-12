export const ECO_APPROVAL_ROLES = ["הנדסה", "הבטחת איכות", "תפעול", "ייצור הרכבות", "רכש", "קשרי לקוחות", "מחסן", "רגולציה", "מנכ״ל", "אחר"] as const;
export const ECO_ACTIONS = ["שינוי BOM", "עדכון שרטוט", "עדכון נהלי איכות", "עדכון הוראות עבודה", "עדכון שיטות בדיקה", "עדכון לקוח/רשויות", "הדרכות עובדים", "ולידציה/רה-ולידציה", "עדכון ספסיפיקציה"] as const;
export const ECO_CATEGORIES = ["מוצר מוגמר", "חומר גלם", "תהליכי ייצור", "שיטות בדיקה", "שינויי תוכנה", "אחר"] as const;
import { ECO_MEDIA_BUDGET, ecoMediaSize, uniqueEcoFileIds, validEcoAttachment, type EcoAttachment } from "./eco-files";
import { validEcoLayout, type EcoLayoutBlock } from "./eco-layout";
export type EcoProduct = { partName: string; catalogNumber: string; currentRevision: string; newRevision: string };
export type EcoIllustration = { id: string; mode: "pair" | "single"; title: string; beforeLabel: string; afterLabel: string; beforeImage: string; afterImage: string; beforeCaption: string; afterCaption: string; notes: string };
export function nextEcoRevision(value: string): string {
  const trimmed = value.trim();
  return /^\d{1,12}$/.test(trimmed) ? String(Number(trimmed) + 1).padStart(Math.max(2, trimmed.length), "0") : "";
}
export function updateEcoProduct(product: EcoProduct, key: keyof EcoProduct, value: string, known?: { catalogNumber: string; partName: string; revision?: string | null } | null): EcoProduct {
  const result = { ...product, [key]: value, ...(known ? { catalogNumber: known.catalogNumber, partName: known.partName, currentRevision: known.revision ?? product.currentRevision } : {}) };
  if (key === "currentRevision" || known) result.newRevision = nextEcoRevision(result.currentRevision);
  return result;
}
export type EcoSignature = { name: string; date: string; signature: string };
export type EcoApproval = EcoSignature & { role: string; required: boolean; notes: string };
export type EcoRequirement = "" | "required" | "not-required";
export type EcoFormPayload = {
  formNumber: string; date: string; initiatorName: string; initiatorRole: string; categories: boolean[]; otherCategory: string;
  products: EcoProduct[]; changeDescription: string; justification: string; initialApproval: EcoSignature;
  illustrations?: EcoIllustration[];
  layout?: EcoLayoutBlock[];
  productImpact: string; qualitySystemImpact: string; regulatoryImpact: string; approvals: EcoApproval[];
  risk: { requirement: EcoRequirement; date: string; survey: string; attachments?: EcoAttachment[] };
  inventory: "" | "none" | "use" | "reject" | "other"; inventoryOther: string;
  openOrders: "" | "none" | "accept" | "cancel" | "other"; openOrdersOther: string;
  actions: Array<{ requirement: EcoRequirement; date: string; attachments?: EcoAttachment[] }>; additionalTasks: string;
  closure: EcoSignature & { decision: "" | "approved" | "rejected"; reason: string };
};
export const emptyEcoProduct = (): EcoProduct => ({ partName: "", catalogNumber: "", currentRevision: "", newRevision: "" });
export function createEmptyEcoForm(today: string): EcoFormPayload {
  const signature = () => ({ name: "", date: "", signature: "" });
  return { formNumber: "", date: today, initiatorName: "", initiatorRole: "", categories: ECO_CATEGORIES.map(() => false), otherCategory: "", products: [emptyEcoProduct()], changeDescription: "", justification: "", initialApproval: signature(), productImpact: "", qualitySystemImpact: "", regulatoryImpact: "", approvals: ECO_APPROVAL_ROLES.map(role => ({ ...signature(), role, required: false, notes: "" })), risk: { requirement: "", date: "", survey: "" }, inventory: "", inventoryOther: "", openOrders: "", openOrdersOther: "", actions: ECO_ACTIONS.map(() => ({ requirement: "", date: "" })), additionalTasks: "", closure: { ...signature(), decision: "", reason: "" } };
}
export function isEcoFormPayload(value: unknown): value is EcoFormPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as EcoFormPayload;
  const text = (v: unknown) => typeof v === "string" && v.length <= 30_000;
  const signature = (s: EcoSignature) => s && text(s.name) && text(s.date) && typeof s.signature === "string" && s.signature.length < 1_500_000 && (!s.signature || /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/.test(s.signature));
  const requirement = (v: unknown) => ["", "required", "not-required"].includes(String(v));
  const attachments = (v: unknown) => v === undefined || (Array.isArray(v) && v.length <= 6 && v.every(validEcoAttachment));
  const image = (v: unknown) => typeof v === "string" && v.length <= 420_000 && (!v || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v));
  if (!validEcoLayout(p.layout, Array.isArray(p.illustrations) ? p.illustrations : [])) return false;
  if (p.illustrations !== undefined && (!Array.isArray(p.illustrations) || p.illustrations.length > 10 || !p.illustrations.every(b => b && [b.id, b.title, b.beforeLabel, b.afterLabel, b.beforeCaption, b.afterCaption, b.notes].every(text) && ["pair", "single"].includes(b.mode) && image(b.beforeImage) && image(b.afterImage)) || p.illustrations.reduce((sum, b) => sum + b.beforeImage.length + b.afterImage.length, 0) > 2_500_000)) return false;
  return Boolean([p.formNumber, p.date, p.initiatorName, p.initiatorRole, p.otherCategory, p.changeDescription, p.justification, p.productImpact, p.qualitySystemImpact, p.regulatoryImpact, p.inventoryOther, p.openOrdersOther, p.additionalTasks].every(text)
    && Array.isArray(p.categories) && p.categories.length === ECO_CATEGORIES.length && p.categories.every(v => typeof v === "boolean")
    && Array.isArray(p.products) && p.products.length > 0 && p.products.length <= 100 && p.products.every(v => v && [v.partName, v.catalogNumber, v.currentRevision, v.newRevision].every(text))
    && signature(p.initialApproval) && Array.isArray(p.approvals) && p.approvals.length === ECO_APPROVAL_ROLES.length && p.approvals.every(a => signature(a) && text(a.role) && text(a.notes) && typeof a.required === "boolean")
    && p.risk && requirement(p.risk.requirement) && text(p.risk.date) && text(p.risk.survey) && attachments(p.risk.attachments)
    && ["", "none", "use", "reject", "other"].includes(p.inventory) && ["", "none", "accept", "cancel", "other"].includes(p.openOrders)
    && Array.isArray(p.actions) && p.actions.length === ECO_ACTIONS.length && p.actions.every(a => a && requirement(a.requirement) && text(a.date) && attachments(a.attachments))
    && signature(p.closure) && ["", "approved", "rejected"].includes(p.closure.decision) && text(p.closure.reason) && uniqueEcoFileIds(p) && ecoMediaSize(p) <= ECO_MEDIA_BUDGET && new TextEncoder().encode(JSON.stringify(p)).length <= 3_800_000);
}
export function ecoFormIsSigned(payload: EcoFormPayload) {
  return Boolean(payload.initialApproval.signature && payload.closure.signature && payload.closure.decision && payload.approvals.filter(a => a.required).every(a => a.signature));
}
