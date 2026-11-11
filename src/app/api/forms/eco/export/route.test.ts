import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), build: vi.fn(), archive: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims } }) }));
vi.mock("@/lib/quality-forms/eco-form-pdf", () => ({ buildEcoFormPdf: mocks.build }));
vi.mock("@/lib/quality-forms/form-archive-server", () => ({ archiveQualityFormExport: mocks.archive }));
import { POST } from "./route";
import { createEmptyEcoForm } from "@/lib/quality-forms/eco-form";
describe("ECO PDF export route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.claims.mockResolvedValue({ data: { claims: { sub: "user" } } }); mocks.build.mockResolvedValue(Buffer.from("%PDF-test")); mocks.archive.mockResolvedValue({ fileName: "ECO.pdf" }); });
  const request = (body: unknown) => new Request("https://example.test/api/forms/eco/export", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  it("requires login before processing or archiving any data", async () => {
    mocks.claims.mockResolvedValue({ data: null });
    expect((await POST(request(createEmptyEcoForm("2026-11-11")))).status).toBe(401);
    expect(mocks.build).not.toHaveBeenCalled(); expect(mocks.archive).not.toHaveBeenCalled();
  });
  it("rejects malformed payloads", async () => { expect((await POST(request({ products: [] }))).status).toBe(400); expect(mocks.archive).not.toHaveBeenCalled(); });
  it("exports and archives editable incomplete drafts without sending an email", async () => {
    const payload = createEmptyEcoForm("2026-11-11"); payload.formNumber = "022-2026";
    const response = await POST(request(payload));
    expect(response.status).toBe(200); expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(mocks.build).toHaveBeenCalledWith(payload);
    expect(mocks.archive).toHaveBeenCalledWith(expect.objectContaining({ formTitle: "טופס ECO", catalogNumber: "022-2026", formStatus: "pending-signature" }));
  });
});
