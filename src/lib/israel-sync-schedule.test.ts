import { describe, expect, it } from "vitest";

import { isIsraelSixAm } from "./israel-sync-schedule";

describe("Israel sync schedule", () => {
  it("runs at 06:00 Israel time during daylight saving time", () => {
    expect(isIsraelSixAm(new Date("2026-07-15T03:00:00.000Z"))).toBe(true);
    expect(isIsraelSixAm(new Date("2026-07-15T04:00:00.000Z"))).toBe(false);
  });

  it("runs at 06:00 Israel time during standard time", () => {
    expect(isIsraelSixAm(new Date("2026-01-15T03:00:00.000Z"))).toBe(false);
    expect(isIsraelSixAm(new Date("2026-01-15T04:00:00.000Z"))).toBe(true);
  });
});
