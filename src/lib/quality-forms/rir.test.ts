import { describe, expect, it } from "vitest";

import { automaticApprovedPartCounts, drawingNumberForCatalog, evaluateMeasurementFormula, formatMeasurementForEquipment, isCaliperEquipment, measurementState, resizeMeasurementRows, resolveMeasurementInput, sampleSizeForReceivedQuantity, sampleStandardDeviation, summarizeMeasurementColumn, summarizePassFail } from "./rir";

describe("RIR calculations", () => {
  it("formats Caliper measurements with exactly two decimal places", () => {
    expect(isCaliperEquipment("Caliper")).toBe(true);
    expect(isCaliperEquipment("Digital Caliper")).toBe(true);
    expect(formatMeasurementForEquipment("34", "Caliper")).toBe("34.00");
    expect(formatMeasurementForEquipment("34.126", "Caliper")).toBe("34.13");
    expect(formatMeasurementForEquipment("34", "Micrometer")).toBe("34");
    expect(formatMeasurementForEquipment("", "Caliper")).toBe("");
  });
  it("creates the drawing number from the catalog number", () => {
    expect(drawingNumberForCatalog(" XXX ")).toBe("DG-XXX");
    expect(drawingNumberForCatalog(" ")).toBe("");
  });
  it("selects the sample size from the receiving-inspection table", () => {
    expect(sampleSizeForReceivedQuantity("1")).toBe(1);
    expect(sampleSizeForReceivedQuantity("8")).toBe(2);
    expect(sampleSizeForReceivedQuantity("9")).toBe(3);
    expect(sampleSizeForReceivedQuantity("50")).toBe(8);
    expect(sampleSizeForReceivedQuantity("51")).toBe(13);
    expect(sampleSizeForReceivedQuantity("1,200")).toBe(80);
    expect(sampleSizeForReceivedQuantity("1201")).toBe(125);
    expect(sampleSizeForReceivedQuantity("3201")).toBe(200);
    expect(sampleSizeForReceivedQuantity("")).toBeNull();
  });

  it("calculates safe Excel-style formulas for specification limits", () => {
    expect(evaluateMeasurementFormula("=0.75+0.15")).toBe(0.9);
    expect(evaluateMeasurementFormula("=(2+3)*4/2")).toBe(10);
    expect(evaluateMeasurementFormula("=1/0")).toBeNull();
    expect(evaluateMeasurementFormula("=alert(1)")).toBeNull();
    expect(resolveMeasurementInput("=0.75+0.15", "Caliper")).toBe("0.90");
    expect(resolveMeasurementInput("=0.75+0.15", "Micrometer")).toBe("0.9");
  });
  it("preserves existing measurements when the table is resized", () => {
    const initial = resizeMeasurementRows([], 2, 2);
    initial[0].values = ["10", "20"];
    initial[0].visual = "Pass";
    const resized = resizeMeasurementRows(initial, 3, 1);
    expect(resized).toHaveLength(3);
    expect(resized[0]).toMatchObject({ specimen: 1, values: ["10"], visual: "Pass" });
    expect(resized[2]).toMatchObject({ specimen: 3, values: [""], visual: "" });
  });

  it("matches the Excel sample standard deviation calculation", () => {
    expect(sampleStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138089935, 8);
    expect(sampleStandardDeviation([3])).toBeNull();
  });

  it("treats values equal to specification limits as approved", () => {
    const rows = resizeMeasurementRows([], 4, 1);
    rows[0].values[0] = "10";
    rows[1].values[0] = "15";
    rows[2].values[0] = "20";
    rows[3].values[0] = "21";
    const summary = summarizeMeasurementColumn(rows, 0, "10", "20");
    expect(summary).toMatchObject({ entered: 4, minimum: 10, maximum: 21, approved: 3, rejected: 1 });
    expect(summary.average).toBe(16.5);
  });

  it("counts Pass and Fail while ignoring blank inspections", () => {
    const rows = resizeMeasurementRows([], 3, 1);
    rows[0].visual = "Pass";
    rows[1].visual = "Fail";
    expect(summarizePassFail(rows, "visual")).toEqual({ entered: 2, approved: 1, rejected: 1 });
  });

  it("distinguishes missing, unconfigured, passing and failing measurements", () => {
    expect(measurementState("", "1", "2")).toBe("missing");
    expect(measurementState("1.5", "", "2")).toBe("unconfigured");
    expect(measurementState("1", "1", "2")).toBe("pass");
    expect(measurementState("2.1", "1", "2")).toBe("fail");
  });

  it("approves the full received quantity when every sampled inspection passes", () => {
    const attributes = [{ id: "size", name: "Size", equipment: "Caliper", min: "1", max: "2" }];
    const rows = resizeMeasurementRows([], 2, 1);
    rows.forEach((row) => { row.values[0] = "1.50"; row.visual = "Pass"; });
    expect(automaticApprovedPartCounts({ receivedQuantity: "225", attributes, rows, includeVisual: true, includeFunctional: false }))
      .toEqual({ automatic: true, approvedParts: "225", rejectedParts: "0" });
    rows[1].visual = "Fail";
    expect(automaticApprovedPartCounts({ receivedQuantity: "225", attributes, rows, includeVisual: true, includeFunctional: false }).automatic).toBe(false);
  });
});
