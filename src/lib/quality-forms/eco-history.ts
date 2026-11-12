import type { EcoFormPayload } from "./eco-form";

export type EcoHistory = { present: EcoFormPayload; past: EcoFormPayload[]; future: EcoFormPayload[]; editPath: string | null; editAt: number };
export type EcoHistoryAction = { type: "edit"; apply: EcoFormPayload | ((form: EcoFormPayload) => EcoFormPayload); at: number } | { type: "reset"; form: EcoFormPayload } | { type: "undo" } | { type: "redo" };
export const createEcoHistory = (present: EcoFormPayload): EcoHistory => ({ present, past: [], future: [], editPath: null, editAt: 0 });

// Coalesce consecutive typing in ONE text field, never structural edits or media.
function typingPath(before: unknown, after: unknown, path = "", changed: string[] = []): string[] {
  if (before === after || changed.length > 1) return changed;
  if (typeof before === "string" && typeof after === "string") { changed.push(path); return changed; }
  if (!before || !after || typeof before !== "object" || typeof after !== "object" || Array.isArray(before) !== Array.isArray(after)) { changed.push("!", "!"); return changed; }
  const a = before as Record<string, unknown>, b = after as Record<string, unknown>;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length || keys.some(key => !(key in b))) { changed.push("!", "!"); return changed; }
  for (const key of keys) { typingPath(a[key], b[key], `${path}.${key}`, changed); if (changed.length > 1) break; }
  return changed;
}
export function ecoHistoryReducer(state: EcoHistory, action: EcoHistoryAction): EcoHistory {
  if (action.type === "reset") return createEcoHistory(action.form);
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return { present: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.present, ...state.future], editPath: null, editAt: 0 };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return { present: state.future[0], past: [...state.past, state.present].slice(-50), future: state.future.slice(1), editPath: null, editAt: 0 };
  }
  const next = typeof action.apply === "function" ? action.apply(state.present) : action.apply;
  if (next === state.present) return state;
  const paths = typingPath(state.present, next);
  const path = paths.length === 1 && /\.(formNumber|initiatorName|initiatorRole|otherCategory|partName|catalogNumber|currentRevision|newRevision|changeDescription|justification|productImpact|qualitySystemImpact|regulatoryImpact|inventoryOther|openOrdersOther|additionalTasks|name|notes|reason|survey|title|text|beforeLabel|afterLabel|beforeCaption|afterCaption)$/.test(paths[0]) ? paths[0] : null;
  const grouped = path !== null && state.editPath === path && action.at - state.editAt < 700 && action.at >= state.editAt && !state.future.length;
  return { present: next, past: grouped ? state.past : [...state.past, state.present].slice(-50), future: [], editPath: path, editAt: action.at };
}
