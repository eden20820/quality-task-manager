import { describe, expect, it } from "vitest";
import { EcoDraftConflict, EcoDraftWriter, ecoDraftKey, validEcoDraft, type EcoDraft, type EcoDraftStorage } from "./eco-draft";
import { createEmptyEcoForm } from "./eco-form";
function memoryStorage() {
  const records = new Map<string, EcoDraft>();
  const storage: EcoDraftStorage = { replace: async (key, token, next) => {
    if ((records.get(key)?.token ?? null) !== token) throw new EcoDraftConflict();
    if (next) records.set(key, next); else records.delete(key);
  } };
  return { records, storage };
}
describe("ECO draft persistence", () => {
  it("isolates users, companies and original archive records", () => {
    expect(ecoDraftKey("org1:user1", null)).not.toBe(ecoDraftKey("org1:user2", null));
    expect(ecoDraftKey("org1:user1", null)).not.toBe(ecoDraftKey("org2:user1", null));
    expect(ecoDraftKey("org1:user1", "archive1")).not.toBe(ecoDraftKey("org1:user1", "archive2"));
  });
  it("keeps the latest complete payload including media and signatures", async () => {
    const { records, storage } = memoryStorage(); const writer = new EcoDraftWriter("draft", null, storage);
    const form = createEmptyEcoForm("2026-11-12"); form.initialApproval.signature = "data:image/png;base64,AAAA";
    await writer.write(form);
    expect(records.get("draft")?.payload).toEqual(form); expect(validEcoDraft(records.get("draft"))).toBe(true);
    expect(validEcoDraft({ ...records.get("draft"), version: 2 })).toBe(false);
    expect(validEcoDraft({ ...records.get("draft"), payload: {} })).toBe(false);
  });
  it("serializes rapid writes and deletion without recreating a completed draft", async () => {
    const { records, storage } = memoryStorage(); const writer = new EcoDraftWriter("draft", null, storage);
    const form = createEmptyEcoForm("2026-11-12");
    await Promise.all([writer.write(form), writer.write({ ...form, formNumber: "latest" })]);
    expect(records.get("draft")?.payload.formNumber).toBe("latest");
    await Promise.all([writer.write({ ...form, formNumber: "final" }), writer.clear()]);
    expect(records.has("draft")).toBe(false);
  });
  it("rejects stale-tab writes and deletes, without losing the other tab's draft", async () => {
    const { records, storage } = memoryStorage(); const first = new EcoDraftWriter("draft", null, storage), second = new EcoDraftWriter("draft", null, storage);
    const form = createEmptyEcoForm("2026-11-12"); await first.write(form);
    await expect(second.write({ ...form, formNumber: "conflict" })).rejects.toBeInstanceOf(EcoDraftConflict);
    await expect(second.clear()).rejects.toBeInstanceOf(EcoDraftConflict);
    expect(records.get("draft")?.payload.formNumber).toBe("");
  });
  it("can retry after a transient storage error without advancing the token", async () => {
    const { records, storage } = memoryStorage(); let fail = true;
    const writer = new EcoDraftWriter("draft", null, { replace: async (...args) => { if (fail) { fail = false; throw new Error("quota"); } await storage.replace(...args); } });
    const form = createEmptyEcoForm("2026-11-12");
    await expect(writer.write(form)).rejects.toThrow("quota");
    await writer.write(form); expect(records.has("draft")).toBe(true);
  });
});
