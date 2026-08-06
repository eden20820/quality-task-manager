import * as XLSX from "xlsx";

import { parseWorksheet } from "./parser";

import { ParsedExpiryItem } from "./types";

export async function parseExpiryExcel(
  file: File
): Promise<ParsedExpiryItem[]> {

  const buffer =
    await file.arrayBuffer();

  const workbook =
    XLSX.read(buffer);

  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];

  return parseWorksheet(sheet);

}