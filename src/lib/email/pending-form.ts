import "server-only";
import { sendBrevoEmail } from "./brevo";

// Existing quality department recipients, also used by adhesion form alerts.
export const QUALITY_FORM_RECIPIENTS = [
  { name: "עדן", email: "eden@caeli.pro" },
  { name: "סרגיי", email: "sergey@caeli.pro" },
] as const;
export type FormEmailStatus = "sent" | "partial" | "failed" | "skipped";
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export async function sendPendingFormAlerts(input: { organizationId: string; formTitle: string; supplierName: string; catalogNumber: string; date: string }): Promise<FormEmailStatus> {
  // These are Caeli recipients, never leak another company's form details.
  if (input.organizationId !== "00000000-0000-4000-8000-000000000001") return "skipped";
  const url = process.env.APP_URL?.replace(/\/$/, "");
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#0f172a;max-width:620px;margin:auto"><h1>טופס חדש ממתין לחתימה</h1><p>${escape(input.formTitle)}</p><p>ספק / תחום: ${escape(input.supplierName || "לא צוין")}</p><p>מק״ט / מוצר: ${escape(input.catalogNumber || "לא צוין")}</p><p>תאריך: ${escape(input.date || "לא צוין")}</p><p>הטופס נשמר במערכת וממתין להשלמת חתימה במחלקת האיכות.</p>${url ? `<a href="${escape(`${url}/forms/archive?tab=pending`)}">פתיחת הטפסים שממתינים לחתימה</a>` : ""}</div>`;
  const results = await Promise.all(QUALITY_FORM_RECIPIENTS.map(async recipient => {
    try { return await sendBrevoEmail({ to: recipient, subject: `ממתין לחתימה: ${input.formTitle} – ${input.catalogNumber || input.supplierName}`, html, tags: ["pending_form_signature"] }); }
    catch { return { status: "failed" as const }; }
  }));
  const sent = results.filter(result => result.status === "sent").length;
  return sent === results.length ? "sent" : sent ? "partial" : "failed";
}
