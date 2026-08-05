"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createTask(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "new");
  const priority = String(formData.get("priority") ?? "normal");
  const dueDate = String(formData.get("due_date") ?? "").trim();

  if (!title) {
    redirect("/tasks/new?error=missing-title");
  }

  const { error } = await supabase.from("tasks").insert({
    title,
    description,
    status,
    priority,
    due_date: dueDate || null,
    created_by: user.id,
  });

  if (error) {
    console.error("Create task error:", error);
    redirect("/tasks/new?error=create-failed");
  }

  redirect("/tasks");
}