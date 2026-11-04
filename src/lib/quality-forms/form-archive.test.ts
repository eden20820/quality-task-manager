import { describe, expect, it } from "vitest";

import { ADHESION_LEAK_TEST_FORM_TITLE, buildArchivedFormDescription, buildQualityFormDownloadName, buildQualityFormFileName, downloadNameFromArchivedFile, isPendingSignatureDescription, parseArchivedFormDescription } from "./form-archive";

describe("quality form archive filenames", () => {
  it("uses supplier, date and catalog number in the requested order", () => {
    expect(buildQualityFormFileName({ supplierName: "ספק לדוגמה", date: "2026-11-02", catalogNumber: "ABC/123", extension: "xlsx" }))
      .toBe("ספק-לדוגמה_2026-11-02_ABC-123.xlsx");
  });

  it("uses readable fallbacks for missing metadata", () => {
    expect(buildQualityFormFileName({ supplierName: "", date: "", catalogNumber: "", extension: ".docx" }))
      .toBe("ללא-ספק_ללא-תאריך_ללא-מקט.docx");
  });

  it("uses only the catalog number for files downloaded to the computer", () => {
    expect(buildQualityFormDownloadName("CNC/ALM-NSP.034", "xlsx")).toBe("CNC-ALM-NSP.034.xlsx");
    expect(downloadNameFromArchivedFile("LMI_2026-11-02_CNC-ALM-NSP.034.xlsx")).toBe("CNC-ALM-NSP.034.xlsx");
  });
});

describe("quality form archive status", () => {
  it("stores and hides the internal signature status", () => {
    const description = buildArchivedFormDescription(ADHESION_LEAK_TEST_FORM_TITLE, "pending-signature");
    expect(parseArchivedFormDescription(description)).toEqual({ title: ADHESION_LEAK_TEST_FORM_TITLE, status: "pending-signature" });
    expect(isPendingSignatureDescription(description)).toBe(true);
  });

  it("treats legacy adhesion forms as waiting for signature", () => {
    expect(isPendingSignatureDescription(ADHESION_LEAK_TEST_FORM_TITLE)).toBe(true);
    expect(isPendingSignatureDescription("RIR")).toBe(false);
  });
});
