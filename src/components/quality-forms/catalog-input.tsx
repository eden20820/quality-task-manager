"use client";
import { useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { matchingCatalogItems, type CatalogItem } from "@/lib/quality-forms/parts-catalog";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string; label?: string; field: "catalogNumber" | "partName"; items: CatalogItem[];
  onInputValue: (value: string) => void; onPick: (item: CatalogItem) => void;
};
export function CatalogInput({ value, label, field, items, onInputValue, onPick, onKeyDown, className, ...attributes }: Props) {
  const id = useId(); const [open, setOpen] = useState(false); const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 240 });
  const matches = useMemo(() => matchingCatalogItems(items, field, value).slice(0, 8), [items, field, value]);
  useEffect(() => {
    if (!open) return;
    const reposition = () => { const rect = input.current?.getBoundingClientRect(); if (rect) { const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16); const menuHeight = Math.min(256, matches.length * 68 + 8); const top = window.innerHeight - rect.bottom < menuHeight ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4; setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top, width }); } };
    reposition(); window.addEventListener("resize", reposition); window.addEventListener("scroll", reposition, true);
    return () => { window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [open, matches.length]);
  const choose = (item: CatalogItem) => { onPick(item); setOpen(false); setActive(-1); };
  return <div className="relative min-w-0">{label ? <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">{label}</label> : null}<input {...attributes} ref={input} id={id} value={value} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open && matches.length > 0} aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined} onChange={event => { onInputValue(event.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1); }} onKeyDown={event => {
    if (open && matches.length && event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(index + 1, matches.length - 1)); }
    else if (open && matches.length && event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
    else if (open && event.key === "Enter" && active >= 0 && matches[active]) { event.preventDefault(); choose(matches[active]); }
    else if (event.key === "Escape") { setOpen(false); setActive(-1); }
    else onKeyDown?.(event);
  }} className={className ?? "h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"} />{open && matches.length > 0 ? createPortal(<ul id={`${id}-list`} role="listbox" dir="rtl" style={position} className="fixed z-[150] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{matches.map((item, index) => <li key={`${item.catalogNumber}-${item.partName}-${item.revision}`} id={`${id}-${index}`} role="option" aria-selected={index === active}><button type="button" tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => choose(item)} className={`w-full rounded-lg p-2 text-right text-sm hover:bg-blue-50 ${index === active ? "bg-blue-50" : ""}`}><span className="block break-words font-bold" dir="auto">{field === "partName" ? item.partName : item.catalogNumber}</span><span className="mt-1 block break-words text-xs text-slate-600" dir="auto">{field === "partName" ? item.catalogNumber : item.partName}{item.revision ? ` · ${item.revision}` : ""}</span></button></li>)}</ul>, document.body) : null}</div>;
}
