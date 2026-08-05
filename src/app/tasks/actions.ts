"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function completeTask(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "").trim();

  if (!taskId) {
    throw new Error("Missing task ID");
  }

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
