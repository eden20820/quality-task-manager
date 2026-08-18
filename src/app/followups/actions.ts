"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FollowupResult = { success: boolean; message: string };
const categories = new Set(["pka", "nonconformity", "eco"]);

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
    const openedAt = String(formData.get("opened_at") ?? "");
    const status = String(formData.get("status") ?? "open");
    if (!categories.has(category) || !referenceNumber || !/^\d{4}-\d{2}-\d{2}$/.test(openedAt) || !["open", "closed"].includes(status)) return { success: false, message: "יש להזין מספר, תאריך ומצב" };
    const { supabase, user } = await authorized();
    const { error } = await supabase.from("quality_followups").insert({ category, reference_number: referenceNumber, opened_at: openedAt, status, closed_at: status === "closed" ? new Date().toISOString().slice(0, 10) : null, notes: String(formData.get("notes") ?? "").trim() || null, created_by: user.id });
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

export async function deleteFollowup(id: string) {
  const { supabase } = await authorized();
  await supabase.from("quality_followups").delete().eq("id", id);
  revalidatePath("/followups"); revalidatePath("/calendar");
}
