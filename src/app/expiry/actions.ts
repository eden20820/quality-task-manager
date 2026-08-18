"use server";

import { revalidatePath } from "next/cache";

import { parseExpiryExcel } from "@/lib/expiry/excel";
import {
  buildFingerprint,
  buildSyncPreview,
  type ExistingExpiryItem,
} from "@/lib/expiry/sync";
import type { ParsedExpiryItem } from "@/lib/expiry/types";
import { validateItems } from "@/lib/expiry/validator";
import { createClient } from "@/lib/supabase/server";

export type SerializableExpiryItem = {
  materialName: string;
  expiryDate: string | null;
  quantity: number | null;
  location: string;
  invalidExpiryText: string | null;
  isRejected: boolean;
  rowNumber: number;
};

export type ExpiryImportPreview = {
  fileName: string;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  inactiveCount: number;
  invalidCount: number;
  items: SerializableExpiryItem[];
  errors: {
    row: number;
    message: string;
  }[];
};

export type ManualExpiryActionResult = {
  success: boolean;
  message: string;
  item?: {
    id: string;
    materialName: string;
    expiryDate: string;
    quantity: number | null;
    location: string;
    isRejected: boolean;
  };
};

async function getAuthorizedClient() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", userId)
    .single();

  if (error || !profile?.is_active) {
    throw new Error("User is not active");
  }

  return { supabase, user: { id: userId } };
}

function serializeItem(
  item: ParsedExpiryItem
): SerializableExpiryItem {
  return {
    materialName: item.materialName,
    expiryDate: item.expiryDate
      ? item.expiryDate.toISOString()
      : null,
    quantity: item.quantity,
    location: item.location,
    invalidExpiryText: item.invalidExpiryText,
    isRejected: item.isRejected,
    rowNumber: item.rowNumber,
  };
}

function deserializeItem(
  item: SerializableExpiryItem
): ParsedExpiryItem {
  return {
    materialName: item.materialName,
    expiryDate: item.expiryDate
      ? new Date(item.expiryDate)
      : null,
    quantity: item.quantity,
    location: item.location,
    invalidExpiryText: item.invalidExpiryText,
    isRejected: item.isRejected,
    rowNumber: item.rowNumber,
  };
}

function parseManualExpiryItem(formData: FormData): {
  item: ParsedExpiryItem;
  expiryDateValue: string;
} {
  const materialName = String(
    formData.get("material_name") ?? ""
  ).trim();

  const expiryDateValue = String(
    formData.get("expiry_date") ?? ""
  ).trim();

  const quantityText = String(
    formData.get("quantity") ?? ""
  ).trim();

  const location = String(
    formData.get("location") ?? ""
  ).trim();

  const isRejected =
    String(formData.get("is_rejected") ?? "") === "true";

  if (!materialName) {
    throw new Error("יש להזין שם חומר");
  }

  if (!expiryDateValue) {
    throw new Error("יש להזין תאריך תפוגה");
  }

  const expiryDate = new Date(
    `${expiryDateValue}T00:00:00`
  );

  if (Number.isNaN(expiryDate.getTime())) {
    throw new Error("תאריך התפוגה אינו תקין");
  }

  let quantity: number | null = null;

  if (quantityText !== "") {
    quantity = Number(quantityText);

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error("הכמות חייבת להיות מספר שאינו שלילי");
    }
  }

  return {
    expiryDateValue,
    item: {
      materialName,
      expiryDate,
      quantity,
      location,
      invalidExpiryText: null,
      isRejected,
      rowNumber: 0,
    },
  };
}

export async function previewExpiryImport(
  formData: FormData
): Promise<ExpiryImportPreview> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("לא נבחר קובץ");
  }

  const fileName = file.name.toLowerCase();

  if (
    !fileName.endsWith(".xlsx") &&
    !fileName.endsWith(".xls")
  ) {
    throw new Error(
      "יש לבחור קובץ Excel מסוג XLSX או XLS"
    );
  }

  const { supabase } = await getAuthorizedClient();

  const parsedItems = await parseExpiryExcel(file);
  const validationErrors = validateItems(parsedItems);

  const { data: existingItems, error } = await supabase
    .from("expiry_items")
    .select(`
      id,
      fingerprint,
      material_name,
      expiry_date,
      quantity,
      location,
      is_active
    `);

  if (error) {
    console.error("Load expiry items error:", error);
    throw new Error("לא ניתן לקרוא את מאגר החומרים");
  }

  const validExistingItems = (existingItems ?? []).filter(
    (
      item
    ): item is ExistingExpiryItem & {
      fingerprint: string;
    } => Boolean(item.fingerprint)
  );

  const preview = buildSyncPreview(
    parsedItems,
    validExistingItems
  );

  return {
    fileName: file.name,
    newCount: preview.newItems.length,
    updatedCount: preview.updatedItems.length,
    unchangedCount: preview.unchangedItems.length,
    inactiveCount: preview.inactiveItems.length,
    invalidCount: validationErrors.length,
    items: parsedItems.map(serializeItem),
    errors: validationErrors,
  };
}

