import { describe, expect, it } from "vitest";

import { parseDimensionTolerance } from "./dimension-tolerance";

describe("dimension tolerance parsing", () => {
  it.each([
    ["0.5", "0.45", "0.55"],
    ["6", "5.95", "6.05"],
    ["6.5", "6.4", "6.6"],
    ["30", "29.9", "30.1"],
    ["31", "30.85", "31.15"],
    ["120", "119.85", "120.15"],
    ["121", "120.8", "121.2"],
    ["400", "399.8", "400.2"],
  ])("applies the ISO 2768 linear table to %s", (input, minimum, maximum) => {
    expect(parseDimensionTolerance(input)).toMatchObject({ minimum, maximum, mode: "iso-2768" });
  });

  it.each(["0.5±0.02", "0.5+-0.02", "0.5+/-0.02", "0,5 ± 0,02"])("parses symmetric tolerance %s", (input) => {
    expect(parseDimensionTolerance(input)).toEqual({ minimum: "0.48", maximum: "0.52", mode: "symmetric" });
  });

  it("parses asymmetric upper and lower tolerances", () => {
    expect(parseDimensionTolerance("6+0.02-0.01")).toEqual({ minimum: "5.99", maximum: "6.02", mode: "asymmetric" });
  });

  it.each(["", "0.49", "401", "6+", "6-0.1", "text"])("does not guess unsupported input %s", (input) => {
    expect(parseDimensionTolerance(input)).toBeNull();
  });
});
