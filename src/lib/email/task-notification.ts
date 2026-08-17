import "server-only";

export const ASSIGNEES = {
  eden: { name: "עדן", email: "eden@caeli.pro" },
  sergey: { name: "סרגיי", email: "sergey@caeli.pro" },
  quality_manager: { name: "עמית", email: "amit.a@caeli.pro" },
} as const;

type AssigneeKey = keyof typeof ASSIGNEES;
type TaskForEmail = { id: string; task_number: number; title: string; description: string | null; priority: string; due_date: string | null };
type EmailResult = { assigneeKey: AssigneeKey; email: string; status: "sent" | "failed" | "skipped"; messageId?: string; error?: string };

const priorityLabels: Record<string, string> = { normal: "רגילה", high: "גבוהה", urgent: "דחופה" };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function formatDueDate(value: string | null) {
  if (!value) return "לא הוגדר";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function buildTaskUrl(taskId: string) {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/tasks/${taskId}/edit` : "";
}

function buildEmailHtml(task: TaskForEmail, assigneeName: string) {
  const taskUrl = buildTaskUrl(task.id);
  const description = task.description?.trim() || "לא נוסף תיאור";
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><div style="background:#0f172a;color:white;padding:22px 26px;border-radius:12px 12px 0 0"><h1 style="margin:0;font-size:24px">הוקצתה לך משימה חדשה</h1><p style="margin:8px 0 0;color:#cbd5e1">מערכת ניהול משימות – מחלקת איכות</p></div><div style="border:1px solid #e2e8f0;border-top:0;padding:26px;border-radius:0 0 12px 12px"><p style="font-size:17px">שלום ${escapeHtml(assigneeName)},</p><p>נוספה משימה חדשה שבאחריותך:</p><h2 style="margin:22px 0 8px">${escapeHtml(task.title)}</h2><p style="white-space:pre-wrap;color:#475569">${escapeHtml(description)}</p><table style="width:100%;margin:22px 0;border-collapse:collapse"><tr><td style="padding:9px;border-bottom:1px solid #e2e8f0;font-weight:bold">מספר משימה</td><td style="padding:9px;border-bottom:1px solid #e2e8f0">${task.task_number}</td></tr><tr><td style="padding:9px;border-bottom:1px solid #e2e8f0;font-weight:bold">עדיפות</td><td style="padding:9px;border-bottom:1px solid #e2e8f0">${priorityLabels[task.priority] ?? escapeHtml(task.priority)}</td></tr><tr><td style="padding:9px;border-bottom:1px solid #e2e8f0;font-weight:bold">תאריך יעד</td><td style="padding:9px;border-bottom:1px solid #e2e8f0">${formatDueDate(task.due_date)}</td></tr></table>${taskUrl ? `<a href="${escapeHtml(taskUrl)}" style="display:inline-block;background:#0f172a;color:white;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">פתיחת המשימה</a>` : ""}</div></div>`;
}

export async function sendTaskAssignmentEmails({ task, assigneeKeys }: { task: TaskForEmail; assigneeKeys: AssigneeKey[] }): Promise<EmailResult[]> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("Task email skipped: Resend environment variables are missing");
    return assigneeKeys.map((assigneeKey) => ({ assigneeKey, email: ASSIGNEES[assigneeKey].email, status: "skipped", error: "Resend environment variables are missing" }));
  }

  return Promise.all(assigneeKeys.map(async (assigneeKey): Promise<EmailResult> => {
    const assignee = ASSIGNEES[assigneeKey];
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `task-${task.id}-${assigneeKey}` },
        body: JSON.stringify({ from, to: [assignee.email], subject: `משימה חדשה #${task.task_number}: ${task.title}`, html: buildEmailHtml(task, assignee.name), tags: [{ name: "type", value: "task_assignment" }, { name: "assignee", value: assigneeKey }] }),
      });
      const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
      if (!response.ok) return { assigneeKey, email: assignee.email, status: "failed", error: payload.message ?? payload.name ?? `Resend returned ${response.status}` };
      return { assigneeKey, email: assignee.email, status: "sent", messageId: payload.id };
    } catch (error) {
      return { assigneeKey, email: assignee.email, status: "failed", error: error instanceof Error ? error.message : "Unknown email error" };
    }
  }));
}