export async function confirmExpiryImport(
  serializedItems: SerializableExpiryItem[],
  fileName: string
) {
  const { supabase, user } = await getAuthorizedClient();

  const parsedItems = serializedItems.map(deserializeItem);
  const validationErrors = validateItems(parsedItems);

  const invalidRows = new Set(
    validationErrors.map((error) => error.row)
  );

  const validItems = parsedItems.filter(
    (item) =>
      !invalidRows.has(item.rowNumber) &&
      !item.invalidExpiryText &&
      item.expiryDate
  );

  const incomingFingerprints =
    validItems.map(buildFingerprint);
  const incomingFingerprintSet = new Set(
    incomingFingerprints
  );

  const importedAt = new Date().toISOString();

  const { data: existingItems, error: existingError } =
    await supabase
      .from("expiry_items")
      .select(
        "id, fingerprint, quantity, location, is_rejected, is_active"
      );

  if (existingError) {
    console.error(
      "Load existing expiry items error:",
      existingError
    );

    throw new Error(
      "לא ניתן לקרוא את הנתונים הקיימים"
    );
  }

  const existingMap = new Map(
    (existingItems ?? [])
      .filter((item) => item.fingerprint)
      .map((item) => [
        item.fingerprint as string,
        item,
      ])
  );

  let insertedRows = 0;
  let updatedRows = 0;
  let unchangedRows = 0;

  const newRows: Array<Record<string, unknown>> = [];
  const rowsToUpdate: Array<{
    id: string;
    values: Record<string, unknown>;
    rowNumber: number;
  }> = [];

  for (const item of validItems) {
    const fingerprint = buildFingerprint(item);
    const existing = existingMap.get(fingerprint);

    const expiryDate = item.expiryDate
      ? item.expiryDate.toISOString().slice(0, 10)
      : null;

    if (!existing) {
      newRows.push({
        material_name: item.materialName,
        expiry_date: expiryDate,
        quantity: item.quantity,
        location: item.location || null,
        invalid_expiry_text: null,
        is_rejected: item.isRejected,
        is_active: true,
        fingerprint,
        row_key: fingerprint,
        source_file_name: fileName,
        source_row_number: item.rowNumber,
        created_by: user.id,
        last_seen_at: importedAt,
      });

      insertedRows += 1;
      continue;
    }

    const hasChanged =
      existing.quantity !== item.quantity ||
      (existing.location ?? "") !== item.location ||
      existing.is_rejected !== item.isRejected ||
      existing.is_active !== true;

    rowsToUpdate.push({
      id: existing.id,
      rowNumber: item.rowNumber,
      values: {
        quantity: item.quantity,
        location: item.location || null,
        is_rejected: item.isRejected,
        is_active: true,
        source_file_name: fileName,
        source_row_number: item.rowNumber,
        last_seen_at: importedAt,
      },
    });

    if (hasChanged) {
      updatedRows += 1;
    } else {
      unchangedRows += 1;
    }
  }

  if (newRows.length > 0) {
    const { error } = await supabase.from("expiry_items").insert(newRows);
    if (error) {
      console.error("Bulk insert expiry items error:", error);
      throw new Error("נכשלה הוספת החומרים החדשים");
    }
  }

  const updateBatchSize = 20;
  for (let index = 0; index < rowsToUpdate.length; index += updateBatchSize) {
    const batch = rowsToUpdate.slice(index, index + updateBatchSize);
    const results = await Promise.all(
      batch.map((row) =>
        supabase
          .from("expiry_items")
          .update(row.values)
          .eq("id", row.id)
      )
    );
    const failedIndex = results.findIndex(
      (result) => result.error
    );
    if (failedIndex >= 0) {
      console.error("Update expiry item error:", results[failedIndex].error);
      throw new Error(`נכשל עדכון החומר בשורה ${batch[failedIndex].rowNumber}`);
    }
  }

  let inactiveRows = 0;

  const activeItemsToDisable = (
    existingItems ?? []
  ).filter(
    (item) =>
      item.is_active &&
      item.fingerprint &&
      !incomingFingerprintSet.has(item.fingerprint)
  );

  if (activeItemsToDisable.length > 0) {
    const ids = activeItemsToDisable.map(
      (item) => item.id
    );

    const { error } = await supabase
      .from("expiry_items")
      .update({
        is_active: false,
      })
      .in("id", ids);

    if (error) {
      console.error(
        "Deactivate expiry items error:",
        error
      );

      throw new Error(
        "נכשלה השבתת חומרים שלא הופיעו בקובץ"
      );
    }

    inactiveRows = ids.length;
  }

  const { error: importLogError } = await supabase
    .from("expiry_imports")
    .insert({
      file_name: fileName,
      uploaded_by: user.id,
      total_rows: parsedItems.length,
      inserted_rows: insertedRows,
      updated_rows: updatedRows,
      unchanged_rows: unchangedRows,
      invalid_rows: validationErrors.length,
    });

  if (importLogError) {
    console.error(
      "Create expiry import log error:",
      importLogError
    );
  }

  revalidatePath("/expiry");

  return {
    insertedRows,
    updatedRows,
    unchangedRows,
    inactiveRows,
    invalidRows: validationErrors.length,
  };
}

