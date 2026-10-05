import "server-only";

const MAX_EXCEL_BYTES = 10 * 1024 * 1024;

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

async function getGoogleAccessToken() {
  const body = new URLSearchParams({
    client_id: requiredEnvironmentVariable("GOOGLE_DRIVE_CLIENT_ID"),
    client_secret: requiredEnvironmentVariable("GOOGLE_DRIVE_CLIENT_SECRET"),
    refresh_token: requiredEnvironmentVariable("GOOGLE_DRIVE_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });
  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => null) as { access_token?: string; error?: string } | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Google OAuth token request failed${payload?.error ? `: ${payload.error}` : ""}`);
  }
  return payload.access_token;
}

export async function downloadPkaWorkbookFromDrive() {
  const fileId = requiredEnvironmentVariable("PKA_GOOGLE_DRIVE_FILE_ID");
  const accessToken = await getGoogleAccessToken();
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Google Drive download failed (${response.status})${message ? `: ${message.slice(0, 200)}` : ""}`);
  }
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_EXCEL_BYTES) throw new Error("Google Drive workbook is larger than 10MB");
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > MAX_EXCEL_BYTES) throw new Error("Google Drive workbook size is invalid");
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("Google Drive returned a non-XLSX response");
  }
  return buffer;
}
