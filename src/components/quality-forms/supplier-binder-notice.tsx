"use client";

import { FolderSearch } from "lucide-react";
import { useMemo } from "react";

import { entrySearchScore, isSupplierSearchMatch, normalizeSupplierName, type SupplierBinderDirectoryEntry } from "@/lib/supplier-binders";

export function SupplierBinderNotice({ supplierName, directory }: { supplierName: string; directory: SupplierBinderDirectoryEntry[] }) {
  const matches = useMemo(() => {
    if (normalizeSupplierName(supplierName).length < 2) return [];
    const matching = directory
      .filter((entry) => isSupplierSearchMatch(supplierName, entry))
      .map((entry) => ({ ...entry, score: entrySearchScore(supplierName, entry) }))
      .sort((left, right) => right.score - left.score);
    if (!matching.length) return [];
    const bestScore = matching[0].score;
    return matching.filter((entry) => entry.score >= bestScore - 4).slice(0, 4);
  }, [directory, supplierName]);

  if (!matches.length) return null;
  const binders = [...new Set(matches.map((entry) => entry.binderLabel))];
  return <aside aria-live="polite" className="flex items-start gap-3 rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-blue-950 shadow-sm" dir="rtl">
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><FolderSearch className="h-5 w-5" /></span>
    <div><p className="text-sm font-black">מיקום הספק: {binders.map((label) => `קלסר ${label}`).join(" · ")}</p><p className="mt-0.5 text-xs font-semibold text-blue-700">נמצאה התאמה ל־{matches.map((entry) => entry.name).join(" / ")}</p></div>
  </aside>;
}
