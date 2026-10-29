import { describe, expect, it } from "vitest";

import { buildRirWorkbook } from "./rir-excel";
import { resizeMeasurementRows, type RirFormPayload } from "./rir";

function examplePayload(): RirFormPayload {
  const rows = resizeMeasurementRows([], 3, 2);
  rows[0] = { ...rows[0], values: ["10", "3.2"], visual: "Pass", functional: "Pass" };
  rows[1] = { ...rows[1], values: ["11", "3.4"], visual: "Pass", functional: "Fail" };
  rows[2] = { ...rows[2], values: ["15", "3.3"], visual: "Fail", functional: "Pass" };
  return {
    details: {
      catalogNumber: "CAT-100",
      partName: "Test Part",
      supplierName: "Test Supplier",
      receivedQuantity: "50",
      orderNumber: "PO-20",
      lotNumber: "",
      drawingNumber: "DWG-1",
      drawingRevision: "",
      comments: "Incoming inspection",
      documents: { coc: true, cot: false, coa: true, other: false },
      otherDocument: "",
    },
    sampleSize: 3,
    attributes: [
      { id: "a1", name: "Length", equipment: "Caliper", min: "9", max: "12" },
      { id: "a2", name: "Width", equipment: "Micrometer", min: "3", max: "4" },
    ],
    rows,
    approval: {
      disposition: "approved",
      ncNumber: "",
      ncDecision: "",
      specialConditions: "",
      approvedParts: "49",
      rejectedParts: "1",
      inspectorName: "Sergey Dror",
      inspectionDate: "2026-10-29",
      reviewerName: "Reviewer",
      reviewDate: "2026-10-29",
    },
  };
}

describe("RIR Excel export", () => {
  it("creates a downloadable workbook with values, formulas and the inspection decision", async () => {
    const workbook = await buildRirWorkbook(examplePayload());
    const worksheet = workbook.getWorksheet("RIR");
    expect(worksheet?.getCell("A1").value).toBe("Receiving Inspection Report (RIR)");
    expect(worksheet?.getCell("C2").value).toBe("Rev.: 00");
    expect(worksheet?.getCell("B3").value).toBe("CAT-100");
    expect(worksheet?.getCell("E5").value).toBe("N/A");
    expect(worksheet?.getCell("E6").value).toBe("00");
    expect(worksheet?.getCell("D16").value).toBe(10);
    expect(worksheet?.getCell("D14").numFmt).toBe("0.00");
    expect(worksheet?.getCell("D15").numFmt).toBe("0.00");
    expect(worksheet?.getCell("D16").numFmt).toBe("0.00");
    expect(worksheet?.getCell("E16").numFmt).toBe("0.000");
    expect(worksheet?.getCell("D19").value).toMatchObject({ formula: expect.stringContaining("MAX") });
    expect(worksheet?.getCell("D19").numFmt).toBe("0.00");
    expect(worksheet?.getCell("D22").value).toMatchObject({ formula: expect.stringContaining("STDEV(") });
    expect(worksheet?.getCell("B32").value).toBe("Sergey Dror");
    expect(worksheet?.getCell("B33").value).toBe("Uzi Barzilay");
    expect(worksheet?.getImages()).toHaveLength(3);
    expect(worksheet?.getImages()[0]?.range).toMatchObject({ ext: { width: 61, height: 43 } });

    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(5_000);

    const { Workbook } = await import("exceljs");
    const reloaded = new Workbook();
    await reloaded.xlsx.load(buffer);
    const restored = reloaded.getWorksheet("RIR");
    expect(restored?.getCell("A1").value).toBe("Receiving Inspection Report (RIR)");
    expect(restored?.getCell("D16").value).toBe(10);
    expect(restored?.getCell("B32").value).toBe("Sergey Dror");
  });
});
