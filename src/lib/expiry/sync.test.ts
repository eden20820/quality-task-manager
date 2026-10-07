import { describe, expect, it } from "vitest";

import { buildFingerprint, buildSyncPreview, type ExistingExpiryItem } from "./sync";
import type { ParsedExpiryItem } from "./types";

function incoming(overrides: Partial<ParsedExpiryItem> = {}): ParsedExpiryItem {
  return {
    materialName: "חומר בדיקה",
    expiryDate: new Date("2027-01-15T00:00:00"),
    quantity: 5,
    location: "מחסן",
    invalidExpiryText: null,
    isRejected: false,
    rowNumber: 4,
    ...overrides,
  };
}

function existing(item: ParsedExpiryItem, overrides: Partial<ExistingExpiryItem> = {}): ExistingExpiryItem {
  return {
    id: "existing-id",
    fingerprint: buildFingerprint(item),
    material_name: item.materialName,
    expiry_date: "2027-01-15",
    quantity: item.quantity,
    location: item.location,
    is_rejected: item.isRejected,
    is_active: true,
    ...overrides,
  };
}

describe("expiry sync preview", () => {
  it("classifies a completely identical item as unchanged", () => {
    const item = incoming();
    const preview = buildSyncPreview([item], [existing(item)]);

    expect(preview.unchangedItems).toHaveLength(1);
    expect(preview.updatedItems).toHaveLength(0);
  });

  it("detects quantity, location, rejected-state and reactivation changes", () => {
    const item = incoming({ quantity: 8, location: "QC", isRejected: true });
    const preview = buildSyncPreview([item], [existing(item, {
      quantity: 5,
      location: "מחסן",
      is_rejected: false,
      is_active: false,
    })]);

    expect(preview.updatedItems).toHaveLength(1);
    expect(preview.unchangedItems).toHaveLength(0);
  });
});
