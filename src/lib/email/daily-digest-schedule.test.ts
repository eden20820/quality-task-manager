import { describe, expect, it } from "vitest";

import { getIsraelDigestSchedule } from "./daily-digest-schedule";

describe("daily digest schedule", () => {
  it("blocks Friday and Saturday according to Israel time", () => {
    expect(getIsraelDigestSchedule(new Date("2026-10-02T05:00:00Z")).isWeekend).toBe(true);
    expect(getIsraelDigestSchedule(new Date("2026-10-03T05:00:00Z")).isWeekend).toBe(true);
  });

  it("allows Sunday through Thursday", () => {
    expect(getIsraelDigestSchedule(new Date("2026-10-04T05:00:00Z")).isWeekend).toBe(false);
    expect(getIsraelDigestSchedule(new Date("2026-10-08T05:00:00Z")).isWeekend).toBe(false);
  });
});
