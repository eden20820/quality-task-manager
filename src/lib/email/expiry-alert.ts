import "server-only";

import { ASSIGNEES } from "@/lib/email/task-notification";

export type ExpiringMaterial = {
  id: string;
  material_name: string;
  expiry_date: string;
  quantity: number | null;
  location: string | null;
};

type SendResult =
  | { status: "sent"; messageId: string | null }
  | { status: "failed"; error: string };

export const EXPIRY_RECIPIENTS = Object.values(ASSIGNEES);

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function buildMaterialsRows(materials: ExpiringMaterial[]) {
  return materials.map((material) => `<tr>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:bold">${escapeHtml(material.material_name)}</td>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(material.location?.trim() || "לא צוין")}</td>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0">${material.quantity ?? "לא צוינה"}</td>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0">${formatDate(material.expiry_date)}</td>
  </tr>`).join("");
}

function buildExpiryHtml(name: string, materials: ExpiringMaterial[]) {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
  const link = baseUrl ? `${baseUrl}/expiry` : "";
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#0f172a">
    <div style="background:#9f1239;color:white;padding:22px 26px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;font-size:24px">התראת תפוגת חומרים</h1>
      <p style="margin:8px 0 0;color:#ffe4e6">מערכת ניהול משימות – מחלקת איכות</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:0;padding:26px;border-radius:0 0 12px 12px">
      <p style="font-size:17px">שלום ${escapeHtml(name)},</p>
      <p>החומרים הבאים מגיעים היום לתאריך התפוגה שלהם:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;text-align:right">
        <thead><tr style="background:#f1f5f9"><th style="padding:12px">שם החומר</th><th style="padding:12px">מיקום</th><th style="padding:12px">כמות</th><th style="padding:12px">תאריך תפוגה</th></tr></thead>
        <tbody>${buildMaterialsRows(materials)}</tbody>
      </table>
      <p style="color:#9f1239;font-weight:bold">יש לבדוק ולטפל בחומרים בהתאם לנוהלי האיכות.</p>
      ${link ? `<a href="${escapeHtml(link)}" style="display:inline-block;margin-top:8px;background:#0f172a;color:white;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">פתיחת פגי התוקף</a>` : ""}
    </div>
  </div>`;
}

export async function sendExpiryAlert(
  recipient: { name: string; email: string },
  materials: ExpiringMaterial[]
): Promise<SendResult> {
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
        subject: "התראת תפוגת חומרים",
        htmlContent: buildExpiryHtml(recipient.name, materials),
        tags: ["expiry_alert"],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string };
    if (!response.ok) return { status: "failed", error: payload.message ?? payload.code ?? `Brevo returned ${response.status}` };
    return { status: "sent", messageId: payload.messageId ?? null };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Unknown email error" };
  }
}
