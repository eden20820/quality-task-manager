"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNEES, sendTaskAssignmentEmails } from "@/lib/email/task-notification";

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
  const assigneeKeys = formData.getAll("assignees").map(String)
    .filter((key): key is keyof typeof ASSIGNEES => key in ASSIGNEES);

  if (!title) {
    redirect("/tasks/new?error=missing-title");
  }

  if (assigneeKeys.length === 0) {
    redirect("/tasks/new?error=missing-assignee");
  }

  const { data: task, error } = await supabase.from("tasks").insert({
    title, description, status, priority, due_date: dueDate || null,
    created_by: user.id, assignees: assigneeKeys,
  }).select("id, task_number, title, description, priority, due_date").single();

  if (error || !task) {
    console.error("Create task error:", error);
    redirect("/tasks/new?error=create-failed");
  }

  // כשל בשירות המייל לא מבטל משימה שכבר נוצרה ולא גורם לכפילות בניסיון חוזר.
  const emailResults = await sendTaskAssignmentEmails({ task, assigneeKeys });
  const { error: notificationLogError } = await supabase
    .from("task_email_notifications")
    .insert(emailResults.map((result) => ({
      task_id: task.id,
      assignee_key: result.assigneeKey,
      recipient_email: result.email,
      status: result.status,
      provider_message_id: result.messageId ?? null,
      error_message: result.error ?? null,
    })));

  if (notificationLogError) {
    console.error("Save email notification log error:", notificationLogError);
  }

  redirect("/tasks");
}
