import { entrySearchScore, isSupplierSearchMatch, normalizeSupplierName, type SupplierBinderDirectoryEntry } from "@/lib/supplier-binders";

// Share the same name/alias matching between the on-screen notice and RIR export.
export function findSupplierBinderMatches(supplierName: string, directory: SupplierBinderDirectoryEntry[]) {
  if (normalizeSupplierName(supplierName).length < 2) return [];
  const matching = directory
    .filter((entry) => isSupplierSearchMatch(supplierName, entry))
    .map((entry) => ({ ...entry, score: entrySearchScore(supplierName, entry) }))
    .sort((left, right) => right.score - left.score);
  if (!matching.length) return [];
  return matching.filter((entry) => entry.score >= matching[0].score - 4).slice(0, 4);
}
