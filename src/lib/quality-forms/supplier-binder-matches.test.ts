import { describe, expect, it } from "vitest";
import { findSupplierBinderMatches } from "./supplier-binder-matches";

const directory = [
  { binderLabel: "IV", name: "Nautec", aliases: ["נאוטק", "נאותק"] },
  { binderLabel: "VI", name: "Nautec" },
  { binderLabel: "I", name: "Other supplier" },
];

describe("supplier binder matches", () => {
  it("matches case and Hebrew aliases, including suppliers in multiple binders", () => {
    expect(findSupplierBinderMatches("nautec", directory).map((entry) => entry.binderLabel)).toEqual(["IV", "VI"]);
    expect(findSupplierBinderMatches("נאותק", directory)[0].binderLabel).toBe("IV");
  });
  it("does not assign a binder for blank, too short or unknown names", () => {
    for (const name of ["", " ", "N", "zzzzzzzzzzzzzz"]) expect(findSupplierBinderMatches(name, directory)).toEqual([]);
    expect(findSupplierBinderMatches("Nautec", [])).toEqual([]);
  });
});
