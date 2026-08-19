import "server-only";

import { ASSIGNEES } from "@/lib/email/task-notification";

export type DailyTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignees: string[];
};

export type DailyReminder = {
  id: string;
  title: string;
  notes: string | null;
  created_by: string;
};
export type DailyFollowup = { id: string; category: "pka" | "nonconformity" | "eco"; reference_number: string; name: string | null; quantity: number | null; assignee_key: "eden" | "sergey" | null; opened_at: string; created_at: string; notes: string | null };

export type DigestRecipient = {
  name: string;
  email: string;
  tasks: DailyTask[];
  reminders: DailyReminder[];
  followups: DailyFollowup[];
};

type SendResult =
  | { status: "sent"; messageId: string | null }
  | { status: "failed"; error: string };

const priorityLabels: Record<string, string> = {
  normal: "רגילה",
  high: "גבוהה",
  urgent: "דחופה",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character
  );
}

function taskLink(taskId: string) {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/tasks/${taskId}/edit` : "";
}

function calendarLink() {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/calendar` : "";
}

function buildTaskItems(tasks: DailyTask[]) {
  return tasks
    .map((task) => {
      const link = taskLink(task.id);
      const description = task.description?.trim();
      return `<li style="margin:0 0 14px"><strong>${escapeHtml(task.title)}</strong><div style="margin-top:4px;color:#64748b">עדיפות: ${priorityLabels[task.priority] ?? escapeHtml(task.priority)}</div>${description ? `<div style="margin-top:4px;color:#475569">${escapeHtml(description)}</div>` : ""}${link ? `<div style="margin-top:6px"><a href="${escapeHtml(link)}" style="color:#0369a1;font-weight:bold">פתיחת המשימה</a></div>` : ""}</li>`;
    })
    .join("");
}

function buildReminderItems(reminders: DailyReminder[]) {
  return reminders
    .map((reminder) => {
      const notes = reminder.notes?.trim();
      return `<li style="margin:0 0 14px"><strong>${escapeHtml(reminder.title)}</strong>${notes ? `<div style="margin-top:4px;color:#475569">${escapeHtml(notes)}</div>` : ""}</li>`;
    })
    .join("");
}

function buildFollowupItems(items: DailyFollowup[]) {
  const labels = { pka: 'פק״ע', nonconformity: "אי התאמה", eco: "ECO" };
  return items.map((item) => `<li style="margin:0 0 14px"><strong>${labels[item.category]} ${escapeHtml(item.reference_number)}${item.name ? ` — ${escapeHtml(item.name)}` : ""}</strong>${item.category === "pka" && item.quantity !== null ? `<div style="margin-top:4px;color:#475569">כמות: ${item.quantity}</div>` : ""}<div style="margin-top:4px;color:#dc2626">הרשומה פתוחה כבר שבוע</div>${item.notes ? `<div style="margin-top:4px;color:#475569">${escapeHtml(item.notes)}</div>` : ""}</li>`).join("");
}

function buildDigestHtml(recipient: DigestRecipient) {
  const link = calendarLink();
  const tasksSection = recipient.tasks.length
    ? `<h2 style="margin:24px 0 12px;font-size:19px">משימות להיום</h2><ul style="margin:0;padding-right:22px">${buildTaskItems(recipient.tasks)}</ul>`
    : "";
  const remindersSection = recipient.reminders.length
    ? `<h2 style="margin:24px 0 12px;font-size:19px">תזכורות להיום</h2><ul style="margin:0;padding-right:22px">${buildReminderItems(recipient.reminders)}</ul>`
    : "";
  const followupsSection = recipient.followups.length ? `<h2 style="margin:24px 0 12px;font-size:19px">התראות מעקב פתוחות</h2><ul style="margin:0;padding-right:22px">${buildFollowupItems(recipient.followups)}</ul>` : "";

  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><div style="background:#0f172a;color:white;padding:22px 26px;border-radius:12px 12px 0 0"><h1 style="margin:0;font-size:24px">משימות ותזכורות יומיות</h1><p style="margin:8px 0 0;color:#cbd5e1">Caeli Quality Hub</p></div><div style="border:1px solid #e2e8f0;border-top:0;padding:26px;border-radius:0 0 12px 12px"><p style="font-size:17px">בוקר טוב ${escapeHtml(recipient.name)},</p><p>אלו המשימות, התזכורות וההתראות להיום:</p>${tasksSection}${remindersSection}${followupsSection}${link ? `<a href="${escapeHtml(link)}" style="display:inline-block;margin-top:10px;background:#0f172a;color:white;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">פתיחת היומן</a>` : ""}</div></div>`;
}

export function groupDailyItems({
  tasks,
  reminders,
  profiles,
  followups = [],
}: {
  tasks: DailyTask[];
  reminders: DailyReminder[];
  profiles: Array<{ id: string; email: string | null; full_name: string | null; is_active: boolean }>;
  followups?: DailyFollowup[];
}) {
  const recipients = new Map<string, DigestRecipient>();

  const getRecipient = (email: string, name: string) => {
    const key = email.toLowerCase();
    const existing = recipients.get(key);
    if (existing) return existing;
    const recipient = { name, email, tasks: [], reminders: [], followups: [] };
    recipients.set(key, recipient);
    return recipient;
  };

  for (const task of tasks) {
    for (const key of task.assignees ?? []) {
      const assignee = ASSIGNEES[key as keyof typeof ASSIGNEES];
      if (assignee) getRecipient(assignee.email, assignee.name).tasks.push(task);
    }
  }

  const profilesById = new Map(profiles.filter((profile) => profile.is_active).map((profile) => [profile.id, profile]));
  for (const reminder of reminders) {
    const profile = profilesById.get(reminder.created_by);
    if (profile?.email) {
      getRecipient(profile.email, profile.full_name?.trim() || profile.email).reminders.push(reminder);
    }
  }

  for (const followup of followups) {
    const keys = followup.assignee_key ? [followup.assignee_key] : (["eden", "sergey"] as const);
    for (const key of keys) {
      const assignee = ASSIGNEES[key];
      getRecipient(assignee.email, assignee.name).followups.push(followup);
    }
  }

  return [...recipients.values()];
}

export async function sendDailyDigest(recipient: DigestRecipient): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "מערכת ניהול משימות";
  if (!apiKey || !fromEmail) return { status: "failed", error: "Brevo environment variables are missing" };

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: recipient.email, name: recipient.name }],
        subject: "משימות ותזכורות יומיות",
        htmlContent: buildDigestHtml(recipient),
        tags: ["daily_digest"],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string };
    if (!response.ok) return { status: "failed", error: payload.message ?? payload.code ?? `Brevo returned ${response.status}` };
    return { status: "sent", messageId: payload.messageId ?? null };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Unknown email error" };
  }
}
