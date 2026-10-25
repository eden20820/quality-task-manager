"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type BinderEntryActionResult = { success: boolean; message: string };

async function authorized() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", userId).single();
  if (!profile?.is_active) throw new Error("User is not active");
  return { supabase, userId };
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function optionalUuid(value: FormDataEntryValue | null) {
  const text = clean(value);
  if (!text) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new Error("בחירת הספק אינה תקינה");
  return text;
}

function entryValues(formData: FormData) {
  const displayName = clean(formData.get("display_name"));
  if (!displayName) throw new Error("יש להזין שם ספק כפי שיופיע בקלסר");
  if (displayName.length > 300) throw new Error("שם הספק ארוך מדי");
  return { display_name: displayName, supplier_id: optionalUuid(formData.get("supplier_id")) };
}

function friendlyError(error: unknown, fallback: string) {
  console.error(fallback, error);
  if (error instanceof Error && error.message.startsWith("יש")) return error.message;
  if (error instanceof Error && error.message.startsWith("בחירת")) return error.message;
  return fallback;
}

export async function addSupplierBinderEntry(formData: FormData): Promise<BinderEntryActionResult> {
  try {
    const binderId = optionalUuid(formData.get("binder_id"));
    if (!binderId) return { success: false, message: "הקלסר לא נמצא" };
    const { supabase, userId } = await authorized();
    const { data: lastEntry, error: orderError } = await supabase
      .from("supplier_binder_entries")
      .select("sort_order")
      .eq("binder_id", binderId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw orderError;
    const { error } = await supabase.from("supplier_binder_entries").insert({
      binder_id: binderId,
      ...entryValues(formData),
      sort_order: (lastEntry?.sort_order ?? 0) + 1,
      created_by: userId,
    });
    if (error) throw error;
    revalidatePath("/supplier-binders");
    return { success: true, message: "הספק נוסף לקלסר" };
  } catch (error) {
    return { success: false, message: friendlyError(error, "הוספת הספק לקלסר נכשלה") };
  }
}

export async function updateSupplierBinderEntry(formData: FormData): Promise<BinderEntryActionResult> {
  try {
    const entryId = optionalUuid(formData.get("entry_id"));
    if (!entryId) return { success: false, message: "הרשומה לא נמצאה" };
    const { supabase } = await authorized();
    const { error } = await supabase
      .from("supplier_binder_entries")
      .update({ ...entryValues(formData), updated_at: new Date().toISOString() })
      .eq("id", entryId);
    if (error) throw error;
    revalidatePath("/supplier-binders");
    return { success: true, message: "פרטי הספק בקלסר עודכנו" };
  } catch (error) {
    return { success: false, message: friendlyError(error, "עדכון הספק בקלסר נכשל") };
  }
}

export async function deleteSupplierBinderEntry(entryId: string): Promise<BinderEntryActionResult> {
  try {
    const id = optionalUuid(entryId);
    if (!id) return { success: false, message: "הרשומה לא נמצאה" };
    const { supabase } = await authorized();
    const { error } = await supabase.from("supplier_binder_entries").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/supplier-binders");
    return { success: true, message: "הספק הוסר מהקלסר" };
  } catch (error) {
    return { success: false, message: friendlyError(error, "הסרת הספק מהקלסר נכשלה") };
  }
}

export async function updateSupplierBinderName(formData: FormData): Promise<BinderEntryActionResult> {
  try {
    const binderId = optionalUuid(formData.get("binder_id"));
    const label = clean(formData.get("label"));
    if (!binderId) return { success: false, message: "הקלסר לא נמצא" };
    if (!label) return { success: false, message: "יש להזין שם לקלסר" };
    if (label.length > 40) return { success: false, message: "שם הקלסר ארוך מדי" };
    const { supabase } = await authorized();
    const { error } = await supabase.from("supplier_binders").update({ label, updated_at: new Date().toISOString() }).eq("id", binderId);
    if (error) throw error;
    revalidatePath("/supplier-binders");
    return { success: true, message: "שם הקלסר עודכן" };
  } catch (error) {
    return { success: false, message: friendlyError(error, "עדכון שם הקלסר נכשל") };
  }
}
