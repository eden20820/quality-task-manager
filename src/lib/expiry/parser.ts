import * as XLSX from "xlsx";

import type { ParsedExpiryItem } from "./types";

type ParsedDate = {
  date: Date | null;
  invalid: string | null;
};

function normalizeCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeHeader(value: unknown): string {
  return normalizeCell(value)
    .replace(/[.\-_]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isMaterialHeader(value: unknown): boolean {
  const text = normalizeHeader(value);

  return text === "חומר" || text.includes("שםחומר");
}

function isExpiryHeader(value: unknown): boolean {
  const text = normalizeHeader(value);

  return (
    text.includes("תפוגה") ||
    text.includes("תוקף") ||
    text.includes("תאריךתפוגה")
  );
}

function isQuantityHeader(value: unknown): boolean {
  return normalizeHeader(value).includes("כמות");
}

function isLocationHeader(value: unknown): boolean {
  return normalizeHeader(value).includes("מיקום");
}

function isRejectedSection(value: unknown): boolean {
  return normalizeCell(value).includes("חומרים שנפסלו");
}

function excelSerialToDate(serial: number): Date | null {
  const parsed = XLSX.SSF.parse_date_code(serial);

  if (!parsed) {
    return null;
  }

  const result = new Date(
    parsed.y,
    parsed.m - 1,
    parsed.d,
    parsed.H ?? 0,
    parsed.M ?? 0,
    Math.floor(parsed.S ?? 0)
  );

  return Number.isNaN(result.getTime()) ? null : result;
}

function createStrictDate(
  year: number,
  month: number,
  day: number
): Date | null {
  const date = new Date(year, month - 1, day);

  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isValid ? date : null;
}

function parseTextDate(text: string): Date | null {
  const cleaned = text.trim();

  const dayFirstMatch = cleaned.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
  );

  if (dayFirstMatch) {
    const [, dayText, monthText, yearText] = dayFirstMatch;

    return createStrictDate(
      Number(yearText),
      Number(monthText),
      Number(dayText)
    );
  }

  const isoMatch = cleaned.match(
    /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/
  );

  if (isoMatch) {
    const [, yearText, monthText, dayText] = isoMatch;

    return createStrictDate(
      Number(yearText),
      Number(monthText),
      Number(dayText)
    );
  }

  return null;
}

function parseDate(value: unknown): ParsedDate {
  if (
    value === null ||
    value === undefined ||
    normalizeCell(value) === ""
  ) {
    return {
      date: null,
      invalid: null,
    };
  }

  if (typeof value === "number") {
    const date = excelSerialToDate(value);

    return date
      ? {
          date,
          invalid: null,
        }
      : {
          date: null,
          invalid: String(value),
        };
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? {
          date: null,
          invalid: String(value),
        }
      : {
          date: value,
          invalid: null,
        };
  }

  const text = normalizeCell(value);
  const date = parseTextDate(text);

  return date
    ? {
        date,
        invalid: null,
      }
    : {
        date: null,
        invalid: text,
      };
}

function parseQuantity(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    normalizeCell(value) === ""
  ) {
    return null;
  }

  const quantity = Number(value);

  return Number.isFinite(quantity) ? quantity : null;
}

export function parseWorksheet(
  worksheet: XLSX.WorkSheet
): ParsedExpiryItem[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const result: ParsedExpiryItem[] = [];

  let materialColumn = -1;
  let expiryColumn = -1;
  let quantityColumn = -1;
  let locationColumn = -1;
  let isRejected = false;
  let hasHeader = false;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    if (!Array.isArray(row)) {
      continue;
    }

    const firstCell = normalizeCell(row[0]);

    if (isRejectedSection(firstCell)) {
      isRejected = true;

      materialColumn = 0;
      expiryColumn = 1;
      quantityColumn = 2;
      locationColumn = -1;
      hasHeader = true;

      continue;
    }

    const detectedMaterialColumn = row.findIndex(isMaterialHeader);
    const detectedExpiryColumn = row.findIndex(isExpiryHeader);

    if (
      detectedMaterialColumn !== -1 &&
      detectedExpiryColumn !== -1
    ) {
      materialColumn = detectedMaterialColumn;
      expiryColumn = detectedExpiryColumn;
      quantityColumn = row.findIndex(isQuantityHeader);
      locationColumn = row.findIndex(isLocationHeader);
      hasHeader = true;

      continue;
    }

    if (!hasHeader) {
      continue;
    }

    const isEmptyRow = row.every(
      (cell) => normalizeCell(cell) === ""
    );

    if (isEmptyRow) {
      continue;
    }

    const materialName = normalizeCell(row[materialColumn]);

    if (!materialName) {
      continue;
    }

    const parsedExpiry = parseDate(row[expiryColumn]);

    result.push({
      materialName,
      expiryDate: parsedExpiry.date,
      quantity:
        quantityColumn >= 0
          ? parseQuantity(row[quantityColumn])
          : null,
      location:
        !isRejected && locationColumn >= 0
          ? normalizeCell(row[locationColumn])
          : "",
      invalidExpiryText: parsedExpiry.invalid,
      isRejected,
      rowNumber: rowIndex + 1,
    });
  }

  return result;
}