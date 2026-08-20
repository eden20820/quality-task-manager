"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function getAuthorizedClient() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_active) {
    throw new Error("User is not active");
  }

  return { supabase, user };
}

export async function completeTask(taskId: string): Promise<{ success: boolean; message: string }> {

  if (!taskId) {
    return { success: false, message: "מזהה המשימה חסר" };
  }

  const { supabase, user } = await getAuthorizedClient();

  const { data: task, error: loadError } = await supabase
    .from("tasks")
    .select("status")
    .eq("id", taskId)
    .single();

  if (loadError || !task || task.status === "completed") {
    return { success: false, message: "לא ניתן להשלים את המשימה" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      previous_status: task.status,
      completed_by: user.id,
    })
    .eq("id", taskId)
    .eq("status", task.status);

  if (error) {
    console.error("Complete task error:", error);
    return { success: false, message: "השלמת המשימה נכשלה. נסה שוב." };
  }
  return { success: true, message: "המשימה הושלמה" };
}

export async function restoreTask(taskId: string): Promise<void> {
  if (!taskId) throw new Error("Missing task ID");

  const { supabase } = await getAuthorizedClient();
  const { data: task, error: loadError } = await supabase
    .from("tasks")
    .select("status, previous_status")
    .eq("id", taskId)
    .single();

  if (loadError || !task || task.status !== "completed") {
    throw new Error("Task cannot be restored");
  }

  const activeStatuses = new Set(["new", "in_progress", "waiting"]);
  const restoredStatus = activeStatuses.has(task.previous_status)
    ? task.previous_status
    : "new";

  const { error } = await supabase
    .from("tasks")
    .update({
      status: restoredStatus,
      previous_status: null,
      completed_by: null,
    })
    .eq("id", taskId)
    .eq("status", "completed");

  if (error) {
    console.error("Restore task error:", error);
    throw new Error("Failed to restore task");
  }

  revalidatePath("/tasks");
  revalidatePath("/tasks/completed");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function deleteCompletedTask(
  taskId: string,
): Promise<{ success: boolean; message: string }> {
  if (!taskId) {
    return { success: false, message: "מזהה המשימה חסר" };
  }

  const { supabase } = await getAuthorizedClient();
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Delete completed task error:", error);
    return { success: false, message: "מחיקת המשימה נכשלה. נסה שוב." };
  }

  if (!data) {
    return { success: false, message: "המשימה לא נמצאה או שאינה משימה שהושלמה" };
  }

  revalidatePath("/tasks");
  revalidatePath("/tasks/completed");
  revalidatePath("/calendar");
  revalidatePath("/");

  return { success: true, message: "המשימה נמחקה" };
}

export async function updateTask(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(
    formData.get("description") ?? ""
  ).trim();
  const status = String(formData.get("status") ?? "new");
  const priority = String(
    formData.get("priority") ?? "normal"
  );
  const dueDate = String(
    formData.get("due_date") ?? ""
  ).trim();
  const returnTo = String(formData.get("return_to") ?? "/tasks");

  if (!taskId || !title) {
    throw new Error("Missing required task details");
  }

  const { supabase } = await getAuthorizedClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      description,
      status,
      priority,
      due_date: dueDate || null,
    })
    .eq("id", taskId);

  if (error) {
    console.error("Update task error:", error);
    throw new Error("Failed to update task");
  }

  /*
   * אין צורך לרענן את עמוד העריכה עצמו,
   * מפני שמיד לאחר השמירה המשתמש מועבר לעמוד המשימות.
   */
  revalidatePath("/tasks");
  revalidatePath("/tasks/completed");
  revalidatePath("/");

  redirect(returnTo === "/tasks/completed" ? returnTo : "/tasks");
}

export async function clearDashboardTasks() {
  const { supabase, user } = await getAuthorizedClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      dashboard_cleared_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("Clear dashboard error:", error);
    throw new Error("Failed to clear dashboard");
  }

  revalidatePath("/");
}
