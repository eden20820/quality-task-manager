"use server";

import { revalidatePath } from "next/cache";

import { getPortalUser } from "@/lib/auth/portal-user";
import { createClient } from "@/lib/supabase/server";

export type ReminderActionResult = { success: boolean; message: string };

export async function createReminder(
  _previousState: ReminderActionResult,
  formData: FormData
): Promise<ReminderActionResult> {
  const portalUser = await getPortalUser();
  if (!portalUser?.profile.is_active) return { success: false, message: "אין הרשאה" };

  const title = String(formData.get("title") ?? "").trim();
  const reminderDate = String(formData.get("reminder_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(reminderDate)) {
    return { success: false, message: "יש למלא כותרת ותאריך" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reminders").insert({
    title,
    reminder_date: reminderDate,
    notes: notes || null,
    created_by: portalUser.userId,
  });

  if (error) {
    console.error("Create reminder error:", error);
    return { success: false, message: "שמירת התזכורת נכשלה" };
  }
  revalidatePath("/calendar");
  return { success: true, message: "התזכורת נוספה" };
}

export async function deleteReminder(reminderId: string) {
  const portalUser = await getPortalUser();
  if (!portalUser?.profile.is_active || !reminderId) return;
  const supabase = await createClient();
  const { error } = await supabase.from("reminders").delete().eq("id", reminderId);
  if (error) console.error("Delete reminder error:", error);
  revalidatePath("/calendar");
}
