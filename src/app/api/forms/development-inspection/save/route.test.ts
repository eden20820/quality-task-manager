import { beforeEach, expect, it, vi } from "vitest";
import { createEmptyDevelopmentInspection } from "@/lib/quality-forms/development-inspection";

const mocks = vi.hoisted(() => ({ archive: vi.fn(), purchase: vi.fn(), pdf: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: "test-user" } } }) } }) }));
vi.mock("@/lib/quality-forms/form-archive-server", () => ({ archiveQualityFormExport: mocks.archive, FormArchiveError: class extends Error {} }));
vi.mock("@/lib/quality-forms/development-inspection-pdf", () => ({ buildDevelopmentInspectionPdf: mocks.pdf }));
vi.mock("@/lib/email/development-inspection", () => ({ sendDevelopmentInspectionToPurchasing: mocks.purchase }));
import { POST } from "./route";

const payload = createEmptyDevelopmentInspection("2026-11-23");
const originalId = "00000000-0000-4000-8000-000000000099";
function submit(form: typeof payload, archiveId?: string) {
  return POST(new Request("https://example.com/api/forms/development-inspection/save", { method: "POST", body: JSON.stringify({ payload: form, archiveId }) }));
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.pdf.mockResolvedValue(new Uint8Array([37, 80]));
  mocks.purchase.mockResolvedValue("sent");
  mocks.archive.mockImplementation(async ({ formStatus }) => ({ id: "saved-id", record: { organization_id: "caeli" }, fileName: "saved.pdf", formStatus, emailStatus: formStatus === "signed" ? "skipped" : "sent" }));
});

it("routes an unsigned form to pending, then sends to purchasing", async () => {
  const response = await submit({ ...payload, checkedBySignature: "signature", approvedBySignature: " " });
  expect(await response.json()).toMatchObject({ saved: true, formStatus: "pending-signature", emailStatus: "sent", purchasingStatus: "sent" });
  expect(mocks.purchase).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "caeli", pending: true, fileName: "saved.pdf", bytes: new Uint8Array([37, 80]) }));
  expect(mocks.archive.mock.invocationCallOrder[0]).toBeLessThan(mocks.purchase.mock.invocationCallOrder[0]);
});

it("replaces an existing form in the regular archive after both signatures and reports mail failure separately", async () => {
  mocks.purchase.mockRejectedValue(new Error("provider unavailable"));
  const response = await submit({ ...payload, checkedBySignature: "signature", approvedBySignature: "signature" }, originalId);
  expect(await response.json()).toMatchObject({ saved: true, formStatus: "signed", emailStatus: "skipped", purchasingStatus: "failed" });
  expect(mocks.archive).toHaveBeenCalledWith(expect.objectContaining({ archiveId: originalId, recheckPendingOnEdit: true }));
  expect(mocks.purchase).toHaveBeenCalledWith(expect.objectContaining({ pending: false }));
});

it("never sends a purchasing email if archive persistence fails", async () => {
  mocks.archive.mockRejectedValue(new Error("archive unavailable"));
  expect((await submit(payload)).status).toBe(500);
  expect(mocks.purchase).not.toHaveBeenCalled();
});
