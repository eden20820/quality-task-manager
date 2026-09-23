import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { QUALITY_ALERT_RECIPIENTS, sendQualityAlerts } from "./expiry-alert";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("daily quality alerts", () => {
  it("always includes the quality manager among the recipients", () => {
    expect(QUALITY_ALERT_RECIPIENTS).toContainEqual({ name: "עמית", email: "amit.a@caeli.pro" });
  });

  it("renders materials, suppliers and calibrations in one email", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key");
    vi.stubEnv("BREVO_FROM_EMAIL", "quality@example.com");
    vi.stubEnv("APP_URL", "https://quality.example.com");

    let requestBody = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ messageId: "message-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }));

    const result = await sendQualityAlerts(
      { name: "עמית", email: "amit.a@caeli.pro" },
      {
        materials: [{ id: "m1", material_name: "חומר בדיקה", expiry_date: "2026-09-23", quantity: 2, location: "מחסן" }],
        suppliers: [{ id: "s1", supplier_name: "ספק בדיקה", product_service: "שירות", certification_type: "ISO", expiration_date: "2026-09-23" }],
        calibrations: [{ id: "c1", equipment_name: "מכשיר בדיקה", serial_number: "123", location: "מעבדה", next_calibration_date: "2026-09-23" }],
      }
    );

    expect(result).toEqual({ status: "sent", messageId: "message-1" });
    const payload = JSON.parse(requestBody) as { to: Array<{ email: string }>; htmlContent: string };
    expect(payload.to[0]?.email).toBe("amit.a@caeli.pro");
    expect(payload.htmlContent).toContain("חומר בדיקה");
    expect(payload.htmlContent).toContain("ספק בדיקה");
    expect(payload.htmlContent).toContain("מכשיר בדיקה");
  });
});
