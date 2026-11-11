import { resolveCatalogItem, type CatalogItem } from "./parts-catalog";
export type FormAutocompleteSuggestions = {
  catalogNumbers: string[];
  catalogItems: CatalogItem[];
  supplierNames: string[];
  partNames: string[];
  orderNumbers: string[];
  revisions: string[];
};

type SupplierSource = { supplier_name: string | null };
type ArchivedFormSource = { file_name: string | null };
type FollowupSource = { name: string | null; notes: string | null };

const PKA_PREFIX = "PKA_IMPORT_JSON:";

function clean(value: unknown) {
  return String(value ?? "").replace(/[\u200e\u200f\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim();
}

function suggestionKey(value: string) {
  return value.toLocaleLowerCase("he-IL").replace(/[\s_.\-/\\]+/g, "");
}

export function catalogNumbersMatch(left: string, right: string) {
  const leftKey = suggestionKey(clean(left));
  return Boolean(leftKey) && leftKey === suggestionKey(clean(right));
}

export function findKnownPartName(catalogNumber: string, catalogItems: FormAutocompleteSuggestions["catalogItems"]) {
  if (!suggestionKey(clean(catalogNumber))) return "";
  return resolveCatalogItem(catalogItems, "catalogNumber", catalogNumber)?.partName ?? "";
}

function uniqueSuggestions(values: unknown[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const item = clean(value);
    const key = suggestionKey(item);
    if (!item || !key || seen.has(key)) return [];
    seen.add(key);
    return [item];
  });
}

export function parseArchivedFormFileName(fileName: string) {
  const match = clean(fileName).match(/^(.+?)_(\d{4}-\d{2}-\d{2}|ללא-תאריך)_(.+)\.([^.]+)$/);
  if (!match) return null;
  return {
    supplierName: match[1].replace(/-/g, " "),
    catalogNumber: match[3],
  };
}

function parsePkaNotes(notes: string | null) {
  if (!notes?.startsWith(PKA_PREFIX)) return null;
  try {
    const parsed = JSON.parse(notes.slice(PKA_PREFIX.length)) as Record<string, unknown>;
    return {
      partNumber: clean(parsed.part_number),
      productName: clean(parsed.product_name),
      customerOrder: clean(parsed.customer_order),
      revision: clean(parsed.revision),
    };
  } catch {
    return null;
  }
}

export function buildFormAutocompleteSuggestions(input: {
  suppliers: SupplierSource[];
  archivedForms: ArchivedFormSource[];
  followups: FollowupSource[];
  catalogItems?: CatalogItem[];
}): FormAutocompleteSuggestions {
  const archived = input.archivedForms.flatMap((form) => {
    const parsed = parseArchivedFormFileName(form.file_name ?? "");
    return parsed ? [parsed] : [];
  });
  const pka = input.followups.flatMap((followup) => {
    const parsed = parsePkaNotes(followup.notes);
    return parsed ? [{ ...parsed, fallbackName: clean(followup.name) }] : [];
  });
  const catalogItems = pka.reduce<FormAutocompleteSuggestions["catalogItems"]>((items, item) => {
    if (!item.partNumber || !item.productName) return items;
    if (items.some((entry) => suggestionKey(entry.catalogNumber) === suggestionKey(item.partNumber))) return items;
    items.push({ catalogNumber: item.partNumber, partName: item.productName });
    return items;
  }, [...(input.catalogItems ?? [])]);

  return {
    supplierNames: uniqueSuggestions([
      ...input.suppliers.map((supplier) => supplier.supplier_name),
      ...archived.map((form) => form.supplierName),
    ]),
    catalogNumbers: uniqueSuggestions([
      ...(input.catalogItems ?? []).map(item => item.catalogNumber),
      ...archived.map((form) => form.catalogNumber),
      ...pka.map((item) => item.partNumber),
    ]),
    catalogItems,
    partNames: uniqueSuggestions([...catalogItems.map(item => item.partName), ...pka.map((item) => item.productName || item.fallbackName)]),
    orderNumbers: uniqueSuggestions(pka.map((item) => item.customerOrder)),
    revisions: uniqueSuggestions([...catalogItems.map(item => item.revision), ...pka.map((item) => item.revision)]),
  };
}
