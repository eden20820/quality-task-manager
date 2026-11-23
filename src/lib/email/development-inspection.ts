import "server-only";
import { CAELI_ORGANIZATION_ID } from "@/lib/auth/authorized-users";
import { getDevelopmentProducts, type DevelopmentInspectionPayload } from "@/lib/quality-forms/development-inspection";
import { sendBrevoEmail } from "./brevo";

const finalStatuses = {
  approved: "מאושר לשימוש בפיתוח", "approved-deviation": "מאושר בכפוף לחריגה",
  rework: "נדרש תיקון / עיבוד חוזר", "on-hold": "בהמתנה לבירור",
  "design-improvement": "נדרש שיפור תכן פנימי", other: "אחר", "": "לא נקבע",
};
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const compact = (value: string, max = 160) => value.replace(/\s+/g, " ").trim().slice(0, max);
const valueHtml = (value: string) => `<bdi>${escape(compact(value))}</bdi>`;

export async function sendDevelopmentInspectionToPurchasing(input: {
  organizationId: string;
  payload: DevelopmentInspectionPayload;
  bytes: Uint8Array;
  fileName: string;
  pending: boolean;
}): Promise<"sent" | "failed" | "unconfigured" | "skipped"> {
  if (input.organizationId !== CAELI_ORGANIZATION_ID) return "skipped";
  const email = process.env.DEVELOPMENT_INSPECTION_PURCHASING_EMAIL?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "unconfigured";

  const { payload } = input;
  const supplier = compact(payload.supplierName, 120) || "ספק לא צוין";
  const date = payload.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3.$2.$1");
  const items = getDevelopmentProducts(payload).filter(product => [product.catalogNumber, product.itemDescription, product.receivedQuantity, product.inspectedQuantity].some(value => value.trim()));
  const details = items.slice(0, 8).map(product => `<li>${[product.catalogNumber, product.itemDescription].filter(value => value.trim()).map(valueHtml).join(" · ") || "פריט ללא שם או מק״ט"}${product.receivedQuantity.trim() ? ` — התקבלו ${valueHtml(product.receivedQuantity)}` : ""}${product.inspectedQuantity.trim() ? `, נבדקו ${valueHtml(product.inspectedQuantity)}` : ""}</li>`).join("");
  const findings = payload.nonconformityFound === "yes" || payload.generalConformity === "gap" || payload.drawingRows.some(row => row.conformity === "fail")
    ? "תועדה אי־התאמה או תוצאת בדיקה לא תקינה"
    : payload.nonconformityFound === "no" ? "לא דווחה אי־התאמה" : "לא צוין";
  const notes = [payload.gapDetails, payload.nonconformityNumber ? `מספר אי־התאמה: ${payload.nonconformityNumber}` : "", payload.finalStatus === "other" ? payload.otherStatusDetails : "", payload.finalStatus === "design-improvement" ? payload.designImprovementDetails : ""].filter(note => note.trim());
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#0f172a"><h2>ביקורת קבלה – מוצרי פיתוח</h2><p><strong>ספק:</strong> ${valueHtml(supplier)} · <strong>תאריך:</strong> ${valueHtml(date || "לא צוין")}</p><p><strong>סטטוס בדיקה:</strong> ${finalStatuses[payload.finalStatus]}<br><strong>חתימות:</strong> ${input.pending ? "ממתין להשלמת חתימה — הטופס המצורף טרם נחתם במלואו" : "שתי החתימות הושלמו"}<br><strong>ממצאים:</strong> ${findings}</p>${details ? `<p><strong>פריטים שנבדקו / התקבלו:</strong></p><ul>${details}</ul>` : ""}${items.length > 8 ? `<p>ועוד ${items.length - 8} פריטים בטופס המצורף.</p>` : ""}${notes.length ? `<p><strong>פרטי חריגות:</strong> ${notes.map(valueHtml).join(" · ")}</p>` : ""}<p>טופס הביקורת מצורף כ־PDF.</p></div>`;
  const result = await sendBrevoEmail({ to: { email }, subject: `${supplier} – ביקורת קבלה למוצרי פיתוח`, html, attachments: [{ name: input.fileName, content: Buffer.from(input.bytes).toString("base64") }], tags: ["development_inspection_purchasing"] });
  return result.status;
}
