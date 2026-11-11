export type EcoAttachment = { id: string; name: string; mimeType: string; data: string };
export const ECO_ATTACHMENT_ACCEPT = ".pdf,.xlsx,.docx,.csv,.txt,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.avif,.heic,.heif";
export const ECO_MAX_ATTACHMENT_BYTES = 2_000_000;
export const ECO_MEDIA_BUDGET = 3_200_000;
const types: Record<string, string> = { pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", csv: "text/csv", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff", avif: "image/avif", heic: "image/heic", heif: "image/heif" };
export function ecoFileType(name: string) { return types[name.split(".").pop()?.toLowerCase() ?? ""] ?? null; }
export function validEcoAttachment(value: unknown): value is EcoAttachment {
  if (!value || typeof value !== "object") return false;
  const f = value as EcoAttachment;
  return typeof f.id === "string" && f.id.length > 0 && f.id.length <= 100 && typeof f.name === "string" && f.name.length > 0 && f.name.length <= 180 && !/[\x00-\x1f/\\]/.test(f.name) && ecoFileType(f.name) === f.mimeType && typeof f.data === "string" && f.data.length > 0 && f.data.length <= Math.ceil(ECO_MAX_ATTACHMENT_BYTES / 3) * 4 && f.data.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(f.data) && ecoAttachmentSize(f) <= ECO_MAX_ATTACHMENT_BYTES;
}
export function ecoAttachmentSize(f: EcoAttachment) { return Math.floor(f.data.length * 3 / 4) - (f.data.endsWith("==") ? 2 : f.data.endsWith("=") ? 1 : 0); }
export function uniqueEcoFileIds(payload: {actions: {attachments?: EcoAttachment[]}[]; risk: {attachments?: EcoAttachment[]}}) { const ids = [...payload.actions, payload.risk].flatMap(action => (action.attachments ?? []).map(file => file.id)); return ids.length === new Set(ids).size; }
export function ecoMediaSize(payload: { illustrations?: {beforeImage: string; afterImage: string}[]; actions: {attachments?: EcoAttachment[]}[]; risk: {attachments?: EcoAttachment[]} }) {
  return (payload.illustrations ?? []).reduce((sum, b) => sum + b.beforeImage.length + b.afterImage.length, 0) + [...payload.actions, payload.risk].reduce((sum, a) => sum + (a.attachments ?? []).reduce((total, f) => total + f.data.length, 0), 0);
}
export function ecoFileLabel(name: string) { const extension = name.split(".").pop()?.toUpperCase() ?? "FILE"; return ["JPG", "JPEG", "PNG", "WEBP", "GIF", "BMP", "TIF", "TIFF", "AVIF", "HEIC", "HEIF"].includes(extension) ? "IMG" : extension; }
