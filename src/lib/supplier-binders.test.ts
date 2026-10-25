import { describe, expect, it } from "vitest";

import {
  findSupplierRecord,
  isSupplierSearchMatch,
  normalizeSupplierName,
  supplierBinders,
  supplierNameScore,
} from "./supplier-binders";

describe("supplier binder catalogue", () => {
  it("keeps binders in chronological order", () => {
    expect(supplierBinders.map((binder) => binder.label)).toEqual(["I", "II", "III", "IV-B", "V", "VI-B", "VII-B", "VIII-B"]);
    expect(supplierBinders.reduce((total, binder) => total + binder.suppliers.length, 0)).toBe(65);
  });

  it("normalizes punctuation, spaces, case and Hebrew final letters", () => {
    expect(normalizeSupplierName("Door Net")).toBe(normalizeSupplierName("door-net"));
    expect(normalizeSupplierName("שמיים")).toBe(normalizeSupplierName("שמיימ"));
  });

  it("finds Nautec in Hebrew, English and with a common spelling variation", () => {
    const nautec = supplierBinders[3].suppliers[3];
    expect(isSupplierSearchMatch("NAUTEC", nautec)).toBe(true);
    expect(isSupplierSearchMatch("נאוטק", nautec)).toBe(true);
    expect(isSupplierSearchMatch("נאותק", nautec)).toBe(true);
    expect(isSupplierSearchMatch("נאוטכ", nautec)).toBe(true);
  });

  it("does not confuse short supplier names", () => {
    expect(supplierNameScore("AMI", "LMI")).toBeLessThan(82);
    expect(isSupplierSearchMatch("AMI", { name: "LMI" })).toBe(false);
  });

  it("matches Hebrew and English transliterations", () => {
    expect(isSupplierSearchMatch("ALON", { name: "אלון טכנולוגיות" })).toBe(true);
    expect(isSupplierSearchMatch("אלון", { name: "Alon Technologies" })).toBe(true);
  });

  it("links a binder entry to an exact or aliased supplier record", () => {
    const suppliers = [
      { id: "1", supplier_name: "נאותק", status: "Approved", expiration_date: "2028-04-22" },
      { id: "2", supplier_name: "ספק אחר", status: "Approved", expiration_date: null },
    ];
    expect(findSupplierRecord(supplierBinders[3].suppliers[3], suppliers)?.id).toBe("1");
  });

  it("prefers a manually linked supplier over name matching", () => {
    const suppliers = [
      { id: "1", supplier_name: "Nautec", status: "Approved", expiration_date: null },
      { id: "2", supplier_name: "הספק הנכון בעברית", status: "Approved", expiration_date: "2028-04-22" },
    ];
    expect(findSupplierRecord({ name: "Nautec", supplierId: "2" }, suppliers)?.id).toBe("2");
  });
});
