import { ParsedExpiryItem } from "./types";

export type ExistingExpiryItem = {
  id: string;
  fingerprint: string;
  material_name: string;
  expiry_date: string | null;
  quantity: number | null;
  location: string | null;
  is_active: boolean;
};

export type SyncPreview = {
  newItems: ParsedExpiryItem[];
  updatedItems: {
    current: ExistingExpiryItem;
    incoming: ParsedExpiryItem;
  }[];
  unchangedItems: ParsedExpiryItem[];
  inactiveItems: ExistingExpiryItem[];
  invalidItems: ParsedExpiryItem[];
};

export function buildFingerprint(item: ParsedExpiryItem) {
  return `${item.materialName.trim().toLowerCase()}|${
    item.expiryDate
      ? item.expiryDate.toISOString().slice(0, 10)
      : item.invalidExpiryText ?? ""
  }`;
}

export function buildSyncPreview(
  excelItems: ParsedExpiryItem[],
  dbItems: ExistingExpiryItem[]
): SyncPreview {

  const preview: SyncPreview = {
    newItems: [],
    updatedItems: [],
    unchangedItems: [],
    inactiveItems: [],
    invalidItems: [],
  };

  const dbMap = new Map(
    dbItems.map(item => [item.fingerprint, item])
  );

  const excelFingerprints = new Set<string>();

  for (const item of excelItems) {

    if (item.invalidExpiryText) {
      preview.invalidItems.push(item);
      continue;
    }

    const fingerprint = buildFingerprint(item);

    excelFingerprints.add(fingerprint);

    const existing = dbMap.get(fingerprint);

    if (!existing) {

      preview.newItems.push(item);

      continue;
    }

    const changed =
      existing.quantity !== item.quantity ||
      (existing.location ?? "") !== item.location;

    if (changed) {

      preview.updatedItems.push({
        current: existing,
        incoming: item,
      });

    } else {

      preview.unchangedItems.push(item);

    }
  }

  for (const dbItem of dbItems) {

    if (
      dbItem.is_active &&
      !excelFingerprints.has(dbItem.fingerprint)
    ) {

      preview.inactiveItems.push(dbItem);

    }
  }

  return preview;
}