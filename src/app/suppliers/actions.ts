"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { buildSupplierPreview, parseSupplierWorkbook, type ExistingSupplier, type SupplierImportPreview, type SupplierImportRow } from "@/lib/supplier-import";

export type SupplierActionResult = { success: boolean; message: string };
export type SupplierPreviewResult = { success: true; preview: SupplierImportPreview } | { success: false; message: string };
export type SupplierImportResult = SupplierActionResult & { added?: number; updated?: number; skipped?: number; failed?: number };

async function authorized() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", userId).single();
  if (!profile?.is_active) throw new Error("User is not active");
  return { supabase, userId };
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = clean(value);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || number > 10) throw new Error("הציונים חייבים להיות בין 0 ל־10");
  return number;
}

function supplierValues(formData: FormData) {
  const supplierName = clean(formData.get("supplier_name"));
  if (!supplierName) throw new Error("יש להזין שם ספק");
  const expirationDate = clean(formData.get("expiration_date"));
  if (expirationDate && !/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) throw new Error("תאריך התוקף אינו תקין");

  const deliveryScore = optionalNumber(formData.get("delivery_score"));
  const qualityScore = optionalNumber(formData.get("quality_score"));
  const professionalismScore = optionalNumber(formData.get("professionalism_score"));
  const requirementsScore = optionalNumber(formData.get("requirements_score"));
  const suppliedWeightedScore = optionalNumber(formData.get("weighted_score"));
  const calculatedWeightedScore = [deliveryScore, qualityScore, professionalismScore, requirementsScore].every((score) => score !== null)
    ? Number((deliveryScore! * 0.3 + qualityScore! * 0.3 + professionalismScore! * 0.15 + requirementsScore! * 0.25).toFixed(2))
    : null;

  return {
    supplier_number: clean(formData.get("supplier_number")) || null,
    sort_order: /^\d+$/.test(clean(formData.get("supplier_number"))) ? Number(clean(formData.get("supplier_number"))) : null,
    supplier_name: supplierName,
    product_service: clean(formData.get("product_service")) || null,
    has_certification: formData.get("has_certification") === "true",
    has_experience: formData.get("has_experience") === "true",
    status: clean(formData.get("status")) || "Approved",
    certification_type: clean(formData.get("certification_type")) || null,
    expiration_date: expirationDate || null,
    delivery_score: deliveryScore,
    quality_score: qualityScore,
    professionalism_score: professionalismScore,
    requirements_score: requirementsScore,
    weighted_score: suppliedWeightedScore ?? calculatedWeightedScore,
    notes: clean(formData.get("notes")) || null,
  };
}

