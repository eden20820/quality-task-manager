"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildEcoPreview, packLegacyEcoNotes, packLegacyOpenerNotes, parseEcoWorkbook, repackLegacyEcoNotes, unpackLegacyEcoNotes, unpackLegacyOpenerNotes, type EcoImportPreview, type EcoImportRow, type ExistingEco } from "@/lib/eco-import";

export type FollowupResult = { success: boolean; message: string };
export type EcoImportResult = FollowupResult & { added?: number; updated?: number; skipped?: number; failed?: number };
const categories = new Set(["pka", "nonconformity", "eco"]);
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
    const openedByName = String(formData.get("opened_by_name") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const quantity = quantityValue === "" ? null : Number(quantityValue);
    if (!categories.has(category) || !referenceNumber || !name || !/^\d{4}-\d{2}-\d{2}$/.test(openedAt) || !validStatus(category, status)) return { success: false, message: "יש להזין מספר, שם, תאריך ומצב תקינים" };
    if (category === "pka" && (!Number.isInteger(quantity) || (quantity ?? -1) < 0)) return { success: false, message: "יש להזין כמות תקינה לפק״ע" };
    const { supabase, user } = await authorized();
    const values = { category, reference_number: referenceNumber, name, quantity: category === "pka" ? quantity : null, opened_at: openedAt, status, assignee_key: null, closed_at: status === "closed" ? new Date().toISOString().slice(0, 10) : null, notes, opened_by_name: openedByName, created_by: user.id };
    let { error } = await supabase.from("quality_followups").insert(values);
    if (error && /opened_by_name/i.test(error.message)) {
      const legacy = await supabase.from("quality_followups").insert({ category, reference_number: referenceNumber, name, quantity: category === "pka" ? quantity : null, opened_at: openedAt, status, assignee_key: null, closed_at: status === "closed" ? new Date().toISOString().slice(0, 10) : null, notes: packLegacyOpenerNotes(openedByName, notes), created_by: user.id });
      error = legacy.error;
    }
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

export async function updateFollowupName(id: string, formData: FormData): Promise<FollowupResult> {
  try {
    const name = String(formData.get("name") ?? "").trim();
    if (!name || name.length > 200) return { success: false, message: "יש להזין שם תקין" };
    const { supabase } = await authorized();
    const { error } = await supabase.from("quality_followups").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    revalidatePath("/followups");
    return { success: true, message: "השם נשמר" };
  } catch (error) {
    console.error("Update followup name error:", error);
    return { success: false, message: "שמירת השם נכשלה" };
  }
}

export async function updateFollowupOpenedBy(id: string, formData: FormData): Promise<FollowupResult> {
  try {
    const openedByName = String(formData.get("opened_by_name") ?? "").trim() || null;
    if ((openedByName?.length ?? 0) > 200) return { success: false, message: "שם הפותח ארוך מדי" };
    const { supabase } = await authorized();
    let { error } = await supabase.from("quality_followups").update({ opened_by_name: openedByName, updated_at: new Date().toISOString() }).eq("id", id);
    if (error && /opened_by_name/i.test(error.message)) {
      const current = await supabase.from("quality_followups").select("notes").eq("id", id).single();
      if (current.error) throw current.error;
      const eco = unpackLegacyEcoNotes(current.data.notes);
      const generic = unpackLegacyOpenerNotes(current.data.notes);
      const notes = eco ? repackLegacyEcoNotes({ ...eco, owner: openedByName }) : packLegacyOpenerNotes(openedByName, generic?.notes ?? current.data.notes);
      error = (await supabase.from("quality_followups").update({ notes, updated_at: new Date().toISOString() }).eq("id", id)).error;
    }
    if (error) throw error;
    revalidatePath("/followups");
    return { success: true, message: "שם הפותח נשמר" };
  } catch (error) {
    console.error("Update followup opener error:", error);
    return { success: false, message: "שמירת שם הפותח נכשלה" };
  }
}

export async function updateFollowupNotes(id: string, formData: FormData): Promise<FollowupResult> {
  try {
    const notes = String(formData.get("notes") ?? "").trim();
    if (notes.length > 2000) return { success: false, message: "ההערה ארוכה מדי" };
    const { supabase } = await authorized();
    const current = await supabase.from("quality_followups").select("notes").eq("id", id).single();
    if (current.error) throw current.error;
    const eco = unpackLegacyEcoNotes(current.data.notes);
    const generic = unpackLegacyOpenerNotes(current.data.notes);
    const storedNotes = eco ? repackLegacyEcoNotes({ ...eco, comments: notes || null }) : generic ? packLegacyOpenerNotes(generic.openedByName, notes || null) : notes || null;
    const { error } = await supabase
      .from("quality_followups")
      .update({ notes: storedNotes, updated_at: new Date().toISOString() })
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

export type EcoPreviewResult = { success: true; preview: EcoImportPreview } | { success: false; message: string };

export async function previewEcoImport(formData: FormData): Promise<EcoPreviewResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return { success: false, message: "יש לבחור קובץ Excel" };
    if (!/\.xlsx?$/i.test(file.name)) return { success: false, message: "יש לבחור קובץ Excel מסוג XLSX או XLS" };
    if (file.size > 10 * 1024 * 1024) return { success: false, message: "הקובץ גדול מדי. הגודל המרבי הוא 10MB" };
    const { supabase } = await authorized();
    const parsed = parseEcoWorkbook(await file.arrayBuffer());
    const modern = await supabase.from("quality_followups").select("id,reference_number,eco_project,eco_owner_name,eco_description,name,opened_at,status,closed_at,notes,opened_by_name").eq("category", "eco");
    let existing: ExistingEco[];
    if (!modern.error) existing = (modern.data ?? []) as ExistingEco[];
    else if (/(eco_(project|owner_name|description)|opened_by_name)/i.test(modern.error.message)) {
      const legacy = await supabase.from("quality_followups").select("id,reference_number,name,opened_at,status,closed_at,notes").eq("category", "eco");
      if (legacy.error) throw legacy.error;
      existing = (legacy.data ?? []).map((row) => {
        const packed = unpackLegacyEcoNotes(row.notes);
        return { ...row, name: packed?.description ?? row.name, opened_by_name: packed?.owner ?? null, eco_project: packed?.project ?? null, eco_owner_name: packed?.owner ?? null, eco_description: packed?.description ?? row.name ?? "", notes: packed?.comments ?? row.notes } as ExistingEco;
      });
    } else throw modern.error;
    return { success: true, preview: buildEcoPreview(file.name, parsed, existing) };
  } catch (error) {
    console.error("ECO preview error:", error);
    return { success: false, message: error instanceof Error ? error.message : "קריאת קובץ ה-ECO נכשלה" };
  }
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
    const { supabase, user } = await authorized();
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
    let { data, error } = await supabase.rpc("merge_eco_import", { p_rows: operations });
    if (error && /(merge_eco_import|schema cache|could not find the function)/i.test(error.message)) {
      const legacyValues = selected.map((row) => ({ id: row.existingId || undefined, category: "eco", reference_number: row.data!.reference_number, name: row.data!.eco_description, quantity: null, opened_at: row.data!.opened_at, status: row.data!.status, closed_at: row.data!.closed_at, notes: packLegacyEcoNotes(row.data!), created_by: user.id, updated_at: new Date().toISOString() }));
      const legacy = await supabase.from("quality_followups").upsert(legacyValues, { onConflict: "category,reference_number" });
      error = legacy.error;
      data = error ? null : { added: selected.filter((row) => row.action === "new").length, updated: selected.filter((row) => row.action === "update").length, skipped: 0 };
    }
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
