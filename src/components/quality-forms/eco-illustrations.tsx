"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { EcoIllustration } from "@/lib/quality-forms/eco-form";

const inputClass = "w-full min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 font-semibold disabled:opacity-40";

// Re-encode locally: bounded size, correct orientation, no original EXIF metadata.
async function prepareImage(file: File) {
  if (!/\.(png|jpe?g|webp|gif|bmp|avif|tiff?|heic|heif)$/i.test(file.name)) throw new Error("פורמט התמונה אינו נתמך");
  if (file.size > 20_000_000) throw new Error("יש לבחור תמונה קטנה מ־20MB");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch {
    if (file.size > 4_000_000) throw new Error("תמונה הדורשת המרה צריכה להיות קטנה מ־4MB");
    const body = new FormData(); body.append("file", file);
    const response = await fetch("/api/forms/eco/image", {method: "POST", body});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "לא ניתן להמיר את התמונה");
    return result.image as string;
  }
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("לא ניתן לעבד את התמונה בדפדפן");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.75, 0.6, 0.45]) {
      const result = canvas.toDataURL("image/jpeg", quality);
      if (result.length <= 420_000) return result;
    }
    throw new Error("התמונה מורכבת מדי. יש לבחור תמונה קטנה יותר");
  } finally { bitmap.close(); }
}

function Photo({ label, image, caption, disabled, onLabel, onImage, onCaption, onBusy, onExtras }: { label: string; image: string; caption: string; disabled: boolean; onLabel: (v: string) => void; onImage: (v: string) => void; onCaption: (v: string) => void; onBusy: (v: boolean) => void; onExtras: (images: string[]) => void }) {
  const picker = useRef<HTMLInputElement>(null), lock = useRef(false);
  const [processing, setProcessing] = useState(false);
  async function upload(files: File[]) {
    if (!files.length || lock.current || processing || disabled) return;
    lock.current = true;
    if (files.length > 10) toast.error("ניתן להוסיף עד 10 תמונות בכל העלאה");
    setProcessing(true); onBusy(true);
    try {
      const images: string[] = [];
      for (const file of files.slice(0, 10)) { try { images.push(await prepareImage(file)); } catch (error) { toast.error(`${file.name}: ${error instanceof Error ? error.message : "התמונה אינה תקינה"}`); } }
      if (images.length) { onImage(images[0]); if (images.length > 1) onExtras(images.slice(1)); }
    } finally { lock.current = false; setProcessing(false); onBusy(false); if (picker.current) picker.current.value = ""; }
  }
  return <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
    <input aria-label="כותרת תמונה" value={label} onChange={e => onLabel(e.target.value)} className={`${inputClass} text-center font-bold`} />
    <input ref={picker} type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.tif,.tiff,.heic,.heif" multiple className="hidden" onChange={e => void upload(Array.from(e.target.files ?? []))} />
    <button type="button" disabled={processing || disabled} onClick={() => picker.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); e.stopPropagation(); void upload(Array.from(e.dataTransfer.files)); }} onPaste={e => { const file = Array.from(e.clipboardData.files).find(f => f.type.startsWith("image/")); if (file) { e.preventDefault(); void upload([file]); } }} aria-label={image ? `החלפת תמונה ${label}` : `הוספת תמונה ${label}`} className="flex min-h-48 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/40 p-3 text-blue-800 focus:ring-4 focus:ring-blue-100 disabled:opacity-50">
      {image ? <Image src={image} alt={caption || label} width={560} height={300} unoptimized className="h-52 w-full object-contain" /> : <ImagePlus className="h-9 w-9" />}
      <span className="text-sm font-semibold">{processing ? "מעבד תמונה…" : image ? "לחיצה להחלפת תמונה" : "בחירת תמונה, גרירה או הדבקה"}</span>
    </button>
    <label className="block text-sm font-semibold">כיתוב מתחת לתמונה<input dir="auto" value={caption} onChange={e => onCaption(e.target.value)} className={`${inputClass} mt-2`} /></label>
    {image ? <button type="button" disabled={processing || disabled} onClick={() => onImage("")} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-red-700"><Trash2 className="h-4 w-4" />הסרת תמונה</button> : null}
  </div>;
}

