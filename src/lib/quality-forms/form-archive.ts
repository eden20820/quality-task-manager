export const ONLINE_FORM_CATEGORY = "טופס מקוון";

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
