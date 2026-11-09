import { measurementState } from "./rir";

export function automaticMeasurementTarget(input: {
  value: string;
  minimum: string;
  maximum: string;
  row: number;
  column: number;
  rowCount: number;
  columnCount: number;
  inputType: string;
  isComposing: boolean;
  caretAtEnd: boolean;
}) {
  // Only deliberate typing of a finished decimal advances focus. Pasting,
  // deleting, formulas, composition and edits in the middle keep their caret.
  if (input.inputType !== "insertText" || input.isComposing || !input.caretAtEnd) return null;
  if (!/^[+-]?\d+[.,]\d{2}$/.test(input.value)) return null;
  if (measurementState(input.value, input.minimum, input.maximum) !== "pass") return null;
  return measurementNavigationTarget({ ...input, key: "ArrowDown" });
}

export type MeasurementNavigationKey = "Enter" | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export function measurementNavigationTarget(input: {
  row: number;
  column: number;
  rowCount: number;
  columnCount: number;
  key: MeasurementNavigationKey;
  shiftKey?: boolean;
}) {
  const { row, column, rowCount, columnCount, key, shiftKey = false } = input;
  if (rowCount <= 0 || columnCount <= 0) return null;

  let targetRow = row;
  let targetColumn = column;
  if (key === "Enter") {
    const offset = shiftKey ? -1 : 1;
    const flatIndex = row * columnCount + column + offset;
    if (flatIndex < 0 || flatIndex >= rowCount * columnCount) return null;
    targetRow = Math.floor(flatIndex / columnCount);
    targetColumn = flatIndex % columnCount;
  } else if (key === "ArrowUp") {
    targetRow -= 1;
  } else if (key === "ArrowDown") {
    targetRow += 1;
  } else if (key === "ArrowLeft") {
    targetColumn += 1;
  } else if (key === "ArrowRight") {
    targetColumn -= 1;
  }

  if (targetRow < 0 || targetRow >= rowCount || targetColumn < 0 || targetColumn >= columnCount) return null;
  return { row: targetRow, column: targetColumn };
}
