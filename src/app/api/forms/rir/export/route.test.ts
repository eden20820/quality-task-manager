import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), directory: vi.fn(), build: vi.fn(), archive: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims } }) }));
vi.mock("@/lib/quality-forms/supplier-binder-directory", () => ({ loadSupplierBinderDirectory: mocks.directory }));
vi.mock("@/lib/quality-forms/rir-excel", () => ({ buildRirWorkbook: mocks.build }));
vi.mock("@/lib/quality-forms/form-archive-server", () => ({ archiveQualityFormExport: mocks.archive }));
import { POST } from "./route";

function request() {
  return new Request("https://example.test/api/forms/rir/export", { method: "POST", body: JSON.stringify({
    details: { supplierName: "NAUTEC", drawingRevision: "00" }, approval: {},
    attributes: [], rows: [{ values: [] }], includeVisual: true, includeFunctional: false,
    supplierBinderLabels: ["untrusted client location"],
  }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "employee" } } });
  mocks.directory.mockResolvedValue([{ name: "Nautec", binderLabel: "IV-B" }]);
  mocks.build.mockResolvedValue({ eachSheet: vi.fn(), xlsx: { writeBuffer: async () => Buffer.from("workbook") } });
  mocks.archive.mockResolvedValue({ fileName: "report.xlsx" });
});
describe("RIR binder location export", () => {
  it("uses the current session directory, never a supplied client binder label", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.directory).toHaveBeenCalledWith({ allowFallback: false });
    expect(mocks.build).toHaveBeenCalledWith(expect.anything(), { supplierBinderLabels: ["IV-B"] });
  });
  it("passes no labels when there is no match", async () => {
    mocks.directory.mockResolvedValue([]);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.build).toHaveBeenCalledWith(expect.anything(), { supplierBinderLabels: [] });
  });
  it("rejects unauthenticated requests before querying binder data", async () => {
    mocks.claims.mockResolvedValue({ data: null });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.directory).not.toHaveBeenCalled();
  });
  it("does not archive a false location if loading the directory fails", async () => {
    mocks.directory.mockRejectedValue(new Error("directory unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(500);
      expect(mocks.build).not.toHaveBeenCalled();
      expect(mocks.archive).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
