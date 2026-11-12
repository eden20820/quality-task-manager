import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ portal: vi.fn(), build: vi.fn(), archive: vi.fn() }));
vi.mock("@/lib/auth/portal-user", () => ({ getPortalUser: mocks.portal }));
vi.mock("@/lib/quality-forms/eco-form-pdf", () => ({ buildEcoFormPdf: mocks.build }));
vi.mock("@/lib/quality-forms/form-archive-server", () => ({ archiveQualityFormExport: mocks.archive }));
import { POST } from "./route";
import { createEmptyEcoForm } from "@/lib/quality-forms/eco-form";
const request = (body: unknown) => new Request("https://example.test/api/forms/eco/preview", { method: "POST", body: JSON.stringify(body) });
describe("ECO preview route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.portal.mockResolvedValue({ userId: "test", profile: { is_active: true, active_organization_id: "org" } }); mocks.build.mockResolvedValue(Buffer.from("%PDF-preview")); });
  it("requires an active user and organization", async () => {
    mocks.portal.mockResolvedValueOnce(null); expect((await POST(request({}))).status).toBe(401);
    mocks.portal.mockResolvedValueOnce({ profile: { is_active: false, active_organization_id: "org" } }); expect((await POST(request({}))).status).toBe(403);
    mocks.portal.mockResolvedValueOnce({ profile: { is_active: true, active_organization_id: null } }); expect((await POST(request({}))).status).toBe(403);
    expect(mocks.build).not.toHaveBeenCalled();
  });
  it("rejects invalid, malformed or oversized data", async () => {
    expect((await POST(request({ products: [] }))).status).toBe(400);
    expect((await POST(new Request("https://example.test", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await POST(request("x".repeat(3_800_001)))).status).toBe(413);
    expect(mocks.build).not.toHaveBeenCalled();
  });
  it("uses the export renderer but never saves a record, storage object or email", async () => {
    const payload = createEmptyEcoForm("2026-11-12"), response = await POST(request(payload));
    expect(response.status).toBe(200); expect(await response.text()).toBe("%PDF-preview");
    expect(mocks.build).toHaveBeenCalledWith(payload); expect(mocks.archive).not.toHaveBeenCalled();
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("inline"); expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("returns a recoverable error if PDF generation fails", async () => {
    mocks.build.mockRejectedValue(new Error("PDF failure"));
    const response = await POST(request(createEmptyEcoForm("2026-11-12")));
    expect(response.status).toBe(500);
  });
});
