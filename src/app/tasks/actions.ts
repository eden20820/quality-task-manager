"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function getAuthorizedClient() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active) {
    throw new Error("User is not active");
  }

  return { supabase, user };
}

export async function completeTask(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "").trim();

  if (!taskId) {
    throw new Error("Missing task ID");
  }

  const { supabase, user } = await getAuthorizedClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed_by: user.id,
    })
    .eq("id", taskId);

  if (error) {
    console.error("Complete task error:", error);
    throw new Error("Failed to complete task");
  }

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/tasks/completed");
}

export async function updateTask(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "new");
  const priority = String(formData.get("priority") ?? "normal");
  const dueDate = String(formData.get("due_date") ?? "").trim();

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

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}/edit`);
  revalidatePath("/tasks/completed");

  redirect("/tasks");
}
