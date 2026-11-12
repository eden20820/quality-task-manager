import { StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEcoEditor } from "./use-eco-editor";
import { ecoDraftKey, readEcoDraft, replaceEcoDraft } from "@/lib/quality-forms/eco-draft";
import { createEmptyEcoForm } from "@/lib/quality-forms/eco-form";
import { ECO_ARCHIVE_EDIT_STORAGE_KEY, ECO_ARCHIVE_RECORD_STORAGE_KEY } from "@/lib/quality-forms/form-archive";

type Editor = ReturnType<typeof useEcoEditor>;
const roots: ReactTestRenderer[] = [];
let session: Map<string, string>;
async function eventually(predicate: () => boolean) {
  for (let i = 0; i < 80; i++) { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); if (predicate()) return; }
  throw new Error("Editor did not settle");
}
async function mount(scope = "org:user", strict = false) {
  let editor: Editor;
  function Harness() { editor = useEcoEditor(scope); return null; }
  let root!: ReactTestRenderer;
  await act(async () => { root = create(strict ? <StrictMode><Harness /></StrictMode> : <Harness />); });
  roots.push(root);
  await eventually(() => Boolean(editor?.ready));
  return { get editor() { return editor!; }, root };
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  session = new Map();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => session.get(key) ?? null, removeItem: (key: string) => session.delete(key) });
  // React's renderer deprecation warning does not affect hook behavior.
  vi.spyOn(console, "error").mockImplementation((message, ...args) => { if (!String(message).includes("react-test-renderer is deprecated")) console.warn(message, ...args); });
});
afterEach(async () => { for (const root of roots.splice(0)) await act(async () => root.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("ECO editor lifecycle with real IndexedDB transactions", () => {
  it("does not autosave an untouched empty form; writes a complete draft after editing", async () => {
    const mounted = await mount();
    expect(await readEcoDraft(ecoDraftKey("org:user", null))).toBeNull();
    await act(async () => mounted.editor.setForm(p => ({ ...p, formNumber: "TEST-01", changeDescription: "שינוי בעברית mixed English" })));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)); });
    const draft = await readEcoDraft(ecoDraftKey("org:user", null));
    expect(draft?.payload.formNumber).toBe("TEST-01"); expect(draft?.payload.changeDescription).toContain("mixed English");
    expect(mounted.editor.status).toContain("טיוטה נשמרה במכשיר זה");
  });
  it("recovers after remount without replacing a draft with a blank initial state", async () => {
    const first = await mount();
    await act(async () => first.editor.setForm(p => ({ ...p, initiatorName: "Test Person", initialApproval: { ...p.initialApproval, signature: "data:image/png;base64,AAAA" } })));
    await act(async () => { await first.editor.flush(); });
    await act(async () => first.root.unmount());
    const second = await mount();
    expect(second.editor.recovery?.payload.initiatorName).toBe("Test Person");
    await act(async () => { await second.editor.resolveRecovery(true); });
    expect(second.editor.form.initialApproval.signature).toBe("data:image/png;base64,AAAA");
    expect(second.editor.canUndo).toBe(false);
    expect(second.editor.recovery).toBeNull();
  });
  it("preserves archive handoff under StrictMode and separates its draft from a new form", async () => {
    const archived = createEmptyEcoForm("2026-11-12"); archived.formNumber = "FROM-ARCHIVE"; archived.products[0].currentRevision = "03";
    session.set(ECO_ARCHIVE_EDIT_STORAGE_KEY, JSON.stringify(archived)); session.set(ECO_ARCHIVE_RECORD_STORAGE_KEY, "record-1");
    const mounted = await mount("org:user", true);
    expect(mounted.editor.archiveId).toBe("record-1"); expect(mounted.editor.form.formNumber).toBe("FROM-ARCHIVE");
    expect(mounted.editor.form.products[0].newRevision).toBe("04");
    expect(session.has(ECO_ARCHIVE_EDIT_STORAGE_KEY)).toBe(false);
    await act(async () => mounted.editor.setForm(p => ({ ...p, justification: "edited" })));
    await act(async () => { await mounted.editor.flush(); });
    expect((await readEcoDraft(ecoDraftKey("org:user", "record-1")))?.payload.justification).toBe("edited");
    expect(await readEcoDraft(ecoDraftKey("org:user", null))).toBeNull();
  });
  it("clears autosave only after completion and does not recreate it on unmount", async () => {
    const mounted = await mount();
    await act(async () => mounted.editor.setForm(p => ({ ...p, formNumber: "saved" })));
    await act(async () => { await mounted.editor.flush(); await mounted.editor.clearDraft(); });
    await act(async () => mounted.root.unmount());
    expect(await readEcoDraft(ecoDraftKey("org:user", null))).toBeNull();
  });
  it("detects concurrent-tab writes without silently overwriting", async () => {
    const first = await mount(), second = await mount();
    await act(async () => first.editor.setForm(p => ({ ...p, formNumber: "first" })));
    await act(async () => { await first.editor.flush(); });
    await act(async () => second.editor.setForm(p => ({ ...p, formNumber: "second" })));
    await act(async () => { await second.editor.flush(); });
    expect(second.editor.conflict).toBe(true); expect(second.editor.error).toContain("לשונית אחרת");
    expect((await readEcoDraft(ecoDraftKey("org:user", null)))?.payload.formNumber).toBe("first");
  });
  it("can discard a recovered draft and start new without undoing into another document", async () => {
    const payload = createEmptyEcoForm("2026-11-12"); payload.formNumber = "old";
    await replaceEcoDraft(ecoDraftKey("org:user", null), null, { version: 1, token: "initial", updatedAt: new Date().toISOString(), payload });
    const mounted = await mount();
    await act(async () => { await mounted.editor.resolveRecovery(false); });
    expect(mounted.editor.form.formNumber).toBe(""); expect(await readEcoDraft(ecoDraftKey("org:user", null))).toBeNull();
    await act(async () => mounted.editor.setForm(p => ({ ...p, formNumber: "new" })));
    await act(async () => { await mounted.editor.startNew(); });
    expect(mounted.editor.canUndo).toBe(false); expect(mounted.editor.form.formNumber).toBe("");
  });
  it("allows editing and cleaning when browser storage is unavailable, with a visible warning", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const mounted = await mount();
    expect(mounted.editor.error).toContain("השמירה האוטומטית אינה זמינה");
    await act(async () => mounted.editor.setForm(p => ({ ...p, formNumber: "manual" })));
    expect(mounted.editor.form.formNumber).toBe("manual");
    await act(async () => { await mounted.editor.startNew(); });
    expect(mounted.editor.form.formNumber).toBe("");
  });
});
