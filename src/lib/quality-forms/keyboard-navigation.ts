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
