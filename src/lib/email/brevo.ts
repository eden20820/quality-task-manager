import "server-only";
export async function sendBrevoEmail({ to, subject, html, tags = [], attachments }: {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  tags?: string[];
  attachments?: { name: string; content: string }[];
}) {
  const key = process.env.BREVO_API_KEY, from = process.env.BREVO_FROM_EMAIL;
  if (!key || !from) return { status: "failed" as const, error: "Brevo environment variables are missing" };
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: { name: process.env.BREVO_FROM_NAME || "QMS", email: from }, to: [to], subject, htmlContent: html, tags, ...(attachments?.length ? { attachment: attachments } : {}) }),
    });
    const data = await response.json().catch(() => ({})) as { messageId?: string; message?: string };
    return response.ok ? { status: "sent" as const, messageId: data.messageId ?? null } : { status: "failed" as const, error: data.message || `Brevo returned ${response.status}` };
  } catch (error) {
    return { status: "failed" as const, error: error instanceof Error ? error.message : "Unknown email error" };
  }
}
