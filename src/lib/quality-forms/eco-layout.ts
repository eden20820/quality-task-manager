import type { EcoFormPayload, EcoIllustration } from "./eco-form";
import { ECO_MEDIA_BUDGET, ecoMediaSize } from "./eco-files";

export const ECO_SECTION_TITLES = {
  details: "פרטי הטופס ויוזם השינוי", products: "מוצרים / פריטים", description: "תיאור השינוי",
  justification: "ההצדקה לשינוי", initialApproval: "אישור ראשוני", impact: "השפעת השינוי",
  approvals: "אישורים נדרשים", actions: "פעולות נלוות", closure: "סגירת הטופס",
} as const;
export type EcoSection = keyof typeof ECO_SECTION_TITLES;
export type EcoLayoutBlock =
  | { id: string; kind: "section"; section: EcoSection }
  | { id: string; kind: "text"; title: string; text: string }
  | { id: string; kind: "illustration"; illustrationId: string };
export type EcoInsertKind = "text" | "pair" | "single";
const sections = Object.keys(ECO_SECTION_TITLES) as EcoSection[];
const sectionBlock = (section: EcoSection): EcoLayoutBlock => ({ id: `section-${section}`, kind: "section", section });
const imageBlock = (id: string): EcoLayoutBlock => ({ id: `image-${id}`, kind: "illustration", illustrationId: id });

// Old forms retain their original order without changing stored data.
export function getEcoLayout(payload: Pick<EcoFormPayload, "layout" | "illustrations">): EcoLayoutBlock[] {
  if (payload.layout) return payload.layout;
  return [sectionBlock("details"), sectionBlock("products"), sectionBlock("description"), ...(payload.illustrations ?? []).map(image => imageBlock(image.id)), ...sections.slice(3).map(sectionBlock)];
}
export function validEcoLayout(value: unknown, images: EcoIllustration[]): value is EcoLayoutBlock[] | undefined {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 49) return false;
  const ids = new Set<string>(), system = new Set<string>(), references = new Set<string>(); let texts = 0;
  for (const block of value) {
    if (!block || typeof block.id !== "string" || !block.id || block.id.length > 100 || ids.has(block.id)) return false;
    ids.add(block.id);
    if (block.kind === "section") {
      if (!sections.includes(block.section) || system.has(block.section)) return false;
      system.add(block.section);
    } else if (block.kind === "text") {
      if (++texts > 30 || typeof block.title !== "string" || block.title.length > 300 || typeof block.text !== "string" || block.text.length > 30_000) return false;
    } else if (block.kind === "illustration") {
      if (typeof block.illustrationId !== "string" || references.has(block.illustrationId) || !images.some(image => image?.id === block.illustrationId)) return false;
      references.add(block.illustrationId);
    } else return false;
  }
  return system.size === sections.length && references.size === images.length;
}
export function ecoBlockTitle(block: EcoLayoutBlock, payload: EcoFormPayload): string {
  if (block.kind === "section") return ECO_SECTION_TITLES[block.section];
  if (block.kind === "text") return block.title.trim() || "מקטע טקסט";
  const image = payload.illustrations?.find(image => image.id === block.illustrationId);
  return image?.title.trim() || (image?.mode === "pair" ? "לפני ואחרי" : "תמונה");
}
export function moveEcoBlock(payload: EcoFormPayload, id: string, destination: number): EcoFormPayload {
  const layout = [...getEcoLayout(payload)], source = layout.findIndex(block => block.id === id);
  if (source < 0 || !Number.isInteger(destination) || destination < 0 || destination >= layout.length || source === destination) return payload;
  const [block] = layout.splice(source, 1); layout.splice(destination, 0, block);
  return { ...payload, layout };
}
export function insertEcoBlock(payload: EcoFormPayload, kind: EcoInsertKind, id: string, afterId?: string | null): EcoFormPayload {
  const layout = [...getEcoLayout(payload)], images = payload.illustrations ?? [];
  if (!id || id.length > 90 || layout.some(block=>block.id===id || block.id===`image-${id}`) || images.some(image=>image.id===id)) return payload;
  if (layout.length >= 49 || (kind === "text" ? layout.filter(block => block.kind === "text").length >= 30 : images.length >= 10)) return payload;
  let block: EcoLayoutBlock;
  let illustrations = payload.illustrations;
  if (kind === "text") block = { id, kind: "text", title: "", text: "" };
  else {
    illustrations = [...images, { id, mode: kind, title: "", beforeLabel: kind === "pair" ? "לפני" : "תמונה", afterLabel: "אחרי", beforeImage: "", afterImage: "", beforeCaption: "", afterCaption: "", notes: "" }];
    block = imageBlock(id);
  }
  const position = afterId ? layout.findIndex(block => block.id === afterId) : layout.length - 1;
  layout.splice(afterId === null ? 0 : position < 0 ? layout.length : position + 1, 0, block);
  return { ...payload, layout, ...(illustrations ? { illustrations } : {}) };
}
export function removeEcoBlock(payload: EcoFormPayload, id: string): EcoFormPayload {
  const layout = getEcoLayout(payload), block = layout.find(block => block.id === id);
  if (!block || block.kind === "section") return payload;
  return { ...payload, layout: layout.filter(block => block.id !== id), ...(block.kind === "illustration" ? { illustrations: (payload.illustrations ?? []).filter(image => image.id !== block.illustrationId) } : {}) };
}
export function changeEcoText(payload: EcoFormPayload, id: string, patch: {title?: string; text?: string}): EcoFormPayload {
  return { ...payload, layout: getEcoLayout(payload).map(block => block.id === id && block.kind === "text" ? { ...block, ...patch } : block) };
}
export function changeEcoIllustration(payload: EcoFormPayload, id: string, apply: EcoIllustration[] | ((images: EcoIllustration[]) => EcoIllustration[])): EcoFormPayload {
  const images = payload.illustrations ?? [], source = images.find(image => image.id === id);
  if (!source) return payload;
  const updated = typeof apply === "function" ? apply([source]) : apply;
  if (!updated.length || updated[0].id !== id) return payload;
  const illustrations = images.flatMap(image => image.id === id ? updated : [image]);
  const layout = [...getEcoLayout(payload)], sourceIndex = layout.findIndex(block => block.kind === "illustration" && block.illustrationId === id);
  layout.splice(sourceIndex + 1, 0, ...updated.slice(1).map(image => imageBlock(image.id)));
  const next = { ...payload, illustrations, layout };
  if (illustrations.length > 10 || illustrations.reduce((sum, image) => sum + image.beforeImage.length + image.afterImage.length, 0) > 2_500_000 || ecoMediaSize(next) > ECO_MEDIA_BUDGET) throw new Error("התמונות והקבצים בטופס הגיעו למגבלת הגודל. יש להקטין או להסיר תמונות");
  return next;
}
