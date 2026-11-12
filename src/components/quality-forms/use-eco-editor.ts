"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type SetStateAction } from "react";
import { createEcoHistory, ecoHistoryReducer } from "@/lib/quality-forms/eco-history";
import { EcoDraftConflict, EcoDraftWriter, ecoDraftKey, readEcoDraft, type EcoDraft } from "@/lib/quality-forms/eco-draft";
import { createEmptyEcoForm, isEcoFormPayload, nextEcoRevision, type EcoFormPayload } from "@/lib/quality-forms/eco-form";
import { ECO_ARCHIVE_EDIT_STORAGE_KEY, ECO_ARCHIVE_RECORD_STORAGE_KEY } from "@/lib/quality-forms/form-archive";

function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()); }
export function useEcoEditor(scope: string) {
  const [history, dispatch] = useReducer(ecoHistoryReducer, undefined, () => createEcoHistory(createEmptyEcoForm(today())));
  const form = history.present;
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<EcoDraft | null>(null);
  const [status, setStatus] = useState("טוען טיוטה…");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const state = useRef({ form, saved: form, writer: null as EcoDraftWriter | null, ready: false, recovering: false, mounted: false, saving: 0 });
  useEffect(() => { state.current.form = form; }, [form]);
  const setForm = useCallback((apply: SetStateAction<EcoFormPayload>) => dispatch({ type: "edit", apply, at: Date.now() }), []);
  const reset = useCallback((payload: EcoFormPayload) => { state.current.form = payload; state.current.saved = payload; dispatch({ type: "reset", form: payload }); }, []);

  useEffect(() => {
    let active = true;
    state.current.ready = false;
    state.current.writer = null;
    state.current.recovering = false;
    setReady(false); setRecovery(null); setConflict(false);
    state.current.mounted = true;
    async function load() {
      let payload = createEmptyEcoForm(today()), id: string | null = null, raw: string | null = null;
      try {
        raw = sessionStorage.getItem(ECO_ARCHIVE_EDIT_STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (!isEcoFormPayload(parsed)) throw new Error("לא ניתן לטעון את הטופס השמור");
          payload = { ...parsed, products: parsed.products.map(product => ({ ...product, newRevision: product.newRevision || nextEcoRevision(product.currentRevision) })) };
          id = sessionStorage.getItem(ECO_ARCHIVE_RECORD_STORAGE_KEY);
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "טעינת הטופס נכשלה"); }
      try {
        if (!scope) throw new Error("לא ניתן לזהות את המשתמש לשמירה אוטומטית");
        const key = ecoDraftKey(scope, id), draft = await readEcoDraft(key);
        if (!active) return;
        state.current.writer = new EcoDraftWriter(key, draft?.token ?? null);
        if (draft) { setRecovery(draft); state.current.recovering = true; }
        setStatus(draft ? "נמצאה טיוטה במכשיר זה" : "שמירה אוטומטית במכשיר זה פעילה");
      } catch { if (active) { setError("השמירה האוטומטית אינה זמינה. אפשר להמשיך ולשמור ידנית במערכת"); setStatus("שמירה אוטומטית אינה זמינה"); } }
      if (!active) return;
      reset(payload); setArchiveId(id); setReady(true); state.current.ready = true;
      // Consume archive handoff only after initialization, also safe in StrictMode.
      if (raw) { sessionStorage.removeItem(ECO_ARCHIVE_EDIT_STORAGE_KEY); sessionStorage.removeItem(ECO_ARCHIVE_RECORD_STORAGE_KEY); }
    }
    void load();
    return () => { active = false; state.current.mounted = false; };
  }, [scope, reset]);

  const flush = useCallback(async () => {
    const current = state.current;
    if (!current.ready || current.recovering || current.form === current.saved) return;
    if (!current.writer) return;
    const payload = current.form;
    current.saving++;
    if (current.mounted) setStatus("שומר טיוטה במכשיר זה…");
    try {
      const savedAt = await current.writer.write(payload);
      current.saved = payload;
      if (current.mounted) {
        setError(null);
        setStatus(current.form === payload ? `טיוטה נשמרה במכשיר זה · ${new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date(savedAt))}` : "ממתין לשמירת השינויים האחרונים…");
      }
    } catch (cause) {
      if (current.mounted) { setError(cause instanceof EcoDraftConflict ? cause.message : "הטיוטה לא נשמרה. נסו שוב או שמרו ידנית במערכת"); setStatus("הטיוטה לא נשמרה"); if (cause instanceof EcoDraftConflict) setConflict(true); }
    } finally { current.saving--; }
  }, []);

  useEffect(() => {
    if (!ready || recovery || form === state.current.saved) return;
    const timer = setTimeout(() => void flush(), 500);
    return () => clearTimeout(timer);
  }, [form, ready, recovery, flush]);
  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") void flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = state.current;
      if (current.ready && !current.recovering && (current.form !== current.saved || current.saving > 0)) { event.preventDefault(); event.returnValue = ""; void flush(); }
    };
    document.addEventListener("visibilitychange", hide); window.addEventListener("beforeunload", beforeUnload);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("beforeunload", beforeUnload); void flush(); };
  }, [flush]);

  async function clearDraft() {
    // Queue deletion AFTER any pending autosave. Do not re-save on navigation.
    const current = state.current;
    const previous = current.saved;
    current.saved = current.form;
    try { if (current.writer) await current.writer.clear(); }
    catch (cause) { current.saved = previous; throw cause; }
    current.saved = current.form;
  }
  async function retryAutosave() {
    if (state.current.writer) { await flush(); return; }
    try {
      if (!scope) return;
      const key = ecoDraftKey(scope, archiveId), draft = await readEcoDraft(key);
      state.current.writer = new EcoDraftWriter(key, draft?.token ?? null);
      setError(null);
      if (draft) { state.current.recovering = true; setRecovery(draft); setStatus("נמצאה טיוטה במכשיר זה"); }
      else { setStatus("שמירה אוטומטית במכשיר זה פעילה"); await flush(); }
    } catch { setError("אחסון הטיוטות עדיין אינו זמין. יש לשמור ידנית במערכת"); }
  }
  async function resolveRecovery(restore: boolean) {
    if (!recovery) return;
    if (restore) reset(recovery.payload);
    else { try { await clearDraft(); } catch { setError("לא ניתן להסיר את הטיוטה. נסו שוב או רעננו את הדף"); return; } }
    state.current.recovering = false; setRecovery(null); setStatus(restore ? "הטיוטה שוחזרה · נשמרת במכשיר זה" : "שמירה אוטומטית במכשיר זה פעילה");
  }
  async function startNew() {
    await clearDraft();
    if (!state.current.writer) { reset(createEmptyEcoForm(today())); setArchiveId(null); return; }
    const key = ecoDraftKey(scope, null), draft = await readEcoDraft(key);
    state.current.writer = new EcoDraftWriter(key, draft?.token ?? null);
    reset(createEmptyEcoForm(today())); setArchiveId(null); setRecovery(draft); state.current.recovering = Boolean(draft);
    setError(null); setConflict(false); setStatus(draft ? "נמצאה טיוטה במכשיר זה" : "שמירה אוטומטית במכשיר זה פעילה");
  }
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  return { form, setForm, archiveId, ready, recovery, resolveRecovery, status, error, conflict, flush, retryAutosave, clearDraft, startNew, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
