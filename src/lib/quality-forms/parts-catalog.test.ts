import { describe, expect, it } from "vitest";
import { matchingCatalogItems, normalizeCatalog, resolveCatalogItem } from "./parts-catalog";
import { buildFormAutocompleteSuggestions } from "./form-suggestions";
const fixtures = [
  { catalogNumber: "TEST-PART-001", partName: "Sample housing", revision: "09" },
  { catalogNumber: "TEST-PART-002", partName: "Sample cover", revision: "00" },
  { catalogNumber: "TEST-PART-003", partName: "Sample plug", revision: "00" },
  { catalogNumber: "TEST-PART-003", partName: "Sample plug", revision: "01" },
];
describe("shared parts catalog", () => {
  it("retains leading-zero revisions and matches names in reverse", () => {
    const items = normalizeCatalog(fixtures);
    expect(resolveCatalogItem(items, "catalogNumber", "test part 001")).toMatchObject({ partName: "Sample housing", revision: "09" });
    expect(resolveCatalogItem(items, "partName", " SAMPLE COVER ")).toMatchObject({ catalogNumber: "TEST-PART-002", revision: "00" });
  });
  it("whitelists only catalog number, name and revision", () => {
    const unexpected = { catalogNumber: "TEST-1", partName: "Sample", revision: "00", price: 99, supplier: "Private" };
    expect(normalizeCatalog([unexpected])).toEqual([{ catalogNumber: "TEST-1", partName: "Sample", revision: "00" }]);
    expect(matchingCatalogItems(fixtures, "partName", "")).toEqual([]);
    expect(matchingCatalogItems(fixtures, "partName", "sample")).toHaveLength(4);
  });
  it("does not silently choose conflicting names or revisions", () => {
    expect(resolveCatalogItem(fixtures, "catalogNumber", "TEST-PART-003")).toBeNull();
    expect(matchingCatalogItems(fixtures, "catalogNumber", "TEST-PART-003", true)).toHaveLength(2);
    expect(normalizeCatalog(fixtures)).toHaveLength(4);
  });
  it("makes catalog items available alongside existing form history", () => {
    const result = buildFormAutocompleteSuggestions({ catalogItems: fixtures, suppliers: [], archivedForms: [], followups: [] });
    expect(result.catalogNumbers).toContain("TEST-PART-001");
    expect(result.partNames).toContain("Sample housing");
    expect(result.revisions).toContain("09");
  });
});
