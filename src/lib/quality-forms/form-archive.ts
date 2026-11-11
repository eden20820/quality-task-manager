export const ONLINE_FORM_CATEGORY = "טופס מקוון";
export const ECO_ARCHIVE_EDIT_STORAGE_KEY = "quality-eco-archive-edit";
export const ECO_ARCHIVE_RECORD_STORAGE_KEY = "quality-eco-archive-record";
export const ECO_FORM_TITLE = "טופס ECO";
export function isEcoFormDescription(description: string | null) { return parseArchivedFormDescription(description).title === ECO_FORM_TITLE; }
export const RIR_ARCHIVE_EDIT_STORAGE_KEY = "quality-rir-archive-edit";
export const SHELF_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY = "quality-shelf-inspection-archive-edit";
export const ADHESION_LEAK_TEST_ARCHIVE_EDIT_STORAGE_KEY = "quality-adhesion-leak-test-archive-edit";
export const ADHESION_LEAK_TEST_ARCHIVE_RECORD_STORAGE_KEY = "quality-adhesion-leak-test-archive-record";
export const ADHESION_LEAK_TEST_FORM_TITLE = "טופס בדיקת אטימות – הדבקה";
export const DEVELOPMENT_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY = "quality-development-inspection-archive-edit";
export const DEVELOPMENT_INSPECTION_ARCHIVE_RECORD_STORAGE_KEY = "quality-development-inspection-archive-record";
export const DEVELOPMENT_INSPECTION_FORM_TITLE = "טופס ביקורת קבלה – מוצרי פיתוח";

export type QualityFormStatus = "pending-signature" | "signed";

const FORM_STATUS_TOKEN = "|||status:";

export function buildArchivedFormDescription(title: string, status?: QualityFormStatus) {
  return status ? `${title}${FORM_STATUS_TOKEN}${status}` : title;
}

export function parseArchivedFormDescription(description: string | null) {
  const value = description ?? "טופס מקוון";
  const [title, rawStatus] = value.split(FORM_STATUS_TOKEN, 2);
  const status = rawStatus === "pending-signature" || rawStatus === "signed" ? rawStatus : null;
  return { title, status: status as QualityFormStatus | null };
}

export function isAdhesionFormDescription(description: string | null) {
  return parseArchivedFormDescription(description).title === ADHESION_LEAK_TEST_FORM_TITLE;
}

export function isDevelopmentInspectionDescription(description: string | null) {
  return parseArchivedFormDescription(description).title === DEVELOPMENT_INSPECTION_FORM_TITLE;
}

export function isPendingSignatureDescription(description: string | null) {
  const parsed = parseArchivedFormDescription(description);
  return parsed.status === "pending-signature" || (parsed.status === null && parsed.title === ADHESION_LEAK_TEST_FORM_TITLE);
}

function safeFilePart(value: string, fallback: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 60) || fallback;
}

export function buildQualityFormFileName(input: {
  supplierName: string;
  date: string;
  catalogNumber: string;
  extension: string;
}) {
  const supplier = safeFilePart(input.supplierName, "ללא-ספק");
  const date = safeFilePart(input.date.replace(/\//g, "-"), "ללא-תאריך");
  const catalog = safeFilePart(input.catalogNumber, "ללא-מקט");
  const extension = safeFilePart(input.extension.replace(/^\./, ""), "bin").toLowerCase();
  return `${supplier}_${date}_${catalog}.${extension}`;
}

export function buildQualityFormDownloadName(catalogNumber: string, extension: string) {
  const catalog = safeFilePart(catalogNumber, "טופס");
  const safeExtension = safeFilePart(extension.replace(/^\./, ""), "bin").toLowerCase();
  return `${catalog}.${safeExtension}`;
}

export function downloadNameFromArchivedFile(fileName: string) {
  const match = fileName.match(/_(?:\d{4}-\d{2}-\d{2}|ללא-תאריך)_(.+)\.([^.]+)$/);
  return match ? buildQualityFormDownloadName(match[1], match[2]) : fileName;
}
