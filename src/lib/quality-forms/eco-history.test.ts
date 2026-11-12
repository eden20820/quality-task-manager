import { describe, expect, it } from "vitest";
import { createEcoHistory, ecoHistoryReducer as reduce, type EcoHistory } from "./eco-history";
import { createEmptyEcoForm, type EcoFormPayload } from "./eco-form";
import { insertEcoBlock, moveEcoBlock, removeEcoBlock, getEcoLayout } from "./eco-layout";
const empty = () => createEmptyEcoForm("2026-11-12");
const edit = (state: EcoHistory, apply: (form: EcoFormPayload) => EcoFormPayload, at = 1) => reduce(state, { type: "edit", apply, at });
describe("ECO document undo/redo", () => {
  it("groups typing within one field but starts new undo steps for another field or a pause", () => {
    let state = createEcoHistory(empty());
    state = edit(state, p => ({ ...p, initiatorName: "A" }), 100);
    state = edit(state, p => ({ ...p, initiatorName: "Ab" }), 200);
    expect(state.past).toHaveLength(1);
    state = edit(state, p => ({ ...p, initiatorRole: "QC" }), 250);
    state = edit(state, p => ({ ...p, initiatorRole: "Quality" }), 1000);
    expect(state.past).toHaveLength(3);
    state = reduce(state, { type: "undo" }); expect(state.present.initiatorRole).toBe("QC");
    state = reduce(state, { type: "undo" }); expect(state.present.initiatorRole).toBe(""); expect(state.present.initiatorName).toBe("Ab");
    state = reduce(state, { type: "undo" }); expect(state.present.initiatorName).toBe("");
    state = reduce(state, { type: "redo" }); expect(state.present.initiatorName).toBe("Ab");
  });
  it("restores deleted text blocks and layout order without mutating snapshots", () => {
    let state = createEcoHistory(empty());
    state = edit(state, p => insertEcoBlock(p, "text", "extra", "description"));
    const withText = state.present;
    state = edit(state, p => moveEcoBlock(p, "extra", 0));
    expect(getEcoLayout(state.present)[0].id).toBe("extra");
    state = edit(state, p => removeEcoBlock(p, "extra"));
    state = reduce(state, { type: "undo" }); expect(getEcoLayout(state.present)[0].id).toBe("extra");
    state = reduce(state, { type: "undo" }); expect(state.present).toBe(withText);
  });
  it("undoes catalog fills, products, media and signatures atomically", () => {
    let state = createEcoHistory(empty());
    const initial = state.present;
    state = edit(state, p => ({ ...p, products: [{ partName: "Part", catalogNumber: "TEST-001", currentRevision: "00", newRevision: "01" }] }));
    state = edit(state, p => ({ ...p, initialApproval: { ...p.initialApproval, signature: "data:image/png;base64,AAAA" } }));
    const signed = state.present;
    state = reduce(state, { type: "undo" }); expect(state.present.initialApproval.signature).toBe(""); expect(signed.initialApproval.signature).not.toBe("");
    state = reduce(state, { type: "undo" }); expect(state.present).toBe(initial);
  });
  it("discards the redo branch after a new edit and clears history across documents", () => {
    let state = edit(createEcoHistory(empty()), p => ({ ...p, formNumber: "001" }));
    state = reduce(state, { type: "undo" });
    state = edit(state, p => ({ ...p, formNumber: "002" }));
    expect(state.future).toEqual([]);
    state = reduce(state, { type: "reset", form: empty() }); expect(state.past).toEqual([]); expect(state.future).toEqual([]);
  });
  it("bounds history and keeps checkbox operations separate", () => {
    let state = createEcoHistory(empty());
    for (let i = 0; i < 80; i++) state = edit(state, p => ({ ...p, categories: p.categories.map((value, index) => index ? value : !value) }), i);
    expect(state.past).toHaveLength(50);
    expect(reduce(state, { type: "undo" }).present.categories[0]).toBe(true);
  });
});
