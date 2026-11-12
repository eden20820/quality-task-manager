"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, ArrowUp, ArrowDown, Download, Eye, List, Loader2, Plus, RotateCcw, Save, Trash2, PenLine, Undo2, Redo2 } from "lucide-react";
import { toast } from "sonner";
import { CatalogInput } from "./catalog-input";
import { EcoAttachments } from "./eco-attachments";
import { ECO_MEDIA_BUDGET, ecoMediaSize, type EcoAttachment } from "@/lib/quality-forms/eco-files";
import { EcoDocumentBlock, EcoInsertControls } from "./eco-document-block";
import { changeEcoIllustration, changeEcoText, ecoBlockTitle, getEcoLayout, insertEcoBlock, moveEcoBlock, removeEcoBlock, type EcoInsertKind, type EcoSection } from "@/lib/quality-forms/eco-layout";
import { EcoIllustrations } from "./eco-illustrations";
import { EcoPreview } from "./eco-preview";
import { useEcoEditor } from "./use-eco-editor";
import { SignaturePad } from "./signature-pad";
import { resolveCatalogItem, type CatalogItem } from "@/lib/quality-forms/parts-catalog";
import { emptyEcoProduct, updateEcoProduct, ECO_ACTIONS, ECO_CATEGORIES, type EcoFormPayload, type EcoProduct, type EcoSignature, type EcoRequirement } from "@/lib/quality-forms/eco-form";
import { buildQualityFormDownloadName } from "@/lib/quality-forms/form-archive";

