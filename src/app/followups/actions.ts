"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildEcoPreview, parseEcoWorkbook, type EcoImportPreview, type EcoImportRow, type ExistingEco } from "@/lib/eco-import";

export type FollowupResult = { success: boolean; message: string };
export type EcoImportResult = FollowupResult & { added?: number; updated?: number; skipped?: number; failed?: number };
const categories = new Set(["pka", "nonconformity", "eco"]);
const assignees = new Set(["eden", "sergey", "quality_manager"]);

function validAssignee(category: string, assigneeKey: string) {
  if (category === "nonconformity" && !assigneeKey) return true;
  return assignees.has(assigneeKey) && (assigneeKey !== "quality_manager" || category === "nonconformity" || category === "eco");
}

function validStatus(category: string, status: string) {
  return status === "open" || status === "closed" || (category === "nonconformity" && status === "waiting");
}

async function authorized() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", userId).single();
  if (!profile?.is_active) throw new Error("User is not active");
  return { supabase, user: { id: userId } };
}

export async function createFollowup(_: FollowupResult, formData: FormData): Promise<FollowupResult> {
  try {
    const category = String(formData.get("category") ?? "");
    const referenceNumber = String(formData.get("reference_number") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const quantityValue = String(formData.get("quantity") ?? "").trim();
    const openedAt = String(formData.get("opened_at") ?? "");
    const status = String(formData.get("status") ?? "open");
    const assigneeKey = String(formData.get("assignee_key") ?? "");
    const quantity = quantityValue === "" ? null : Number(quantityValue);
    if (!categories.has(category) || !referenceNumber || !name || !/^\d{4}-\d{2}-\d{2}$/.test(openedAt) || !validStatus(category, status) || !validAssignee(category, assigneeKey)) return { success: false, message: "יש להזין מספר, שם, תאריך ומצב תקינים" };
    if (category === "pka" && (!Number.isInteger(quantity) || (quantity ?? -1) < 0)) return { success: false, message: "יש להזין כמות תקינה לפק״ע" };
    const { supabase, user } = await authorized();
    const { error } = await supabase.from("quality_followups").insert({ category, reference_number: referenceNumber, name, quantity: category === "pka" ? quantity : null, opened_at: openedAt, status, assignee_key: assigneeKey || null, closed_at: status === "closed" ? new Date().toISOString().slice(0, 10) : null, notes: String(formData.get("notes") ?? "").trim() || null, created_by: user.id });
    if (error?.code === "23505") return { success: false, message: "מספר זה כבר קיים בקטגוריה" };
    if (error) throw error;
    revalidatePath("/followups"); revalidatePath("/calendar");
    return { success: true, message: "הרשומה נוספה" };
  } catch (error) { console.error(error); return { success: false, message: "שמירת הרשומה נכשלה" }; }
}

export async function toggleFollowup(id: string, status: "open" | "closed") {
  const { supabase } = await authorized();
  await supabase.from("quality_followups").update({ status, closed_at: status === "closed" ? new Date().toISOString().slice(0, 10) : null, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/followups"); revalidatePath("/calendar");
}

export async function toggleFollowupAlerts(id: string, alertsEnabled: boolean) {
  const { supabase } = await authorized();
  const { error } = await supabase
    .from("quality_followups")
    .update({ alerts_enabled: alertsEnabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/followups"); revalidatePath("/calendar");
}

export async function updateFollowupAssignee(id: string, formData: FormData) {
  const assigneeKey = String(formData.get("assignee_key") ?? "");
  const { supabase } = await authorized();
  const { data: followup, error: loadError } = await supabase.from("quality_followups").select("category").eq("id", id).single();
  if (loadError || !followup || !validAssignee(followup.category, assigneeKey)) throw new Error("Invalid assignee");
  const { error } = await supabase
    .from("quality_followups")
    .update({ assignee_key: assigneeKey || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/followups");
}

export async function updateFollowupNotes(id: string, formData: FormData): Promise<FollowupResult> {
  try {
    const notes = String(formData.get("notes") ?? "").trim();
    if (notes.length > 2000) return { success: false, message: "ההערה ארוכה מדי" };
    const { supabase } = await authorized();
    const { error } = await supabase
      .from("quality_followups")
      .update({ notes: notes || null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/followups");
    return { success: true, message: "ההערה נשמרה" };
  } catch (error) {
    console.error("Update followup notes error:", error);
    return { success: false, message: "שמירת ההערה נכשלה" };
  }
}

export async function deleteFollowup(id: string) {
  const { supabase } = await authorized();
  await supabase.from("quality_followups").delete().eq("id", id);
  revalidatePath("/followups"); revalidatePath("/calendar");
}

export async function previewEcoImport(formData: FormData): Promise<EcoImportPreview> {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("יש לבחור קובץ Excel");
  if (!/\.xlsx?$/i.test(file.name)) throw new Error("יש לבחור קובץ Excel מסוג XLSX או XLS");
  if (file.size > 10 * 1024 * 1024) throw new Error("הקובץ גדול מדי. הגודל המרבי הוא 10MB");

  const { supabase } = await authorized();
  const parsed = parseEcoWorkbook(await file.arrayBuffer());
  const { data, error } = await supabase
    .from("quality_followups")
    .select("id,reference_number,eco_project,eco_owner_name,eco_description,name,opened_at,status,closed_at,notes")
    .eq("category", "eco");
  if (error) throw new Error("טעינת רשומות ה-ECO הקיימות נכשלה");

  return buildEcoPreview(file.name, parsed, (data ?? []) as ExistingEco[]);
}

function validImportRow(row: EcoImportRow) {
  const data = row.data;
  return Boolean(
    data &&
    /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(data.reference_number) &&
    data.eco_project?.trim() &&
    data.eco_owner_name?.trim() &&
    data.eco_description.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.opened_at) &&
    (data.status === "open" || data.status === "closed") &&
    (data.status !== "closed" || Boolean(data.closed_at && /^\d{4}-\d{2}-\d{2}$/.test(data.closed_at)))
  );
}

export async function confirmEcoImport(rows: EcoImportRow[], fileName: string): Promise<EcoImportResult> {
  try {
    const { supabase } = await authorized();
    const selected = rows.filter((row) => (row.action === "new" || row.action === "update") && row.resolution === "import");
    const invalidSelection = selected.filter((row) => !validImportRow(row));
    if (invalidSelection.length) return { success: false, message: "חלק מנתוני הייבוא אינם תקינים. יש לסרוק מחדש את הקובץ.", failed: invalidSelection.length };
    if (!selected.length) {
      return { success: true, message: "לא נבחרו שינויים לשמירה", added: 0, updated: 0, skipped: rows.length, failed: 0 };
    }

    const operations = selected.map((row) => ({
      action: row.action,
      existing_id: row.existingId ?? null,
      reference_number: row.data!.reference_number,
      project: row.data!.eco_project,
      owner_name: row.data!.eco_owner_name,
      description: row.data!.eco_description,
      opened_at: row.data!.opened_at,
      status: row.data!.status,
      closed_at: row.data!.closed_at,
      notes: row.data!.notes,
      source_file_name: fileName.slice(0, 255),
    }));
    const { data, error } = await supabase.rpc("merge_eco_import", { p_rows: operations });
    if (error) throw error;
    const result = (data ?? {}) as { added?: number; updated?: number; skipped?: number };
    const skipped = (result.skipped ?? 0) + rows.length - selected.length;
    revalidatePath("/followups");
    revalidatePath("/");
    revalidatePath("/calendar");
    return {
      success: true,
      message: `הייבוא הושלם: ${result.added ?? 0} נוספו, ${result.updated ?? 0} עודכנו, ${skipped} דולגו`,
      added: result.added ?? 0,
      updated: result.updated ?? 0,
      skipped,
      failed: 0,
    };
  } catch (error) {
    console.error("ECO import error:", error);
    return { success: false, message: "שמירת ייבוא ה-ECO נכשלה. לא נשמרו שינויים.", failed: 1 };
  }
}