export function EcoIllustrations({ value, onChange, onBusy }: { value: EcoIllustration[]; onChange: (v: EcoIllustration[] | ((current: EcoIllustration[]) => EcoIllustration[])) => void; onBusy: (v: boolean) => void }) {
  const [processing, setProcessing] = useState(false);
  function patch(index: number, change: Partial<EcoIllustration>) {
    onChange(current => {
    const next = current.map((b, i) => i === index ? { ...b, ...change } : b);
    if (next.reduce((sum, b) => sum + b.beforeImage.length + b.afterImage.length, 0) > 2_500_000) { queueMicrotask(() => toast.error("התמונות בטופס הגיעו למגבלת הגודל. הסר תמונה או בחר תמונות קטנות יותר")); return current; }
    return next;
    });
  }
  function add(mode: "pair" | "single") { onChange(current => [...current, { id: crypto.randomUUID(), mode, title: "", beforeLabel: mode === "pair" ? "לפני" : "תמונה", afterLabel: "אחרי", beforeImage: "", afterImage: "", beforeCaption: "", afterCaption: "", notes: "" }]); }
  function move(index: number, delta: number) { const next = [...value]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange(next); }
  function extras(images: string[], index: number) {
    const blocks = images.map(image => ({ id: crypto.randomUUID(), mode: "single" as const, title: "", beforeLabel: "תמונה", afterLabel: "", beforeImage: image, afterImage: "", beforeCaption: "", afterCaption: "", notes: "" }));
    onChange(current => {
      const base = [...current];
      let added = blocks;
      if (base[index]?.mode === "pair" && !base[index].afterImage && blocks.length) { base[index] = { ...base[index], afterImage: blocks[0].beforeImage }; added = blocks.slice(1); }
      if (base.length + added.length > 10) queueMicrotask(() => toast.error("הטופס מכיל עד 10 תבניות תמונה. חלק מהתמונות לא נוספו"));
      const next = [...base, ...added].slice(0, 10);
      if (next.reduce((sum, b) => sum + b.beforeImage.length + b.afterImage.length, 0) > 2_500_000) { queueMicrotask(() => toast.error("התמונות הגיעו למגבלת הגודל. יש לבחור פחות תמונות")); return current; }
      return next;
    });
  }
  const busy = (v: boolean) => { setProcessing(v); onBusy(v); };
  return <section className="space-y-5 rounded-xl border border-slate-300 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">תמונות והמחשת השינוי</h2><div className="flex flex-wrap gap-2"><button type="button" disabled={processing || value.length >= 10} onClick={() => add("pair")} className={`${buttonClass} text-blue-800`}><Plus className="h-4 w-4" />תבנית לפני ואחרי</button><button type="button" disabled={processing || value.length >= 10} onClick={() => add("single")} className={buttonClass}><ImagePlus className="h-4 w-4" />תמונה בודדת</button></div></div>
    {value.map((block, index) => <article key={block.id} className="space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-3 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">{block.mode === "pair" ? "לפני ואחרי" : "תמונה"} · {index + 1}</h3><div className="flex gap-2"><button type="button" aria-label="העברה למעלה" disabled={processing || index === 0} onClick={() => move(index, -1)} className={buttonClass}><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label="העברה למטה" disabled={processing || index === value.length - 1} onClick={() => move(index, 1)} className={buttonClass}><ArrowDown className="h-4 w-4" /></button><button type="button" disabled={processing} onClick={() => { if (window.confirm("למחוק את התבנית והתמונות שבה?")) onChange(current => current.filter((_, i) => i !== index)); }} className={`${buttonClass} text-red-700`}><Trash2 className="h-4 w-4" />מחיקה</button></div></div>
      <label className="block text-sm font-bold">כותרת<input value={block.title} dir="auto" onChange={e => patch(index, { title: e.target.value })} className={`${inputClass} mt-2`} /></label>
      <div dir="ltr" className={`grid gap-4 ${block.mode === "pair" ? "sm:grid-cols-2" : ""}`}><div dir="rtl"><Photo label={block.beforeLabel} image={block.beforeImage} caption={block.beforeCaption} disabled={processing} onBusy={busy} onExtras={images => extras(images, index)} onLabel={v => patch(index, { beforeLabel: v })} onImage={v => patch(index, { beforeImage: v })} onCaption={v => patch(index, { beforeCaption: v })} /></div>{block.mode === "pair" ? <div dir="rtl"><Photo label={block.afterLabel} image={block.afterImage} caption={block.afterCaption} disabled={processing} onBusy={busy} onExtras={images => extras(images, index)} onLabel={v => patch(index, { afterLabel: v })} onImage={v => patch(index, { afterImage: v })} onCaption={v => patch(index, { afterCaption: v })} /></div> : null}</div>
      <label className="block text-sm font-bold">הסבר מתחת לתמונות<textarea rows={3} dir="auto" value={block.notes} onChange={e => patch(index, { notes: e.target.value })} className={`${inputClass} mt-2 resize-y leading-7`} /></label>
    </article>)}
  </section>;
}
