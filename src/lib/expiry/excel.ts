import { parseWorksheet } from "./parser";

import { ParsedExpiryItem } from "./types";

export async function parseExpiryExcel(
  file: File
): Promise<ParsedExpiryItem[]> {

  const buffer =
    await file.arrayBuffer();

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer);

  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];

  return parseWorksheet(sheet);

}
