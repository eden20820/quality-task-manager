"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FolderArchive,
  Gauge,
  ListChecks,
  LayoutDashboard,
  Menu,
  Truck,
  Mail,
  X,
} from "lucide-react";

const navigationItems = [
  { title: "לוח בקרה", href: "/", icon: LayoutDashboard },
  { title: "משימות", href: "/tasks", icon: ClipboardList },
  { title: "משימות שהושלמו", href: "/tasks/completed", icon: CheckCircle2 },
  { title: "יומן", href: "/calendar", icon: CalendarDays },
  { title: "מעקב פגי תוקף", href: "/expiry", icon: CalendarClock },
  { title: "מעקב כיולים", href: "/calibrations", icon: Gauge },
  { title: "מעקב ספקים", href: "/suppliers", icon: Truck },
  { title: "פק״ע, אי התאמה, ECO", href: "/followups", icon: ListChecks },
  { title: "מרכז מסמכים", href: "/documents", icon: FolderArchive },
  { title: "הודעות", href: "/messages", icon: Mail },
];

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="פתיחת תפריט"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="סגירת תפריט"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(82vw,320px)] flex-col bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-extrabold">תפריט</span>
              <button
                type="button"
                aria-label="סגירת תפריט"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-4 font-bold ${active ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
