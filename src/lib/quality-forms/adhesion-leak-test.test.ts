import { PDFDocument } from "pdf-lib";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { buildAdhesionLeakTestPdf, directionalTextLayout, extractAdhesionLeakTestPayload } from "./adhesion-leak-test-pdf";
import { createEmptyAdhesionLeakTest, isAdhesionLeakTestPayload } from "./adhesion-leak-test";

describe("adhesion leak test form", () => {
  it("keeps Hebrew and English in separate directional runs", () => {
    expect(directionalTextLayout("בדיקה ABC תקינה")).toEqual({
      baseDirection: "rtl",
      runs: [
        { direction: "rtl", text: "בדיקה " },
        { direction: "ltr", text: "ABC " },
        { direction: "rtl", text: "תקינה" },
      ],
    });
  });

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

  it("creates a clean one-page PDF that can be reopened for editing", async () => {
    const payload = {
      ...createEmptyAdhesionLeakTest("2026-11-04"),
      testerName: "עדן אהרון",
      testLocation: "מעבדת אלקטרוניקה",
      operationDescription: "בדיקת אטימות",
      bondedProductMaterial: "אלומיניום AL-6061 תקין",
      testedProduct: "מכלול 101",
      adhesiveManufacturerModel: "יצרן ודגם לדוגמה",
      adhesiveExpiryDate: "2026-11-25",
      curingMethod: "epoxy" as const,
      exposureTime: "42 שעות",
      temperature: "23°C",
      humidity: "45%",
      underHood: "no" as const,
      testMethod: "vacuum" as const,
      cracks: "no" as const,
      bubbles: "no" as const,
      materialSeparation: "no" as const,
      leakObserved: "no" as const,
      decision: "pass" as const,
      checkedByName: "עדן",
      approvedByName: "גל",
    };
    const bytes = await buildAdhesionLeakTestPdf(payload);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(await extractAdhesionLeakTestPayload(bytes)).toEqual(payload);
    if (process.env.ADHESION_PDF_SAMPLE_PATH) await writeFile(process.env.ADHESION_PDF_SAMPLE_PATH, bytes);
  });
});
