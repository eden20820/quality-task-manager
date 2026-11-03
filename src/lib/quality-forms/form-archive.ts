export const ONLINE_FORM_CATEGORY = "טופס מקוון";
export const RIR_ARCHIVE_EDIT_STORAGE_KEY = "quality-rir-archive-edit";
export const SHELF_INSPECTION_ARCHIVE_EDIT_STORAGE_KEY = "quality-shelf-inspection-archive-edit";

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
