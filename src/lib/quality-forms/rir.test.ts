import { describe, expect, it } from "vitest";

import { measurementState, resizeMeasurementRows, sampleStandardDeviation, summarizeMeasurementColumn, summarizePassFail } from "./rir";

describe("RIR calculations", () => {
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
});
