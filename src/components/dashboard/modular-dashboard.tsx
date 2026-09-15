"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical, LayoutDashboard, RotateCcw } from "lucide-react";

type SectionId = "overview" | "calendar" | "tasks";
type DashboardSection = { id: SectionId; title: string; content: ReactNode };

const defaultOrder: SectionId[] = ["overview", "calendar", "tasks"];
const storageKey = "qms-dashboard-section-order-v1";

function validOrder(value: unknown): value is SectionId[] {
  return Array.isArray(value) && value.length === defaultOrder.length && defaultOrder.every((id) => value.includes(id));
}

export function ModularDashboard({ sections }: { sections: DashboardSection[] }) {
  const [order, setOrder] = useState(defaultOrder);
  const [editing, setEditing] = useState(false);
  const draggedId = useRef<SectionId | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
        if (validOrder(saved)) setOrder(saved);
      } catch {
        // Keep the safe default when browser storage is unavailable or invalid.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function save(next: SectionId[]) {
    setOrder(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Layout still works without persistence. */ }
  }

  function move(id: SectionId, direction: -1 | 1) {
    const currentIndex = order.indexOf(id);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    const next = [...order];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    save(next);
  }

  function drop(targetId: SectionId, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const sourceId = draggedId.current;
    if (!sourceId || sourceId === targetId) return;
    const next = order.filter((id) => id !== sourceId);
    next.splice(next.indexOf(targetId), 0, sourceId);
    draggedId.current = null;
    save(next);
  }

  const byId = new Map(sections.map((section) => [section.id, section]));

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
      <div><p className="flex items-center gap-2 font-extrabold"><LayoutDashboard className="h-4 w-4" />סידור לוח הבקרה</p><p className="text-xs text-slate-500">הסדר נשמר במכשיר הזה</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => { save(defaultOrder); setEditing(false); }} className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold text-slate-600"><RotateCcw className="h-4 w-4" />איפוס</button><button type="button" onClick={() => setEditing((value) => !value)} aria-pressed={editing} className={`h-10 rounded-lg px-4 text-sm font-bold ${editing ? "bg-emerald-600 text-white" : "bg-slate-950 text-white"}`}>{editing ? "סיום סידור" : "שינוי סדר"}</button></div>
    </div>
    <div className="space-y-8">{order.map((id, index) => { const section = byId.get(id); if (!section) return null; return <section key={id} draggable={editing} onDragStart={() => { draggedId.current = id; }} onDragOver={(event) => editing && event.preventDefault()} onDrop={(event) => editing && drop(id, event)} className={`relative rounded-2xl transition ${editing ? "cursor-grab border-2 border-dashed border-slate-300 bg-slate-100/60 p-2 active:cursor-grabbing" : ""}`}>
      {editing ? <div className="mb-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm"><span className="flex items-center gap-2 text-sm font-extrabold"><GripVertical className="h-5 w-5 text-slate-400" />{section.title}</span><div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => move(id, -1)} aria-label={`העברת ${section.title} למעלה`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button type="button" disabled={index === order.length - 1} onClick={() => move(id, 1)} aria-label={`העברת ${section.title} למטה`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button></div></div> : null}
      {section.content}
    </section>; })}</div>
  </div>;
}
