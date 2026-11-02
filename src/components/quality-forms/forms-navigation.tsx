import Link from "next/link";
import { Archive, ClipboardPenLine } from "lucide-react";

export function FormsNavigation({ active }: { active: "fill" | "archive" }) {
  const items = [
    { key: "fill" as const, href: "/forms", label: "מילוי טפסים", icon: ClipboardPenLine },
    { key: "archive" as const, href: "/forms/archive", label: "מאגר הטפסים", icon: Archive },
  ];
  return <nav aria-label="ניווט מילוי טפסים" className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">{items.map((item) => { const Icon = item.icon; return <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-extrabold transition ${active === item.key ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}><Icon className="h-4 w-4" />{item.label}</Link>; })}</nav>;
}
