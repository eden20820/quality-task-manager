import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildAdhesionLeakTestPdf } from "./adhesion-leak-test-pdf";
import { createEmptyAdhesionLeakTest, isAdhesionLeakTestPayload } from "./adhesion-leak-test";

describe("adhesion leak test form", () => {
  it("creates a valid empty payload with today's dates", () => {
    const payload = createEmptyAdhesionLeakTest("2026-11-04");
    expect(payload.testDate).toBe("2026-11-04");
    expect(payload.checkedByDate).toBe("2026-11-04");
    expect(payload.approvedByDate).toBe("2026-11-04");
    expect(isAdhesionLeakTestPayload(payload)).toBe(true);
  });

  it("rejects malformed signatures", () => {
    const payload = { ...createEmptyAdhesionLeakTest("2026-11-04"), checkedBySignature: "x".repeat(1_500_001) };
    expect(isAdhesionLeakTestPayload(payload)).toBe(false);
  });

  it("fills the supplied one-page PDF template", async () => {
    const payload = { ...createEmptyAdhesionLeakTest("2026-11-04"), testerName: "Eden Aharon", testedProduct: "מכלול 101", decision: "pass" as const };
    const bytes = await buildAdhesionLeakTestPdf(payload);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  });
});
