"use server";

import { createClient } from "@/lib/supabase/server";
import { ASSIGNEES, sendTaskAssignmentEmails } from "@/lib/email/task-notification";

type UploadedFile = {
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number;
};

type CreateTaskResult =
  | { success: true; taskId: string }
  | { success: false; error: string };

function parseUploadedFiles(value: FormDataEntryValue | null, userId: string): UploadedFile[] | null {
  if (typeof value !== "string" || !value) return [];

  try {
    const files = JSON.parse(value) as UploadedFile[];
    if (!Array.isArray(files) || files.length > 20) return null;

    const valid = files.every((file) =>
      typeof file.file_name === "string" &&
      file.file_name.length > 0 &&
      typeof file.storage_path === "string" &&
      file.storage_path.startsWith(`${userId}/`) &&
      (typeof file.mime_type === "string" || file.mime_type === null) &&
      Number.isInteger(file.file_size) &&
      file.file_size >= 0 &&
      file.file_size <= 10 * 1024 * 1024
    );
    return valid ? files : null;
  } catch {
    return null;
  }
}

export async function createTask(formData: FormData): Promise<CreateTaskResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "ההתחברות פגה. יש להתחבר מחדש." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "new");
  const priority = String(formData.get("priority") ?? "normal");
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const assigneeKeys = formData.getAll("assignees").map(String)
    .filter((key): key is keyof typeof ASSIGNEES => key in ASSIGNEES);
  const uploadedFiles = parseUploadedFiles(formData.get("uploaded_files"), user.id);

  if (!title) return { success: false, error: "יש להזין כותרת למשימה" };

  if (assigneeKeys.length === 0) return { success: false, error: "יש לבחור לפחות אחראי אחד" };
  if (!uploadedFiles) return { success: false, error: "פרטי הקבצים שצורפו אינם תקינים" };

  const { data: task, error } = await supabase.from("tasks").insert({
    title, description, status, priority, due_date: dueDate || null,
    created_by: user.id, assignees: assigneeKeys,
  }).select("id, task_number, title, description, priority, due_date").single();

  if (error || !task) {
    console.error("Create task error:", error);
    return { success: false, error: "שמירת המשימה נכשלה. נסה שוב." };
  }

  if (uploadedFiles.length > 0) {
    const { error: fileError } = await supabase.from("task_files").insert(
      uploadedFiles.map((file) => ({
        task_id: task.id,
        uploaded_by: user.id,
        ...file,
      }))
    );

    if (fileError) {
      console.error("Save task files error:", fileError);
      await supabase.storage.from("task-files").remove(uploadedFiles.map((file) => file.storage_path));
      return { success: false, error: "המשימה נשמרה, אך קישור הקבצים אליה נכשל" };
    }
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

  return { success: true, taskId: task.id };
}
