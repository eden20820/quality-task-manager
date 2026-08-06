import { ParsedExpiryItem, ValidationError } from "./types";

export function validateItems(
  items: ParsedExpiryItem[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const fingerprints = new Set<string>();

  items.forEach((item) => {
    if (!item.materialName.trim()) {
      errors.push({
        row: item.rowNumber,
        message: "שם חומר חסר",
      });
    }

    if (item.invalidExpiryText) {
      errors.push({
        row: item.rowNumber,
        message: `תאריך לא תקין: ${item.invalidExpiryText}`,
      });
    }

    if (item.quantity !== null && item.quantity < 0) {
      errors.push({
        row: item.rowNumber,
        message: "כמות שלילית",
      });
    }

    const fingerprint = `${item.materialName.toLowerCase()}|${
      item.expiryDate
        ? item.expiryDate.toISOString().slice(0, 10)
        : item.invalidExpiryText ?? ""
    }`;

    if (fingerprints.has(fingerprint)) {
      errors.push({
        row: item.rowNumber,
        message: "רשומה כפולה בקובץ",
      });
    } else {
      fingerprints.add(fingerprint);
    }
  });

  return errors;
}