function refreshSupplierViews() {
  revalidatePath("/suppliers");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function createSupplier(_: SupplierActionResult, formData: FormData): Promise<SupplierActionResult> {
  try {
    const { supabase, userId } = await authorized();
    const { error } = await supabase.from("suppliers").insert({
      ...supplierValues(formData),
      created_by: userId,
      import_key: `manual-${crypto.randomUUID()}`,
    });
    if (error) throw error;
    refreshSupplierViews();
    return { success: true, message: "הספק נוסף בהצלחה" };
  } catch (error) {
    console.error("Create supplier error:", error);
    return { success: false, message: error instanceof Error && error.message.startsWith("ה") ? error.message : "שמירת הספק נכשלה" };
  }
}

export async function updateSupplier(formData: FormData): Promise<SupplierActionResult> {
  try {
    const id = clean(formData.get("id"));
    if (!id) return { success: false, message: "הספק לא נמצא" };
    const { supabase } = await authorized();
    const { error } = await supabase.from("suppliers").update({
      ...supplierValues(formData),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;
    refreshSupplierViews();
    return { success: true, message: "פרטי הספק עודכנו" };
  } catch (error) {
    console.error("Update supplier error:", error);
    return { success: false, message: error instanceof Error && error.message.startsWith("ה") ? error.message : "עדכון הספק נכשל" };
  }
}

export async function deleteSupplier(id: string) {
  const { supabase } = await authorized();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
  refreshSupplierViews();
}

export async function setSupplierAlertsEnabled(enabled: boolean) {
  const { supabase, userId } = await authorized();
  const { error } = await supabase.from("portal_settings").update({
    supplier_alerts_enabled: enabled,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }).eq("id", "global");
  if (error) throw error;
  refreshSupplierViews();
}

const supplierImportColumns = "id,supplier_number,supplier_name,product_service,has_certification,has_experience,status,certification_type,expiration_date,delivery_score,quality_score,professionalism_score,requirements_score,weighted_score,notes";

export async function previewSupplierImport(formData: FormData): Promise<SupplierPreviewResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) return { success: false, message: "יש לבחור קובץ Excel" };
    if (!/\.(xlsx|xls)$/i.test(file.name)) return { success: false, message: "ניתן להעלות קובץ XLSX או XLS בלבד" };
    if (file.size > 10 * 1024 * 1024) return { success: false, message: "גודל הקובץ המרבי הוא 10MB" };
    const { supabase } = await authorized();
    const parsed = parseSupplierWorkbook(await file.arrayBuffer());
    const { data, error } = await supabase.from("suppliers").select(supplierImportColumns);
    if (error) throw error;
    return { success: true, preview: buildSupplierPreview(file.name, parsed, (data ?? []) as ExistingSupplier[]) };
  } catch (error) {
    console.error("Supplier import preview error:", error);
    return { success: false, message: error instanceof Error && error.message.startsWith("לא") || error instanceof Error && error.message.startsWith("מבנה") ? error.message : "סריקת קובץ הספקים נכשלה. ודאו שזהו קובץ רשימת הספקים המאושרים" };
  }
}

function validImportRow(row: SupplierImportRow) {
  if (!row.data?.supplier_name.trim()) throw new Error("חסר שם ספק באחת הרשומות");
  if (row.data.expiration_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.data.expiration_date)) throw new Error("תאריך תוקף לא תקין באחת הרשומות");
  for (const score of [row.data.delivery_score, row.data.quality_score, row.data.professionalism_score, row.data.requirements_score, row.data.weighted_score]) {
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 10)) throw new Error("ציון לא תקין באחת הרשומות");
  }
  return row.data;
}

export async function confirmSupplierImport(rows: SupplierImportRow[]): Promise<SupplierImportResult> {
  let added = 0; let updated = 0; let skipped = 0; let failed = 0;
  try {
    const { supabase, userId } = await authorized();
    for (const row of rows) {
      if ((row.action !== "new" && row.action !== "update") || row.resolution !== "import") { skipped += 1; continue; }
      try {
        const data = validImportRow(row);
        if (row.action === "update" && row.existingId) {
          const { error } = await supabase.from("suppliers").update({ ...data, sort_order: /^\d+$/.test(data.supplier_number ?? "") ? Number(data.supplier_number) : null, updated_at: new Date().toISOString() }).eq("id", row.existingId);
          if (error) throw error;
          updated += 1;
        } else {
          const { error } = await supabase.from("suppliers").insert({ ...data, sort_order: /^\d+$/.test(data.supplier_number ?? "") ? Number(data.supplier_number) : null, created_by: userId, import_key: `excel-${crypto.randomUUID()}` });
          if (error) throw error;
          added += 1;
        }
      } catch (error) {
        console.error(`Supplier import row ${row.rowNumber} error:`, error);
        failed += 1;
      }
    }
    refreshSupplierViews();
    return { success: failed === 0, message: `הייבוא הושלם: ${added} נוספו, ${updated} עודכנו, ${skipped} דולגו${failed ? `, ${failed} נכשלו` : ""}. תאריכי התוקף נוספו להתראות ביומן.`, added, updated, skipped, failed };
  } catch (error) {
    console.error("Supplier import confirmation error:", error);
    return { success: false, message: "שמירת ייבוא הספקים נכשלה", added, updated, skipped, failed: failed + 1 };
  }
}
