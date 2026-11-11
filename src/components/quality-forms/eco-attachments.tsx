"use client";
import { useRef, useState } from "react";
import { Download, FilePlus2, FileSpreadsheet, FileText, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ECO_ATTACHMENT_ACCEPT, ECO_MAX_ATTACHMENT_BYTES, ecoAttachmentSize, ecoFileLabel, ecoFileType, type EcoAttachment } from "@/lib/quality-forms/eco-files";

export function EcoAttachments({ title, value, onChange, onBusy }: { title: string; value: EcoAttachment[]; onChange: (v: (current: EcoAttachment[]) => EcoAttachment[]) => void; onBusy: (v: boolean) => void }) {
  const picker = useRef<HTMLInputElement>(null), lock = useRef(false);
  const [busy, setBusy] = useState(false), [dragging, setDragging] = useState(false);
  async function add(files: File[]) {
    if (lock.current || !files.length) return;
    lock.current = true; setBusy(true); onBusy(true); setDragging(false);
    try {
      const added: EcoAttachment[] = [];
      for (const file of files) {
        if (value.length + added.length >= 6) { toast.error("ניתן לצרף עד 6 קבצים לכל פעולה"); break; }
        const mimeType = ecoFileType(file.name);
        if (!mimeType || file.size > ECO_MAX_ATTACHMENT_BYTES || !file.size) { toast.error(`${file.name}: סוג קובץ לא נתמך או קובץ גדול מ־2MB`); continue; }
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        added.push({ id: crypto.randomUUID(), name: file.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 180), mimeType, data });
      }
      if (added.length) onChange(current => [...current, ...added].slice(0, 6));
    } catch { toast.error("לא ניתן לקרוא את הקבצים שנבחרו"); } finally { lock.current = false; setBusy(false); onBusy(false); if (picker.current) picker.current.value = ""; }
  }
  function download(file: EcoAttachment) {
    const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], {type: file.mimeType}));
    const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="space-y-3">
    <input ref={picker} type="file" accept={ECO_ATTACHMENT_ACCEPT} multiple aria-label={`צירוף קבצים עבור ${title}`} className="hidden" onChange={e => void add(Array.from(e.target.files ?? []))} />
    <button type="button" disabled={busy || value.length >= 6} onClick={() => picker.current?.click()} onDragEnter={e => { e.preventDefault(); setDragging(true); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); void add(Array.from(e.dataTransfer.files)); }} className={`flex min-h-16 w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed p-3 text-sm font-bold disabled:opacity-50 ${dragging ? "border-blue-600 bg-blue-100" : "border-blue-200 bg-blue-50/50 text-blue-900"}`}><FilePlus2 className="h-5 w-5" />{busy ? "טוען קבצים…" : "גרירת קבצים לכאן או בחירה מהמחשב"}</button>
    <p className="text-xs text-slate-500">PDF, Excel, Word ותמונות · עד 2MB לקובץ · כ־2.4MB לכל הקבצים והתמונות יחד · הקבצים ייכללו בטופס השמור וב־PDF</p>
    {value.length ? <ul className="grid gap-2 sm:grid-cols-2">{value.map(file => { const label = ecoFileLabel(file.name), Icon = label === "XLSX" ? FileSpreadsheet : label === "IMG" ? ImageIcon : FileText; return <li key={file.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"><Icon className={`h-7 w-7 shrink-0 ${label === "XLSX" ? "text-green-700" : label === "PDF" ? "text-red-600" : "text-blue-700"}`} /><div className="min-w-0 flex-1"><p dir="auto" className="break-all text-sm font-semibold">{file.name}</p><p className="text-xs text-slate-500">{label} · {Math.ceil(ecoAttachmentSize(file) / 1024)} KB</p></div><button type="button" onClick={() => download(file)} aria-label={`הורדת ${file.name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200"><Download className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={() => onChange(current => current.filter(f => f.id !== file.id))} aria-label={`הסרת ${file.name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-100 text-red-700"><Trash2 className="h-4 w-4" /></button></li>; })}</ul> : null}
  </div>;
}
