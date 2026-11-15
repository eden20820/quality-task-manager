import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), archive: vi.fn(), docx: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims } }) }));
vi.mock("@/lib/quality-forms/form-archive-server", () => ({ archiveQualityFormExport: mocks.archive, FormArchiveError: class extends Error {} }));
vi.mock("@/lib/quality-forms/shelf-product-docx", () => ({ buildShelfProductInspectionDocx: mocks.docx }));
import { POST } from "./route";
import { createEmptyShelfInspection } from "@/lib/quality-forms/shelf-product-inspection";
beforeEach(() => { vi.clearAllMocks(); mocks.claims.mockResolvedValue({ data: { claims: { sub: "user" } } }); mocks.docx.mockResolvedValue(Buffer.from("docx")); mocks.archive.mockImplementation(async input => ({ id: "new", fileName: "form.docx", formStatus: input.formStatus, emailStatus: input.archiveId ? "skipped" : "sent" })); });
const request = (payload: unknown, archiveId?: string) => new Request("http://test/api/forms/shelf-product-inspection/save", { method: "POST", body: JSON.stringify({ payload, archiveId }) });
describe("shelf product signature workflow", () => {
  it("marks a missing signature pending and routes the new record through notifications", async () => {
    const p = { ...createEmptyShelfInspection("2026-11-12"), includeApproverSignature: false };
    const response = await POST(request(p)); expect(response.status).toBe(200); expect((await response.json()).emailStatus).toBe("sent");
    expect(mocks.archive).toHaveBeenCalledWith(expect.objectContaining({ formStatus: "pending-signature", archiveId: null }));
  });
  it("replaces the original pending record when signatures are completed, skipping a new notice", async () => {
    const response = await POST(request(createEmptyShelfInspection("2026-11-12"), "source-id")); expect(response.status).toBe(200);
    expect((await response.json()).emailStatus).toBe("skipped"); expect(mocks.archive).toHaveBeenCalledWith(expect.objectContaining({ archiveId: "source-id", formStatus: "signed" }));
  });
  it("rejects unauthenticated or invalid requests before creating files", async () => {
    mocks.claims.mockResolvedValueOnce({ data: null }); expect((await POST(request({}))).status).toBe(401);
    expect((await POST(request({}))).status).toBe(400); expect(mocks.docx).not.toHaveBeenCalled();
  });
});
