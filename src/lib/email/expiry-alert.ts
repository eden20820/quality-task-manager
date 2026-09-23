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

export function buildQualityAlertSections(alerts: DailyQualityAlerts) {
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
  return `${materialsSection}${suppliersSection}${calibrationsSection}`;
}