export async function createExpiryItem(
  formData: FormData
): Promise<ManualExpiryActionResult> {
  try {
    const { supabase, user } =
      await getAuthorizedClient();

    const { item, expiryDateValue } =
      parseManualExpiryItem(formData);

    const fingerprint = buildFingerprint(item);
    const timestamp = new Date().toISOString();

    const { data: duplicate, error: duplicateError } =
      await supabase
        .from("expiry_items")
        .select("id")
        .eq("fingerprint", fingerprint)
        .maybeSingle();

    if (duplicateError) {
      console.error(
        "Check duplicate expiry item error:",
        duplicateError
      );

      return {
        success: false,
        message:
          "לא ניתן לבדוק אם החומר כבר קיים",
      };
    }

    if (duplicate) {
      return {
        success: false,
        message:
          "כבר קיים חומר עם אותו שם ותאריך תפוגה",
      };
    }

    const { data: created, error } = await supabase
      .from("expiry_items")
      .insert({
        material_name: item.materialName,
        expiry_date: expiryDateValue,
        quantity: item.quantity,
        location: item.location || null,
        invalid_expiry_text: null,
        is_rejected: item.isRejected,
        is_active: true,
        fingerprint,
        row_key: fingerprint,
        source_file_name: "הזנה ידנית",
        source_row_number: null,
        created_by: user.id,
        first_imported_at: timestamp,
        last_seen_at: timestamp,
      })
      .select("id")
      .single();

    if (error) {
      console.error(
        "Create manual expiry item error:",
        error
      );

      return {
        success: false,
        message: "שמירת החומר נכשלה",
      };
    }

    return {
      success: true,
      message: "החומר נוסף בהצלחה",
      item: {
        id: created.id,
        materialName: item.materialName,
        expiryDate: expiryDateValue,
        quantity: item.quantity,
        location: item.location,
        isRejected: item.isRejected,
      },
    };
  } catch (error) {
    console.error(
      "Create expiry item action error:",
      error
    );

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "שמירת החומר נכשלה",
    };
  }
}

export async function updateExpiryItem(
  formData: FormData
): Promise<ManualExpiryActionResult> {
  try {
    const itemId = String(
      formData.get("item_id") ?? ""
    ).trim();

    if (!itemId) {
      return {
        success: false,
        message: "מזהה החומר חסר",
      };
    }

    const { supabase } =
      await getAuthorizedClient();

    const { item, expiryDateValue } =
      parseManualExpiryItem(formData);

    const fingerprint = buildFingerprint(item);
    const timestamp = new Date().toISOString();

    const { data: duplicate, error: duplicateError } =
      await supabase
        .from("expiry_items")
        .select("id")
        .eq("fingerprint", fingerprint)
        .neq("id", itemId)
        .maybeSingle();

    if (duplicateError) {
      console.error(
        "Check duplicate edited expiry item error:",
        duplicateError
      );

      return {
        success: false,
        message:
          "לא ניתן לבדוק אם החומר כבר קיים",
      };
    }

    if (duplicate) {
      return {
        success: false,
        message:
          "כבר קיים חומר אחר עם אותו שם ותאריך תפוגה",
      };
    }

    const { error } = await supabase
      .from("expiry_items")
      .update({
        material_name: item.materialName,
        expiry_date: expiryDateValue,
        quantity: item.quantity,
        location: item.location || null,
        invalid_expiry_text: null,
        is_rejected: item.isRejected,
        is_active: true,
        fingerprint,
        row_key: fingerprint,
        source_file_name: "עריכה ידנית",
        source_row_number: null,
        last_seen_at: timestamp,
      })
      .eq("id", itemId);

    if (error) {
      console.error(
        "Update manual expiry item error:",
        error
      );

      return {
        success: false,
        message: "עדכון החומר נכשל",
      };
    }

    return {
      success: true,
      message: "החומר עודכן בהצלחה",
      item: {
        id: itemId,
        materialName: item.materialName,
        expiryDate: expiryDateValue,
        quantity: item.quantity,
        location: item.location,
        isRejected: item.isRejected,
      },
    };
  } catch (error) {
    console.error(
      "Update expiry item action error:",
      error
    );

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "עדכון החומר נכשל",
    };
  }
}

export async function deleteExpiryItem(
  id: string
): Promise<ManualExpiryActionResult> {
  try {
    const { supabase } = await getAuthorizedClient();

    const { error } = await supabase
      .from("expiry_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete expiry item error:", error);

      return {
        success: false,
        message: "מחיקת החומר נכשלה",
      };
    }

    return {
      success: true,
      message: "החומר נמחק בהצלחה",
    };
  } catch (error) {
    console.error("Delete expiry item action error:", error);

    return {
      success: false,
      message: "מחיקת החומר נכשלה",
    };
  }
}
