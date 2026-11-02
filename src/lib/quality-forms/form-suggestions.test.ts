import { describe, expect, it } from "vitest";

import { buildFormAutocompleteSuggestions, parseArchivedFormFileName } from "./form-suggestions";

describe("quality form autocomplete suggestions", () => {
  it("extracts supplier and catalog values from archived form names", () => {
    expect(parseArchivedFormFileName("Test-Supplier_2026-11-02_CAT-100.xlsx")).toEqual({
      supplierName: "Test Supplier",
      catalogNumber: "CAT-100",
    });
  });

  it("combines suppliers, archived forms and PKA data without duplicate variants", () => {
    const suggestions = buildFormAutocompleteSuggestions({
      suppliers: [{ supplier_name: "Test Supplier" }, { supplier_name: "LMI" }],
      archivedForms: [
        { file_name: "Test-Supplier_2026-11-02_CAT-100.xlsx" },
        { file_name: "Legacy-Supplier_2026-10-30_OLD-20.xlsx" },
      ],
      followups: [{
        name: "Part from followup",
        notes: `PKA_IMPORT_JSON:${JSON.stringify({ part_number: "CAT 100", product_name: "Rotor", customer_order: "PO-7", revision: "02" })}`,
      }],
    });

    expect(suggestions.supplierNames).toEqual(["Test Supplier", "LMI", "Legacy Supplier"]);
    expect(suggestions.catalogNumbers).toEqual(["CAT-100", "OLD-20"]);
    expect(suggestions.partNames).toEqual(["Rotor"]);
    expect(suggestions.orderNumbers).toEqual(["PO-7"]);
    expect(suggestions.revisions).toEqual(["02"]);
  });

  it("ignores malformed historical metadata", () => {
    const suggestions = buildFormAutocompleteSuggestions({
      suppliers: [],
      archivedForms: [{ file_name: "unrelated.pdf" }],
      followups: [{ name: "Fallback", notes: "PKA_IMPORT_JSON:not-json" }],
    });
    expect(suggestions).toEqual({ supplierNames: [], catalogNumbers: [], partNames: [], orderNumbers: [], revisions: [] });
  });
});
