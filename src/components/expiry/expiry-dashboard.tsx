import Link from "next/link";

export type ExpiryFilter = "all" | "expired" | "next30" | "next90" | "invalid";

type Props = {
  total: number;
  expired: number;
  next30: number;
  next90: number;
  invalid: number;
  activeFilter: ExpiryFilter;
};

export function ExpiryDashboard({
  total,
  expired,
  next30,
  next90,
  invalid,
  activeFilter,
}: Props) {
  const cards = [
    {
      filter: "all" as const,
      title: "סה״כ חומרים",
      value: total,
      color: "text-slate-900",
    },
    {
      filter: "expired" as const,
      title: "פגי תוקף",
      value: expired,
      color: "text-red-600",
    },
    {
      filter: "next30" as const,
      title: "עד 30 יום",
      value: next30,
      color: "text-orange-500",
    },
    {
      filter: "next90" as const,
      title: "31–90 יום",
      value: next90,
      color: "text-yellow-500",
    },
    {
      filter: "invalid" as const,
      title: "תאריכים שגויים",
      value: invalid,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-5">
      {cards.map((card) => (
        <Link
          key={card.title}
          href={card.filter === "all" ? "/expiry" : `/expiry?filter=${card.filter}`}
          aria-current={activeFilter === card.filter ? "page" : undefined}
          className={`rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md ${activeFilter === card.filter ? "ring-2 ring-slate-900" : ""}`}
        >
          <p className={`text-4xl font-extrabold ${card.color}`}>
            {card.value}
          </p>

          <p className="mt-3 text-sm font-medium text-slate-500">
            {card.title}
          </p>
          <span className="mt-3 block text-xs font-bold text-sky-700">הצגה בטבלה</span>
        </Link>
      ))}
    </div>
  );
}
