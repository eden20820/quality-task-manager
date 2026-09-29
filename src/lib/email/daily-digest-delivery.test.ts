import { describe, expect, it } from "vitest";

import { canRetryDigestDelivery } from "./daily-digest-delivery";

describe("daily digest delivery retry", () => {
  const now = new Date("2026-09-29T06:30:00.000Z");

  it("retries failed deliveries", () => {
    expect(canRetryDigestDelivery({ status: "failed", updated_at: "2026-09-29T06:29:00.000Z" }, now)).toBe(true);
  });

  it("reclaims a stale sending delivery", () => {
    expect(canRetryDigestDelivery({ status: "sending", updated_at: "2026-09-29T06:00:00.000Z" }, now)).toBe(true);
  });

  it("does not duplicate sent or active deliveries", () => {
    expect(canRetryDigestDelivery({ status: "sent", updated_at: "2026-09-29T06:00:00.000Z" }, now)).toBe(false);
    expect(canRetryDigestDelivery({ status: "sending", updated_at: "2026-09-29T06:25:00.000Z" }, now)).toBe(false);
  });
});
