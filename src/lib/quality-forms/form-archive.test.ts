import { describe, expect, it } from "vitest";

import { buildQualityFormDownloadName, buildQualityFormFileName, downloadNameFromArchivedFile } from "./form-archive";

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
