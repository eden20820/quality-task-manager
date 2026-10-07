"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { headers } from "next/headers";
import {
  createReferenceCode,
  INTAKE_FIELD_LABELS,
  sanitizeIntake,
  validateIntake,
  type IntakeAnswers,
} from "@/lib/company-onboarding";

export type IntakeSubmissionResult = {
  success: boolean;
  message: string;
  referenceCode?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function displayValue(value: string | string[]) {
  const text = Array.isArray(value) ? value.join(" • ") : value;
  return text ? escapeHtml(text).replace(/\n/g, "<br>") : "—";
}

function buildSummaryRows(answers: IntakeAnswers) {
  return (Object.keys(INTAKE_FIELD_LABELS) as Array<keyof IntakeAnswers>)
    .filter((key) => {
      const value = answers[key];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    })
    .map((key) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;width:32%;vertical-align:top">${escapeHtml(INTAKE_FIELD_LABELS[key])}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600;vertical-align:top">${displayValue(answers[key])}</td>
      </tr>`)
    .join("");
}

function adminEmailHtml(answers: IntakeAnswers, referenceCode: string) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;background:#f8fafc;padding:28px;color:#0f172a">
    <div style="max-width:760px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
      <div style="padding:26px 28px;background:#0f172a;color:#fff">
        <div style="color:#93c5fd;font-size:13px;font-weight:700">אפיון מערכת חדש · ${escapeHtml(referenceCode)}</div>
        <h1 style="margin:8px 0 0;font-size:26px">${escapeHtml(answers.companyName)}</h1>
        <p style="margin:8px 0 0;color:#cbd5e1">${escapeHtml(answers.contactName)} · ${escapeHtml(answers.contactEmail)} · ${escapeHtml(answers.contactPhone)}</p>
      </div>
      <table dir="rtl" style="border-collapse:collapse;width:100%;font-size:14px">${buildSummaryRows(answers)}</table>
      <div style="padding:20px 28px;color:#64748b;font-size:13px">המידע נשמר גם בטבלת company_onboarding_submissions ב-Supabase.</div>
    </div>
  </div>`;
}

function confirmationEmailHtml(answers: IntakeAnswers, referenceCode: string) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;background:#f8fafc;padding:28px;color:#0f172a">
    <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:32px">
      <div style="display:inline-block;background:#dcfce7;color:#166534;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700">האפיון התקבל</div>
      <h1 style="margin:18px 0 10px;font-size:26px">תודה ${escapeHtml(answers.contactName)}</h1>
      <p style="line-height:1.7;color:#475569">קיבלנו את פרטי האפיון של ${escapeHtml(answers.companyName)}. נעבור על הדרישות וניצור קשר להמשך תכנון המערכת.</p>
      <div style="margin-top:20px;padding:16px;background:#f1f5f9;border-radius:12px"><strong>מספר הפנייה:</strong> ${escapeHtml(referenceCode)}</div>
    </div>
  </div>`;
}

export async function submitCompanyOnboarding(
  rawAnswers: unknown,
  metadata: { website?: string; startedAt?: number } = {},
): Promise<IntakeSubmissionResult> {
  try {
    if (metadata.website) return { success: true, message: "האפיון התקבל בהצלחה" };
    if (metadata.startedAt && Date.now() - metadata.startedAt < 2_500) {
      return { success: false, message: "הטופס נשלח מהר מדי. נסו שוב בעוד מספר שניות." };
    }
    const serialized = JSON.stringify(rawAnswers);
    if (serialized.length > 80_000) return { success: false, message: "הטופס גדול מדי לשליחה" };

    const answers = sanitizeIntake(rawAnswers);
    const errors = validateIntake(answers);
    if (Object.keys(errors).length > 0) {
      return { success: false, message: "חסרים פרטים נדרשים. חזרו לטופס ובדקו את השדות המסומנים." };
    }

    const supabase = createAdminClient();
    const requestHeaders = await headers();
    const fingerprintInput = [
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      requestHeaders.get("user-agent") ?? "unknown",
      process.env.ONBOARDING_RATE_LIMIT_SALT ?? "qms-onboarding",
    ].join("|");
    const fingerprintBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintInput));
    const sourceFingerprint = Array.from(new Uint8Array(fingerprintBytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ count: emailCount, error: emailCountError }, { count: sourceCount, error: sourceCountError }] = await Promise.all([
      supabase.from("company_onboarding_submissions").select("id", { count: "exact", head: true }).eq("contact_email", answers.contactEmail.toLowerCase()).gte("submitted_at", oneHourAgo),
      supabase.from("company_onboarding_submissions").select("id", { count: "exact", head: true }).eq("source_fingerprint", sourceFingerprint).gte("submitted_at", oneHourAgo),
    ]);
    if (emailCountError) throw emailCountError;
    if (sourceCountError) throw sourceCountError;
    if ((emailCount ?? 0) >= 3 || (sourceCount ?? 0) >= 5) {
      return { success: false, message: "נשלחו מספר טפסים בזמן קצר. המתינו כשעה לפני ניסיון נוסף." };
    }

    const referenceCode = createReferenceCode();
    const { error } = await supabase.from("company_onboarding_submissions").insert({
      reference_code: referenceCode,
      company_name: answers.companyName,
      contact_name: answers.contactName,
      contact_email: answers.contactEmail.toLowerCase(),
      contact_phone: answers.contactPhone,
      source_fingerprint: sourceFingerprint,
      answers,
      status: "new",
    });
    if (error) throw error;

    const notificationEmail = process.env.ONBOARDING_NOTIFICATION_EMAIL || "eden@caeli.pro";
    const [adminResult, confirmationResult] = await Promise.all([
      sendBrevoEmail({
        to: { email: notificationEmail, name: "אחראי מערכת האיכות" },
        subject: `אפיון מערכת חדש – ${answers.companyName} (${referenceCode})`,
        html: adminEmailHtml(answers, referenceCode),
        tags: ["company-onboarding", "new-lead"],
      }),
      sendBrevoEmail({
        to: { email: answers.contactEmail, name: answers.contactName },
        subject: `קיבלנו את אפיון מערכת האיכות – ${referenceCode}`,
        html: confirmationEmailHtml(answers, referenceCode),
        tags: ["company-onboarding", "confirmation"],
      }),
    ]);
    if (adminResult.status === "failed") console.error("Onboarding admin email failed:", adminResult.error);
    if (confirmationResult.status === "failed") console.error("Onboarding confirmation email failed:", confirmationResult.error);

    return { success: true, message: "האפיון התקבל בהצלחה", referenceCode };
  } catch (error) {
    console.error("Company onboarding submission failed:", error);
    return { success: false, message: "לא הצלחנו לשלוח את האפיון כרגע. הפרטים נשמרו כטיוטה במכשיר ואפשר לנסות שוב." };
  }
}
