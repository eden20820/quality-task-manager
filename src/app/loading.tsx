import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/85"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-10 py-8 shadow-lg">
        <LoaderCircle className="h-10 w-10 animate-spin text-slate-900" />

        <p className="text-lg font-bold text-slate-700">
          טוען, נא להמתין...
        </p>
      </div>
    </div>
  );
}
