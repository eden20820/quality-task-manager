import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyAdhesionLeakTest } from "./adhesion-leak-test";
import { ADHESION_LEAK_TEST_FORM_TITLE, buildArchivedFormDescription } from "./form-archive";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), archive: vi.fn(), alerts: vi.fn(), pdf: vi.fn(), removeFile: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/quality-forms/form-archive-server", () => ({ archiveQualityFormExport: mocks.archive }));
vi.mock("@/lib/email/adhesion-leak-test", () => ({ sendAdhesionLeakTestAlerts: mocks.alerts }));
vi.mock("@/lib/quality-forms/adhesion-leak-test-pdf", () => ({ buildAdhesionLeakTestPdf: mocks.pdf }));

import { POST } from "../../app/api/forms/adhesion-leak-test/save/route";
import { DELETE } from "../../app/api/forms/archive/[id]/route";

const id = "00000000-0000-4000-8000-000000000099";
const pending = buildArchivedFormDescription(ADHESION_LEAK_TEST_FORM_TITLE, "pending-signature");
let record: { id: string; description: string; storage_path: string } | null;
let client: ReturnType<typeof fakeClient>;
let deleteRows: Array<{ id: string }>;
let deleteError: { message: string } | null;

function fakeClient() {
  const chain = {
    select: vi.fn(() => chain), eq: vi.fn(() => chain), delete: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: record, error: null })),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: deleteRows, error: deleteError }).then(resolve),
  };
  return { auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "user" } } })) }, from: vi.fn(() => chain), storage: { from: vi.fn(() => ({ remove: mocks.removeFile })) } };
}

beforeEach(() => {
  vi.clearAllMocks();
  record = { id, description: pending, storage_path: "user/form-exports/sample.pdf" };
  deleteRows = [{ id }]; deleteError = null;
  client = fakeClient(); mocks.createClient.mockResolvedValue(client);
  mocks.archive.mockResolvedValue({ fileName: "form.pdf" });
  mocks.pdf.mockResolvedValue(Buffer.from("pdf"));
  mocks.alerts.mockResolvedValue([{ status: "sent" }]);
  mocks.removeFile.mockResolvedValue({ error: null });
});

function save(archiveId?: string) {
  return POST(new Request("http://localhost/api/forms/adhesion-leak-test/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload: createEmptyAdhesionLeakTest("2026-11-09"), archiveId }) }));
}
function remove() { return DELETE(new Request(`http://localhost/api/forms/archive/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) }); }

describe("archive completion notifications", () => {
  it("sends initial notifications for new forms", async () => {
    expect((await save()).status).toBe(200);
    expect(mocks.alerts).toHaveBeenCalledTimes(1);
  });
  it("saves reopened forms without sending another email", async () => {
    const response = await save(id);
    expect(response.status).toBe(200);
    expect((await response.json()).emailStatus).toBe("skipped");
    expect(mocks.archive).toHaveBeenCalledTimes(1);
    expect(mocks.alerts).not.toHaveBeenCalled();
  });
  it("rejects missing or inaccessible source forms before saving", async () => {
    record = null;
    expect((await save(id)).status).toBe(404);
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(mocks.alerts).not.toHaveBeenCalled();
  });
});

describe("pending form deletion", () => {
  it("removes the record and its exact storage path", async () => {
    expect((await remove()).status).toBe(200);
    expect(client.from().eq).toHaveBeenCalledWith("description", pending);
    expect(client.storage.from).toHaveBeenCalledWith("quality-documents");
    expect(mocks.removeFile).toHaveBeenCalledWith(["user/form-exports/sample.pdf"]);
  });
  it("rejects signed forms", async () => {
    record!.description = buildArchivedFormDescription(ADHESION_LEAK_TEST_FORM_TITLE, "signed");
    expect((await remove()).status).toBe(409);
    expect(client.storage.from).not.toHaveBeenCalled();
  });
  it("does not remove storage if the record changed or deletion was denied", async () => {
    deleteRows = [];
    expect((await remove()).status).toBe(409);
    expect(client.storage.from).not.toHaveBeenCalled();
  });
  it("rejects inaccessible forms", async () => {
    record = null;
    expect((await remove()).status).toBe(404);
    expect(client.storage.from).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    client.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "" } } });
    expect((await remove()).status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
  });
  it("reports incomplete file cleanup without claiming full deletion", async () => {
    mocks.removeFile.mockResolvedValue({ error: { message: "Storage unavailable" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await remove();
    expect(response.status).toBe(200);
    expect((await response.json()).cleanupPending).toBe(true);
    log.mockRestore();
  });
});
