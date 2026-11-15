import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), alerts: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/email/pending-form", () => ({ sendPendingFormAlerts: mocks.alerts }));
import { archiveQualityFormExport } from "./form-archive-server";
import { ADHESION_LEAK_TEST_FORM_TITLE, buildArchivedFormDescription, isPendingSignatureDescription } from "./form-archive";
type Row = Record<string, unknown> & { id: string; storage_path: string; description: string };
const oldId = "00000000-0000-4000-8000-000000000099";
let rows: Map<string, Row>, deleteDenied: Set<string>, missingOnDelete: Set<string>, insertFails: boolean, serial: number;
const upload = vi.fn(), remove = vi.fn();
function query() {
  let op = "read", values: Record<string, unknown> = {}, filters: Array<[string, unknown]> = [];
  const run = async () => {
    if (op === "insert") {
      if (insertFails) return { data: null, error: { message: "Insert denied" } };
      const row: Row = { ...values, id: `new-${++serial}`, storage_path: String(values.storage_path), description: String(values.description), created_at: "2026-11-12T10:00:00Z" }; rows.set(row.id, row); return { data: row, error: null };
    }
    const matched = [...rows.values()].filter(row => filters.every(([key, value]) => row[key] === value));
    if (op === "delete") {
      if (matched.some(row => deleteDenied.has(row.id))) return { data: null, error: { message: "Delete denied" } };
      const removed = matched.filter(row => !missingOnDelete.has(row.id)); removed.forEach(row => rows.delete(row.id)); return { data: removed.map(row => ({ id: row.id })), error: null };
    }
    return { data: matched[0] ?? null, error: null };
  };
  const chain = { select: vi.fn(() => chain), eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return chain; }), insert: vi.fn((input: Record<string, unknown>) => { op = "insert"; values = input; return chain; }), delete: vi.fn(() => { op = "delete"; return chain; }), single: run, maybeSingle: run, then: (resolve: (result: unknown) => unknown) => run().then(resolve) };
  return chain;
}
const input = { bytes: new Uint8Array([1, 2]), supplierName: "Synthetic", date: "2026-11-12", catalogNumber: "TEST-001", extension: "pdf", mimeType: "application/pdf", formTitle: ADHESION_LEAK_TEST_FORM_TITLE, formStatus: "pending-signature" as const };
beforeEach(() => {
  vi.clearAllMocks(); rows = new Map(); deleteDenied = new Set(); missingOnDelete = new Set(); insertFails = false; serial = 0;
  upload.mockResolvedValue({ error: null }); remove.mockResolvedValue({ error: null }); mocks.alerts.mockResolvedValue("sent");
  mocks.client.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: { sub: "test-user" } } }) }, from: () => query(), storage: { from: () => ({ upload, remove }) } });
});
function previous(status = "pending-signature") {
  rows.set(oldId, { id: oldId, organization_id: "original-company", storage_path: "old.pdf", category: "טופס מקוון", description: buildArchivedFormDescription(input.formTitle, status as "signed" | "pending-signature") });
}
describe("archive replacement and pending signature notification", () => {
  it("notifies on a new pending form, but never on signed exports", async () => {
    expect((await archiveQualityFormExport(input)).emailStatus).toBe("sent"); expect(mocks.alerts).toHaveBeenCalledTimes(1);
    expect((await archiveQualityFormExport({ ...input, formStatus: "signed" })).emailStatus).toBe("skipped"); expect(mocks.alerts).toHaveBeenCalledTimes(1);
  });
  it("replaces the pending record with signed status, retaining no pending copy or duplicate email", async () => {
    previous(); const result = await archiveQualityFormExport({ ...input, formStatus: "signed", archiveId: oldId });
    expect(rows.has(oldId)).toBe(false); expect(rows.size).toBe(1); expect(isPendingSignatureDescription(result.record.description)).toBe(false);
    expect(result.record.organization_id).toBe("original-company");
    expect(result.emailStatus).toBe("skipped"); expect(mocks.alerts).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledWith(["old.pdf"]);
  });
  it("rolls back the replacement when the old pending record cannot be removed", async () => {
    previous(); deleteDenied.add(oldId);
    await expect(archiveQualityFormExport({ ...input, formStatus: "signed", archiveId: oldId })).rejects.toThrow("השמירה לא הושלמה");
    expect(rows.size).toBe(1); expect(rows.has(oldId)).toBe(true); expect(remove).not.toHaveBeenCalledWith(["old.pdf"]); expect(mocks.alerts).not.toHaveBeenCalled();
  });
  it("treats zero-row concurrent deletion as a conflict and rolls back the new copy", async () => {
    previous(); missingOnDelete.add(oldId);
    await expect(archiveQualityFormExport({ ...input, archiveId: oldId })).rejects.toThrow("השמירה לא הושלמה"); expect(rows.size).toBe(1);
  });
  it("never overwrites an inaccessible or wrong-type original", async () => {
    await expect(archiveQualityFormExport({ ...input, archiveId: oldId })).rejects.toThrow("הטופס המקורי"); expect(upload).not.toHaveBeenCalled();
    previous(); rows.get(oldId)!.description = "Other form";
    await expect(archiveQualityFormExport({ ...input, archiveId: oldId })).rejects.toThrow("הטופס המקורי"); expect(upload).not.toHaveBeenCalled();
  });
  it("keeps manual archive distinct from signed, and preserves it on subsequent unsigned edits", async () => {
    previous(); let result = await archiveQualityFormExport({ ...input, formStatus: "archived", archiveId: oldId });
    expect(result.formStatus).toBe("archived"); expect(isPendingSignatureDescription(result.record.description)).toBe(false);
    const currentId = "00000000-0000-4000-8000-000000000098"; const row = rows.get(result.id)!; rows.delete(result.id); rows.set(currentId, { ...row, id: currentId });
    result = await archiveQualityFormExport({ ...input, archiveId: currentId }); expect(result.formStatus).toBe("archived"); expect(mocks.alerts).not.toHaveBeenCalled();
  });
  it("retains the original if upload or insert fails and cleans up an unrecorded new file", async () => {
    previous(); insertFails = true;
    await expect(archiveQualityFormExport({ ...input, archiveId: oldId })).rejects.toThrow("ARCHIVE_RECORD_FAILED");
    expect(rows.size).toBe(1); expect(remove).toHaveBeenCalledTimes(1); expect(mocks.alerts).not.toHaveBeenCalled();
  });
  it("reports email failure without losing the saved form", async () => {
    mocks.alerts.mockRejectedValue(new Error("Provider unavailable"));
    const result = await archiveQualityFormExport(input); expect(result.emailStatus).toBe("failed"); expect(rows.size).toBe(1);
  });
});
