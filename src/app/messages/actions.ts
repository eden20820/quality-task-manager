"use server";

import { revalidatePath } from "next/cache";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { ASSIGNEES } from "@/lib/email/task-notification";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ManualEmailResult = { success: boolean; message: string };
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export async function sendManualEmail(_: ManualEmailResult, formData: FormData): Promise<ManualEmailResult> {
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims.sub;
    if (!userId) return { success: false, message: "ההתחברות פגה. יש להתחבר מחדש." };
    const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", userId).maybeSingle();
    if (!profile?.is_active) return { success: false, message: "אין הרשאה לשליחת מיילים." };

    const recipientKey = String(formData.get("recipient_key") ?? "");
    if (!(recipientKey in ASSIGNEES)) return { success: false, message: "יש לבחור את עדן, סרגיי או עמית." };
    const recipient = ASSIGNEES[recipientKey as keyof typeof ASSIGNEES];
    const subject = String(formData.get("subject") ?? "").trim().slice(0, 200);
    const body = String(formData.get("body") ?? "").trim().slice(0, 10_000);
    if (!subject || !body) return { success: false, message: "יש להזין נושא ותוכן להודעה." };

    const admin = createAdminClient();
    const { data: log, error: logError } = await admin.from("email_delivery_log").insert({ notification_type: "manual", recipient_name: recipient.name, recipient_email: recipient.email, subject, status: "sending", sent_by: userId }).select("id").single();
    if (logError || !log) { console.error("Manual email log insert failed", logError); return { success: false, message: "יצירת רישום השליחה נכשלה. נסה שוב." }; }

    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#0f172a"><div style="background:#0f172a;color:white;padding:20px 24px;border-radius:12px 12px 0 0"><h1 style="margin:0;font-size:22px">${escapeHtml(subject)}</h1><p style="margin:7px 0 0;color:#cbd5e1">QMS</p></div><div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 12px 12px;white-space:pre-wrap;line-height:1.7">${escapeHtml(body)}</div></div>`;
    const result = await sendBrevoEmail({ to: recipient, subject, html, tags: ["manual", recipientKey] });
    const update = result.status === "sent" ? { status: "sent", provider_message_id: result.messageId, error_message: null, updated_at: new Date().toISOString() } : { status: "failed", provider_message_id: null, error_message: result.error, updated_at: new Date().toISOString() };
    const { error: updateError } = await admin.from("email_delivery_log").update(update).eq("id", log.id);
    if (updateError) console.error("Manual email log update failed", updateError);
    revalidatePath("/messages");
    return result.status === "sent" ? { success: true, message: `המייל נשלח בהצלחה אל ${recipient.name}.` } : { success: false, message: `שליחת המייל נכשלה: ${result.error}` };
  } catch (error) {
    console.error("Manual email action failed", error);
    return { success: false, message: "שליחת המייל נכשלה. בדוק את החיבור ונסה שוב." };
  }
}
