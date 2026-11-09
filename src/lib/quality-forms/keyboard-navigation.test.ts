import { describe, expect, it } from "vitest";

import { automaticMeasurementTarget, measurementNavigationTarget } from "./keyboard-navigation";

describe("automatic RIR decimal entry", () => {
  const input = { value: "12.34", minimum: "12", maximum: "13", row: 0, column: 1, rowCount: 3, columnCount: 2, inputType: "insertText", isComposing: false, caretAtEnd: true };
  it("advances down the same column only for a green completed decimal", () => {
    expect(automaticMeasurementTarget(input)).toEqual({ row: 1, column: 1 });
    expect(automaticMeasurementTarget({ ...input, value: "12.00" })).toEqual({ row: 1, column: 1 });
    expect(automaticMeasurementTarget({ ...input, value: "13.00" })).toEqual({ row: 1, column: 1 });
    expect(automaticMeasurementTarget({ ...input, value: "-0.25", minimum: "-1", maximum: "0" })).toEqual({ row: 1, column: 1 });
  });
  it.each(["12", "12.", "12.3", "12.345", "=12+0.34", "13.01", "11.99", "N/A", ""])("keeps focus for incomplete, formula or failing input %s", (value) => {
    expect(automaticMeasurementTarget({ ...input, value })).toBeNull();
  });
  it("keeps the final row in place rather than wrapping to another column", () => {
    expect(automaticMeasurementTarget({ ...input, row: 2 })).toBeNull();
  });
  it("does not advance on paste, deletion, composition or mid-value edits", () => {
    expect(automaticMeasurementTarget({ ...input, inputType: "insertFromPaste" })).toBeNull();
    expect(automaticMeasurementTarget({ ...input, inputType: "deleteContentBackward" })).toBeNull();
    expect(automaticMeasurementTarget({ ...input, isComposing: true })).toBeNull();
    expect(automaticMeasurementTarget({ ...input, caretAtEnd: false })).toBeNull();
    expect(automaticMeasurementTarget({ ...input, minimum: "" })).toBeNull();
  });
});

describe("RIR measurement keyboard navigation", () => {
  it("moves through a row and then wraps to the first cell on the next row", () => {
    expect(measurementNavigationTarget({ row: 0, column: 0, rowCount: 3, columnCount: 2, key: "Enter" })).toEqual({ row: 0, column: 1 });
    expect(measurementNavigationTarget({ row: 0, column: 1, rowCount: 3, columnCount: 2, key: "Enter" })).toEqual({ row: 1, column: 0 });
  });

  it("moves backwards with Shift+Enter", () => {
    expect(measurementNavigationTarget({ row: 1, column: 0, rowCount: 3, columnCount: 2, key: "Enter", shiftKey: true })).toEqual({ row: 0, column: 1 });
  });

  it("uses spreadsheet arrows and stays put at an outer edge", () => {
    expect(measurementNavigationTarget({ row: 1, column: 0, rowCount: 3, columnCount: 2, key: "ArrowDown" })).toEqual({ row: 2, column: 0 });
    expect(measurementNavigationTarget({ row: 1, column: 0, rowCount: 3, columnCount: 2, key: "ArrowLeft" })).toEqual({ row: 1, column: 1 });
    expect(measurementNavigationTarget({ row: 0, column: 0, rowCount: 3, columnCount: 2, key: "ArrowUp" })).toBeNull();
  });
});