const inputClass = "h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
function navigate(event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
  if (event.key !== "Enter" && !(event.currentTarget instanceof HTMLInputElement && ["ArrowDown", "ArrowUp"].includes(event.key))) return;
  const entries = Array.from(event.currentTarget.closest("[data-eco-form]")?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-eco-entry]") ?? []).filter(entry => !entry.disabled && entry.getClientRects().length);
  const target = entries[entries.indexOf(event.currentTarget) + (event.key === "ArrowUp" || event.shiftKey ? -1 : 1)];
  if (target) { event.preventDefault(); target.focus(); if (target instanceof HTMLInputElement) target.select(); }
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "date" }) { return <label className="block min-w-0 text-sm font-bold text-slate-700"><span className="mb-2 block">{label}</span><input data-eco-entry type={type} value={value} onChange={event => onChange(event.target.value)} onKeyDown={navigate} className={inputClass} /></label>; }
function Paragraph({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) { return <label className="block overflow-hidden border border-slate-400"><span className="block border-b border-slate-400 bg-slate-100 px-4 py-3 font-bold">{label}</span><textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} dir="auto" className="block w-full resize-y bg-white p-4 text-justify [text-align-last:start] text-base leading-7 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400" /></label>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-4 rounded-xl border border-slate-300 bg-white p-4 sm:p-6"><h2 className="border-b border-slate-200 pb-3 text-xl font-black">{title}</h2>{children}</section>; }
function SignatureFields({ title, value, onChange }: { title: string; value: EcoSignature; onChange: (value: EcoSignature) => void }) { return <div className="space-y-3"><h3 className="font-bold">{title}</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="שם" value={value.name} onChange={name => onChange({ ...value, name })} /><Field label="תאריך" type="date" value={value.date} onChange={date => onChange({ ...value, date })} /></div><SignaturePad label="חתימה" value={value.signature} onChange={signature => onChange({ ...value, signature })} /></div>; }
function Requirement({ value, date, onChange }: { value: EcoRequirement; date: string; onChange: (value: EcoRequirement, date: string) => void }) { return <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]"><div role="group" aria-label="נדרש ביצוע" className="flex gap-2">{([['required', 'נדרש'], ['not-required', 'לא נדרש']] as const).map(([choice, title]) => <button key={choice} type="button" aria-pressed={value === choice} onClick={() => onChange(value === choice ? "" : choice, date)} className={`min-h-11 flex-1 rounded-lg border px-4 text-sm font-bold transition-colors ${value === choice ? choice === 'required' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{title}</button>)}</div><label className="text-sm"><span className="sr-only">בוצע בתאריך</span><input data-eco-entry aria-label="בוצע בתאריך" type="date" value={date} disabled={value !== "required"} onKeyDown={navigate} onChange={event => onChange(value, event.target.value)} className={`${inputClass} disabled:bg-slate-100`} /></label></div>; }

export function EcoForm({ catalogItems, draftScope = "" }: { catalogItems: CatalogItem[]; draftScope?: string }) {
  const router = useRouter();
  const editor = useEcoEditor(draftScope);
  const { form, setForm, archiveId } = editor;
  const [preview, setPreview] = useState<EcoFormPayload | null>(null);
  const [activeSection, setActiveSection] = useState("");
  const [busy, setBusy] = useState<"download" | "save" | "reset" | null>(null);
  const [signatureRow, setSignatureRow] = useState<number | null>(null);
  const [pendingMedia, setPendingMedia] = useState(0);
  const imageBusy = pendingMedia > 0;
  useEffect(() => {
    if (!imageBusy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [imageBusy]);
  const setImageBusy = (busy: boolean) => setPendingMedia(count => Math.max(0, count + (busy ? 1 : -1)));
  function changeAttachments(index: number | "risk", apply: (files: EcoAttachment[]) => EcoAttachment[]) {
    setForm(current => {
      const next = index === "risk" ? { ...current, risk: { ...current.risk, attachments: apply(current.risk.attachments ?? []) } } : { ...current, actions: current.actions.map((a, i) => i === index ? { ...a, attachments: apply(a.attachments ?? []) } : a) };
      if (ecoMediaSize(next) > ECO_MEDIA_BUDGET) { queueMicrotask(() => toast.error("הקבצים והתמונות בטופס גדולים מדי. יש לצמצם את גודלם או להסיר קבצים לפני הוספה")); return current; }
      return next;
    });
  }
  const update = <K extends keyof EcoFormPayload>(key: K, value: EcoFormPayload[K]) => setForm(current => ({ ...current, [key]: value }));
  function changeProduct(index: number, key: keyof EcoProduct, value: string, selected?: CatalogItem) {
    const known = selected ?? (key === "catalogNumber" || key === "partName" ? resolveCatalogItem(catalogItems, key, value) : null);
    setForm(current => ({ ...current, products: current.products.map((product, i) => i !== index ? product : updateEcoProduct(product, key, value, known)) }));
  }
  async function action(mode: "download" | "save") {
    if (imageBusy || !editor.ready || editor.recovery || busy) return;
    if (new Blob([JSON.stringify(form)]).size > 3_800_000) { toast.error("הטופס גדול מדי לשמירה. הסר חלק מהתמונות"); return; }
    setBusy(mode);
    try {
      const response = await fetch(`/api/forms/eco/${mode === "save" ? "save" : "export"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "save" ? { payload: form, archiveId } : form) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "לא ניתן להפיק את הטופס");
      if (mode === "save") { await editor.clearDraft().catch(() => toast.warning("הטופס נשמר במערכת, אך הטיוטה המקומית לא הוסרה")); toast.success("טופס ECO נשמר בהצלחה במאגר הטפסים"); router.push("/forms"); router.refresh(); }
      else { const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = buildQualityFormDownloadName(`ECO-${form.formNumber || form.products[0].catalogNumber || "חדש"}`, "pdf"); anchor.click(); URL.revokeObjectURL(url); toast.success("טופס ECO הורד בהצלחה"); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "הפעולה נכשלה"); } finally { setBusy(null); }
  }
  const layout = getEcoLayout(form), positions = layout.map(block => ({id: block.id, title: ecoBlockTitle(block, form)}));
  const locked = Boolean(busy) || imageBusy || !editor.ready || Boolean(editor.recovery) || Boolean(preview);
  const controlClass = "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-bold disabled:opacity-40";
  const actions = <div className="flex flex-wrap gap-2">
    <button type="button" disabled={locked || !editor.canUndo} onClick={editor.undo} title="Ctrl/Cmd+Z" className={controlClass}><Undo2 className="h-4 w-4" />ביטול פעולה</button>
    <button type="button" disabled={locked || !editor.canRedo} onClick={editor.redo} title="Ctrl/Cmd+Shift+Z או Ctrl+Y" className={controlClass}><Redo2 className="h-4 w-4" />שחזור פעולה</button>
    <button type="button" disabled={locked} onClick={() => setPreview(form)} className={controlClass}><Eye className="h-4 w-4" />תצוגה מקדימה</button>
    <button type="button" disabled={locked} onClick={async () => { if (window.confirm("לנקות את הטופס והטיוטה המקומית ולהתחיל טופס חדש? לא ניתן לבטל ניקוי זה")) { setBusy("reset"); try { await editor.startNew(); } catch { toast.error("לא ניתן לנקות את הטיוטה כרגע. נסה שוב"); } finally { setBusy(null); } } }} className={controlClass}><RotateCcw className="h-4 w-4" />ניקוי</button>
    {([['download', Download, 'הורדה'], ['save', Save, 'שמירה']] as const).map(([mode, Icon, label]) => <button key={mode} type="button" disabled={locked} onClick={() => action(mode)} className={`${controlClass} ${mode === "save" ? "border-slate-950 !bg-slate-950 text-white" : ""}`}>{busy === mode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}</button>)}
  </div>;
  // One history for the whole document, including catalog fills and structural edits.
  useEffect(() => {
    function shortcut(event: globalThis.KeyboardEvent) {
      if (locked || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" || (key === "y" && !event.shiftKey)) {
        event.preventDefault();
        if (key === "y" || event.shiftKey) editor.redo(); else editor.undo();
      }
    }
    const root = document.querySelector("[data-eco-form]");
    root?.addEventListener("keydown", shortcut as EventListener);
    return () => root?.removeEventListener("keydown", shortcut as EventListener);
  }, [locked, editor.undo, editor.redo]);
  const sectionIds = layout.map(block => block.id).join("|");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id.slice("eco-document-".length));
    }, { rootMargin: "-5% 0px -65% 0px", threshold: 0 });
    for (const id of sectionIds.split("|")) { const section = document.getElementById(`eco-document-${id}`); if (section) observer.observe(section); }
    return () => observer.disconnect();
  }, [sectionIds]);
  const canText = layout.filter(block => block.kind === "text").length < 30, canImage = (form.illustrations?.length ?? 0) < 10;
  const [announcement, setAnnouncement] = useState("");
  function scrollToBlock(id: string, focus = false) { setTimeout(() => { const element = document.getElementById(`eco-document-${id}`); element?.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start"}); if (focus) element?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea")?.focus({preventScroll:true}); },0); }
  function addBlock(kind: EcoInsertKind, afterId?: string | null) { if (locked) return; const id=crypto.randomUUID(); setForm(current => insertEcoBlock(current,kind,id,afterId)); scrollToBlock(kind === "text" ? id : `image-${id}`,true); }
  function moveBlock(id: string, destination: number) { if (locked) return; setForm(current => moveEcoBlock(current,id,destination)); setAnnouncement(`המקטע הועבר למיקום ${destination+1}`); scrollToBlock(id); }
  const sections: Record<EcoSection, ReactNode> = {
details: (<Section title="טופס בקשה לשינוי / Change Control"><div className="mb-4 flex justify-end"><Image src="/caeli-logo.png" alt="Caeli" width={108} height={76} /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="מספר טופס" value={form.formNumber} onChange={v => update("formNumber", v)} /><Field label="תאריך" type="date" value={form.date} onChange={v => update("date", v)} /><Field label="שם יוזם השינוי" value={form.initiatorName} onChange={v => update("initiatorName", v)} /><Field label="תפקיד" value={form.initiatorRole} onChange={v => update("initiatorRole", v)} /></div><div className="flex flex-wrap gap-3">{ECO_CATEGORIES.map((category, index) => <label key={category} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 font-semibold"><input type="checkbox" checked={form.categories[index]} onChange={event => update("categories", form.categories.map((value, i) => i === index ? event.target.checked : value))} className="h-5 w-5 accent-blue-600" />{category}</label>)}</div>{form.categories[5] ? <Field label="אחר" value={form.otherCategory} onChange={v => update("otherCategory", v)} /> : null}</Section>),
products: (<Section title="מוצרים / פריטים"><div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-600">{form.products.length} מוצרים</span><button type="button" disabled={form.products.length >= 100} onClick={() => update("products", [...form.products, emptyEcoProduct()])} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />הוספת מוצר</button></div><div className="space-y-3">{form.products.map((product, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-300 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_95px_95px_90px]"><CatalogInput data-eco-entry label={`שם/תיאור פריט ${index + 1}`} field="partName" value={product.partName} items={catalogItems} onKeyDown={navigate} onInputValue={v => changeProduct(index, "partName", v)} onPick={item => changeProduct(index, "partName", item.partName, item)} /><CatalogInput data-eco-entry label="מק״ט" field="catalogNumber" value={product.catalogNumber} items={catalogItems} onKeyDown={navigate} onInputValue={v => changeProduct(index, "catalogNumber", v)} onPick={item => changeProduct(index, "catalogNumber", item.catalogNumber, item)} /><Field label="גרסה אחרונה" value={product.currentRevision} onChange={v => changeProduct(index, "currentRevision", v)} /><Field label="גרסה חדשה" value={product.newRevision} onChange={v => changeProduct(index, "newRevision", v)} /><button type="button" onClick={() => update("products", form.products.length === 1 ? [emptyEcoProduct()] : form.products.filter((_, i) => i !== index))} aria-label={`מחיקת מוצר ${index + 1}`} className="mt-auto inline-flex h-11 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 font-bold text-red-700"><Trash2 className="h-4 w-4" />מחיקה</button></div>)}</div></Section>),
description: (<Paragraph label="תיאור השינוי - למילוי ע״י יוזם השינוי" value={form.changeDescription} onChange={v => update("changeDescription", v)} rows={6} />),
justification: (<Paragraph label="ההצדקה לשינוי - למילוי ע״י יוזם השינוי" value={form.justification} onChange={v => update("justification", v)} />),
initialApproval: (<Section title="אישור ראשוני - הבטחת איכות"><SignatureFields title="אישור ראשוני" value={form.initialApproval} onChange={v => update("initialApproval", v)} /></Section>),
impact: (<Section title="השפעת השינוי - למילוי ע״י הבטחת איכות">{([['productImpact', 'על איכות המוצר'], ['qualitySystemImpact', 'על מערכת האיכות'], ['regulatoryImpact', 'על חוקים, תקנות רגולטוריות']] as const).map(([key, label]) => <Paragraph key={key} label={label} value={form[key]} onChange={v => update(key, v)} rows={3} />)}</Section>),
approvals: (<Section title="אישורים נדרשים"><div className="space-y-3">{form.approvals.map((approval, index) => <div key={index} className="rounded-xl border border-slate-300 p-3"><div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[140px_minmax(0,1fr)_150px_minmax(0,1fr)_120px]"><label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" checked={approval.required} onChange={event => update("approvals", form.approvals.map((a, i) => i === index ? { ...a, required: event.target.checked } : a))} className="h-5 w-5 accent-blue-600" />{approval.role}</label><Field label="שם מלא" value={approval.name} onChange={v => update("approvals", form.approvals.map((a, i) => i === index ? { ...a, name: v } : a))} /><Field label="תאריך" type="date" value={approval.date} onChange={v => update("approvals", form.approvals.map((a, i) => i === index ? { ...a, date: v } : a))} /><Field label="הערות" value={approval.notes} onChange={v => update("approvals", form.approvals.map((a, i) => i === index ? { ...a, notes: v } : a))} /><button type="button" onClick={() => setSignatureRow(signatureRow === index ? null : index)} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-2 font-bold ${approval.signature ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300"}`}><PenLine className="h-4 w-4" />{approval.signature ? "חתום" : "חתימה"}</button></div>{index === 9 ? <div className="mt-3"><Field label="תפקיד אחר" value={approval.role === "אחר" ? "" : approval.role} onChange={v => update("approvals", form.approvals.map((a, i) => i === index ? { ...a, role: v || "אחר" } : a))} /></div> : null}{signatureRow === index ? <div className="mt-3"><SignaturePad label={`חתימת ${approval.role}`} value={approval.signature} onChange={v => update("approvals", form.approvals.map((a, i) => i === index ? { ...a, signature: v } : a))} /></div> : null}</div>)}</div></Section>),
actions: (<Section title="פעולות נלוות"><p className="text-sm text-slate-600">בשינוי גרפיקה יש להתייחס לכל רמות האריזה</p><div className="space-y-3"><h3 className="font-bold">ביצוע ניהול סיכונים</h3><Requirement value={form.risk.requirement} date={form.risk.date} onChange={(requirement, date) => update("risk", { ...form.risk, requirement, date })} /><Paragraph label="סקר סיכונים" value={form.risk.survey} onChange={survey => update("risk", { ...form.risk, survey })} rows={3} /><EcoAttachments title="ביצוע ניהול סיכונים" value={form.risk.attachments ?? []} onChange={apply => changeAttachments("risk", apply)} onBusy={setImageBusy} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">מלאי נוכחי<select data-eco-entry value={form.inventory} onChange={e => update("inventory", e.target.value as EcoFormPayload['inventory'])} className={`${inputClass} mt-2`}><option value="" /><option value="none">אין</option><option value="use">שימוש במלאי</option><option value="reject">פסול</option><option value="other">אחר</option></select></label><label className="text-sm font-bold">הזמנות פתוחות<select data-eco-entry value={form.openOrders} onChange={e => update("openOrders", e.target.value as EcoFormPayload['openOrders'])} className={`${inputClass} mt-2`}><option value="" /><option value="none">אין</option><option value="accept">קבלה</option><option value="cancel">ביטול</option><option value="other">אחר</option></select></label>{form.inventory === "other" ? <Field label="פירוט מלאי נוכחי" value={form.inventoryOther} onChange={v => update("inventoryOther", v)} /> : null}{form.openOrders === "other" ? <Field label="פירוט הזמנות פתוחות" value={form.openOrdersOther} onChange={v => update("openOrdersOther", v)} /> : null}</div>
        {ECO_ACTIONS.map((label, index) => <div key={label} className="grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-[180px_minmax(0,1fr)]"><h3 className="self-center font-bold">{label}</h3><Requirement value={form.actions[index].requirement} date={form.actions[index].date} onChange={(requirement, date) => update("actions", form.actions.map((a, i) => i === index ? { ...a, requirement, date } : a))} /><div className="sm:col-start-2"><EcoAttachments title={label} value={form.actions[index].attachments ?? []} onChange={apply => changeAttachments(index, apply)} onBusy={setImageBusy} /></div></div>)}<Paragraph label="הערות + משימות נוספות לביצוע" value={form.additionalTasks} onChange={v => update("additionalTasks", v)} /></Section>),
closure: (<Section title="סגירת הטופס ע״י מנהל איכות"><label className="block text-sm font-bold">החלטה<select data-eco-entry value={form.closure.decision} onChange={e => update("closure", { ...form.closure, decision: e.target.value as EcoFormPayload['closure']['decision'] })} className={`${inputClass} mt-2`}><option value="" /><option value="approved">מאושר</option><option value="rejected">נדחה</option></select></label><Paragraph label="הסבר" value={form.closure.reason} onChange={reason => update("closure", { ...form.closure, reason })} rows={3} /><SignatureFields title="פרטי מנהל איכות" value={form.closure} onChange={v => update("closure", { ...form.closure, ...v })} /></Section>),
  };
  return <div data-eco-form dir="rtl" className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/forms" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500"><ArrowRight className="h-4 w-4" />חזרה למילוי טפסים</Link><h1 className="mt-2 text-3xl font-black">טופס ECO</h1></div>{actions}</header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><p role="status" aria-live="polite" className="font-bold text-slate-700">{editor.status}</p><span className="text-xs text-slate-500">טיוטה במכשיר זה בלבד · לשמירה במערכת יש ללחוץ על שמירה</span></div>
    {editor.error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><p>{editor.error}</p>{editor.conflict ? <span className="text-sm">אפשר לשמור ידנית במערכת לפני רענון כדי לשמור את השינויים שלך.</span> : <button type="button" onClick={() => void editor.retryAutosave()} className="rounded-lg border border-amber-400 px-3 py-2 font-bold">ניסיון שמירה נוסף</button>}</div> : null}
    {editor.recovery ? <section aria-label="שחזור טיוטה" className="rounded-xl border border-blue-300 bg-blue-50 p-4"><h2 className="font-black text-blue-950">נמצאה טיוטה שלא הושלמה</h2><p className="mt-2 text-sm text-blue-900">נשמרה במכשיר זה ב־{new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(editor.recovery.updatedAt))}. לשחזר אותה או להמשיך בלעדיה?</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => void editor.resolveRecovery(true)} className="rounded-lg bg-blue-700 px-4 py-3 font-bold text-white">שחזור טיוטה</button><button type="button" onClick={() => { if (window.confirm("להסיר את הטיוטה המקומית ולהמשיך בלעדיה?")) void editor.resolveRecovery(false); }} className={controlClass}>המשך ללא הטיוטה</button></div></section> : null}
    <div className="mx-auto grid max-w-[1600px] items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-3 xl:sticky xl:top-5">
        <h2 className="mb-3 flex items-center gap-2 font-black"><List className="h-5 w-5 text-blue-700" />מקטעי המסמך</h2>
        <label className="block text-sm font-bold xl:hidden">מעבר למקטע<select value={positions.some(position => position.id === activeSection) ? activeSection : positions[0]?.id} disabled={locked} onChange={event => { setActiveSection(event.target.value); scrollToBlock(event.target.value); }} className={`${inputClass} mt-2`}>{positions.map((position, index) => <option key={position.id} value={position.id}>{index + 1}. {position.title}</option>)}</select></label>
        <nav aria-label="ניווט וסידור מקטעי ECO" className="hidden max-h-[75dvh] space-y-1 overflow-y-auto xl:block">
          {positions.map((position, index) => <div key={position.id} className={`flex items-center gap-1 rounded-lg ${activeSection === position.id ? "bg-blue-50 text-blue-800" : "text-slate-600"}`}>
            <button type="button" disabled={locked} aria-current={activeSection === position.id ? "location" : undefined} onClick={() => { setActiveSection(position.id); scrollToBlock(position.id); }} className="min-h-11 min-w-0 flex-1 break-words px-2 py-2 text-start text-sm font-bold hover:text-blue-700 disabled:opacity-40">{index + 1}. {position.title}</button>
            <div className="flex shrink-0 flex-col"><button type="button" disabled={locked || index === 0} aria-label={`הזזת ${position.title} למעלה בסרגל`} onClick={() => moveBlock(position.id, index - 1)} className="rounded p-2 hover:bg-blue-100 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button><button type="button" disabled={locked || index === positions.length - 1} aria-label={`הזזת ${position.title} למטה בסרגל`} onClick={() => moveBlock(position.id, index + 1)} className="rounded p-2 hover:bg-blue-100 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button></div>
          </div>)}
        </nav>
      </aside>
      <fieldset disabled={locked} inert={locked} className="min-w-0"><legend className="sr-only">עריכת טופס ECO</legend><main className="min-w-0 space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"><h2 className="font-black text-blue-950">מבנה המסמך</h2><p className="mt-1 text-sm leading-6 text-blue-900">הוסף מקטע בכל מקום, ושלב טקסט, תמונות ולפני ואחרי בכל סדר. להזזה השתמש בגרירה, בחיצים או בבחירת מיקום. הסדר נשמר גם ב־PDF.</p></div>
      <EcoInsertControls onInsert={kind => addBlock(kind, null)} disabled={locked} canText={canText} canImage={canImage} />
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      {layout.map((block, index) => <Fragment key={block.id}>
        <EcoDocumentBlock id={block.id} title={ecoBlockTitle(block, form)} index={index} positions={positions} disabled={locked} removable={block.kind !== "section"} onMove={destination => moveBlock(block.id, destination)} onDropBlock={moveBlock} onRemove={() => { if (window.confirm("למחוק את המקטע והתוכן שלו?")) setForm(current => removeEcoBlock(current, block.id)); }}>
          {block.kind === "section" ? sections[block.section] : block.kind === "text" ? <div className="space-y-3 p-3"><label className="block text-sm font-bold">כותרת המקטע<input data-eco-entry dir="auto" maxLength={300} value={block.title} onChange={event => setForm(current => changeEcoText(current, block.id, {title: event.target.value}))} className={`${inputClass} mt-2`} /></label><label className="block text-sm font-bold">תוכן<textarea dir="auto" maxLength={30000} rows={5} value={block.text} onChange={event => setForm(current => changeEcoText(current, block.id, {text: event.target.value}))} className="mt-2 block w-full resize-y rounded-lg border border-slate-300 bg-white p-4 text-justify [text-align-last:start] text-base font-normal leading-7 outline-none focus:ring-2 focus:ring-blue-200" /></label></div> : <EcoIllustrations inline value={(form.illustrations ?? []).filter(image => image.id === block.illustrationId)} onChange={apply => setForm(current => { try { return changeEcoIllustration(current, block.illustrationId, apply); } catch (error) { queueMicrotask(() => toast.error(error instanceof Error ? error.message : "לא ניתן להוסיף את התמונה")); return current; } })} onBusy={setImageBusy} />}
        </EcoDocumentBlock>
        <EcoInsertControls onInsert={kind => addBlock(kind, block.id)} disabled={locked} canText={canText} canImage={canImage} />
      </Fragment>)}
    </main></fieldset></div><footer className="mx-auto flex max-w-[1600px] justify-end rounded-xl border border-slate-200 bg-white p-4">{actions}</footer>{preview ? <EcoPreview payload={preview} onClose={() => setPreview(null)} /> : null}</div>;
}
