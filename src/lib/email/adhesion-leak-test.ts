import "server-only";

import { sendBrevoEmail } from "./brevo";

import type { AdhesionLeakTestPayload } from "@/lib/quality-forms/adhesion-leak-test";

export const ADHESION_LEAK_TEST_RECIPIENTS = [
  { name: "עדן", email: "eden@caeli.pro" },
  { name: "סרגיי", email: "sergey@caeli.pro" },
] as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendAdhesionLeakTestAlerts(payload: AdhesionLeakTestPayload) {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
  const archiveUrl = baseUrl ? `${baseUrl}/forms/archive` : "";
  const product = payload.testedProduct.trim() || "לא צוין מוצר";
  const tester = payload.testerName.trim() || payload.checkedByName.trim() || "לא צוין בודק";
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><div style="background:#0f172a;color:white;padding:22px 26px;border-radius:12px 12px 0 0"><h1 style="margin:0;font-size:23px">נשמר טופס בדיקת אטימות חדש</h1><p style="margin:8px 0 0;color:#cbd5e1">נספח 8.4.2.4.0</p></div><div style="border:1px solid #e2e8f0;border-top:0;padding:26px;border-radius:0 0 12px 12px"><p>טופס בדיקת אטימות והדבקה הושלם ונשמר במאגר הטפסים.</p><table style="width:100%;margin:20px 0;border-collapse:collapse"><tr><td style="padding:9px;border-bottom:1px solid #e2e8f0;font-weight:bold">מוצר נבדק</td><td style="padding:9px;border-bottom:1px solid #e2e8f0">${escapeHtml(product)}</td></tr><tr><td style="padding:9px;border-bottom:1px solid #e2e8f0;font-weight:bold">בודק</td><td style="padding:9px;border-bottom:1px solid #e2e8f0">${escapeHtml(tester)}</td></tr><tr><td style="padding:9px;border-bottom:1px solid #e2e8f0;font-weight:bold">תאריך</td><td style="padding:9px;border-bottom:1px solid #e2e8f0">${escapeHtml(payload.testDate || "לא צוין")}</td></tr></table>${archiveUrl ? `<a href="${escapeHtml(archiveUrl)}" style="display:inline-block;background:#0f172a;color:white;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">פתיחת מאגר הטפסים</a>` : ""}</div></div>`;
  return Promise.all(ADHESION_LEAK_TEST_RECIPIENTS.map(async (recipient) => ({
    recipient: recipient.email,
    ...(await sendBrevoEmail({ to: recipient, subject: `טופס בדיקת אטימות חדש – ${product}`, html, tags: ["adhesion_leak_test"] })),
  })));
}
