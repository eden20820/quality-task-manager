import { describe, expect, it } from "vitest";

import { measurementNavigationTarget } from "./keyboard-navigation";

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
