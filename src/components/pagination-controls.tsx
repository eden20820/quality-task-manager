import Link from "next/link";

type PaginationControlsProps = {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  query?: Record<string, string | undefined>;
};

export function PaginationControls({
  basePath,
  page,
  pageSize,
  total,
  query = {},
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (targetPage > 1) params.set("page", String(targetPage));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <nav
      aria-label="דפדוף בין עמודים"
      className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      {page > 1 ? (
        <Link
          href={pageHref(page - 1)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50"
        >
          הקודם
        </Link>
      ) : (
        <span className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-300">
          הקודם
        </span>
      )}

      <span className="text-sm font-bold text-slate-600">
        עמוד {page} מתוך {totalPages} · {total} רשומות
      </span>

      {page < totalPages ? (
        <Link
          href={pageHref(page + 1)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50"
        >
          הבא
        </Link>
      ) : (
        <span className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-300">
          הבא
        </span>
      )}
    </nav>
  );
}
