export type CatalogItem = { catalogNumber: string; partName: string; revision?: string };
export const catalogKey = (value: string) => value.normalize("NFKC").replace(/[\u200e\u200f\u202a-\u202e]/g, "").toLocaleLowerCase("he-IL").replace(/[\s_.\-/\\]+/g, "");

export function normalizeCatalog(items: CatalogItem[]) {
  const result: CatalogItem[] = [];
  for (const item of items) {
    const same = result.find(existing => catalogKey(existing.catalogNumber) === catalogKey(item.catalogNumber) && catalogKey(existing.partName) === catalogKey(item.partName) && (!existing.revision || !item.revision || existing.revision === item.revision));
    if (same) same.revision ||= item.revision;
    else result.push({ catalogNumber: item.catalogNumber, partName: item.partName, revision: item.revision ?? "" });
  }
  return result;
}

export function matchingCatalogItems(items: CatalogItem[], field: "catalogNumber" | "partName", value: string, exact = false) {
  const query = catalogKey(value);
  if (!query) return [];
  return items.filter(item => exact ? catalogKey(item[field]) === query : catalogKey(item[field]).includes(query));
}

export function resolveCatalogItem(items: CatalogItem[], field: "catalogNumber" | "partName", value: string): CatalogItem | null {
  const matches = normalizeCatalog(matchingCatalogItems(items, field, value, true));
  return matches.length === 1 ? matches[0] : null;
}
