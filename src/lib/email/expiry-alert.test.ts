import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { groupDailyItems, sendDailyDigest } from "./daily-digest";
import { QUALITY_ALERT_RECIPIENTS } from "./expiry-alert";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const qualityAlerts = {
  materials: [{ id: "m1", material_name: "חומר בדיקה", expiry_date: "2026-09-23", quantity: 2, location: "מחסן" }],
  suppliers: [{ id: "s1", supplier_name: "ספק בדיקה", product_service: "שירות", certification_type: "ISO", expiration_date: "2026-09-23" }],
  calibrations: [{ id: "c1", equipment_name: "מכשיר בדיקה", serial_number: "123", location: "מעבדה", next_calibration_date: "2026-09-23" }],
};

describe("unified daily email", () => {
  it("includes the quality manager and all quality alerts in the same recipient digest", () => {
    expect(QUALITY_ALERT_RECIPIENTS).toContainEqual({ name: "עמית", email: "amit.a@caeli.pro" });

    const recipients = groupDailyItems({
      tasks: [{ id: "t1", title: "משימת בדיקה", description: "תיאור", priority: "high", assignees: ["quality_manager"] }],
      reminders: [],
      profiles: [],
      qualityAlerts,
    });
    const amit = recipients.find((recipient) => recipient.email === "amit.a@caeli.pro");

    expect(amit).toMatchObject({
      tasks: [{ title: "משימת בדיקה" }],
      materials: [{ material_name: "חומר בדיקה" }],
      suppliers: [{ supplier_name: "ספק בדיקה" }],
      calibrations: [{ equipment_name: "מכשיר בדיקה" }],
    });
  });

  it("sends tasks, materials, suppliers and calibrations in one email", async () => {
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

    const recipient = groupDailyItems({
      tasks: [{ id: "t1", title: "משימת בדיקה", description: "תיאור", priority: "high", assignees: ["quality_manager"] }],
      reminders: [],
      profiles: [],
      qualityAlerts,
    }).find((item) => item.email === "amit.a@caeli.pro");
    expect(recipient).toBeDefined();

    const result = await sendDailyDigest(recipient!);

    expect(result).toEqual({ status: "sent", messageId: "message-1" });
    const payload = JSON.parse(requestBody) as { subject: string; to: Array<{ email: string }>; htmlContent: string };
    expect(payload.subject).toBe("עדכון איכות יומי");
    expect(payload.to[0]?.email).toBe("amit.a@caeli.pro");
    expect(payload.htmlContent).toContain("משימת בדיקה");
    expect(payload.htmlContent).toContain("חומר בדיקה");
    expect(payload.htmlContent).toContain("ספק בדיקה");
    expect(payload.htmlContent).toContain("מכשיר בדיקה");
  });
});
