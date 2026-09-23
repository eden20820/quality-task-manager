import "server-only";

import { ASSIGNEES } from "./task-notification";

export type ExpiringMaterial = {
  id: string;
  material_name: string;
  expiry_date: string;
  quantity: number | null;
  location: string | null;
};

export type ExpiringSupplier = {
  id: string;
  supplier_name: string;
  product_service: string | null;
  certification_type: string | null;
  expiration_date: string;
};

export type DueCalibration = {
  id: string;
  equipment_name: string;
  serial_number: string | null;
  location: string | null;
  next_calibration_date: string;
};

export type DailyQualityAlerts = {
  materials: ExpiringMaterial[];
  suppliers: ExpiringSupplier[];
  calibrations: DueCalibration[];
};

type SendResult =
  | { status: "sent"; messageId: string | null }
  | { status: "failed"; error: string };

export const QUALITY_ALERT_RECIPIENTS = [
  ASSIGNEES.eden,
  ASSIGNEES.sergey,
  ASSIGNEES.quality_manager,
];

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

function buildSupplierRows(suppliers: ExpiringSupplier[]) {
  return suppliers.map((supplier) => `<tr>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:bold">${escapeHtml(supplier.supplier_name)}</td>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(supplier.product_service?.trim() || "לא צוין")}</td>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(supplier.certification_type?.trim() || "לא צוין")}</td>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0">${formatDate(supplier.expiration_date)}</td>
  </tr>`).join("");
}

function buildCalibrationRows(calibrations: DueCalibration[]) {
  return calibrations.map((calibration) => `<tr>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:bold">${escapeHtml(calibration.equipment_name)}</td>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(calibration.serial_number?.trim() || "לא צוין")}</td>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(calibration.location?.trim() || "לא צוין")}</td>
    <td style="padding:12px;border-bottom:1px solid #e2e8f0">${formatDate(calibration.next_calibration_date)}</td>
  </tr>`).join("");
}

function buildQualityAlertsHtml(name: string, alerts: DailyQualityAlerts) {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
  const link = baseUrl ? `${baseUrl}/calendar` : "";
  const materialsSection = alerts.materials.length ? `<h2 style="margin:24px 0 10px;font-size:19px">חומרים שפג תוקפם היום</h2>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;text-align:right">
        <thead><tr style="background:#f1f5f9"><th style="padding:12px">שם החומר</th><th style="padding:12px">מיקום</th><th style="padding:12px">כמות</th><th style="padding:12px">תאריך תפוגה</th></tr></thead>
        <tbody>${buildMaterialsRows(alerts.materials)}</tbody>
      </table>` : "";
  const suppliersSection = alerts.suppliers.length ? `<h2 style="margin:24px 0 10px;font-size:19px">ספקים שתוקפם פג היום</h2>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;text-align:right">
        <thead><tr style="background:#f1f5f9"><th style="padding:12px">שם הספק</th><th style="padding:12px">מוצר / שירות</th><th style="padding:12px">סוג הסמכה</th><th style="padding:12px">תאריך תפוגה</th></tr></thead>
        <tbody>${buildSupplierRows(alerts.suppliers)}</tbody>
      </table>` : "";
  const calibrationsSection = alerts.calibrations.length ? `<h2 style="margin:24px 0 10px;font-size:19px">כיולים שמועד ביצועם היום</h2>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;text-align:right">
        <thead><tr style="background:#f1f5f9"><th style="padding:12px">שם המכשיר</th><th style="padding:12px">מספר סידורי</th><th style="padding:12px">מיקום</th><th style="padding:12px">תאריך כיול</th></tr></thead>
        <tbody>${buildCalibrationRows(alerts.calibrations)}</tbody>
      </table>` : "";
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#0f172a">
    <div style="background:#9f1239;color:white;padding:22px 26px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;font-size:24px">התראות איכות יומיות</h1>
      <p style="margin:8px 0 0;color:#ffe4e6">מערכת ניהול משימות – מחלקת איכות</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:0;padding:26px;border-radius:0 0 12px 12px">
      <p style="font-size:17px">שלום ${escapeHtml(name)},</p>
      <p>אלו פריטי האיכות שהגיעו היום למועד התפוגה או הכיול שלהם:</p>
      ${materialsSection}${suppliersSection}${calibrationsSection}
      <p style="color:#9f1239;font-weight:bold">יש לבדוק ולטפל בפריטים בהתאם לנוהלי האיכות.</p>
      ${link ? `<a href="${escapeHtml(link)}" style="display:inline-block;margin-top:8px;background:#0f172a;color:white;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">פתיחת היומן</a>` : ""}
    </div>
  </div>`;
}

export async function sendQualityAlerts(
  recipient: { name: string; email: string },
  alerts: DailyQualityAlerts
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
        subject: "התראות איכות יומיות – תפוגות, ספקים וכיולים",
        htmlContent: buildQualityAlertsHtml(recipient.name, alerts),
        tags: ["daily_quality_alerts"],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string };
    if (!response.ok) return { status: "failed", error: payload.message ?? payload.code ?? `Brevo returned ${response.status}` };
    return { status: "sent", messageId: payload.messageId ?? null };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Unknown email error" };
  }
}
