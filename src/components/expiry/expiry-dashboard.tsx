type Props = {
  total: number;
  expired: number;
  next30: number;
  next90: number;
  invalid: number;
};

export function ExpiryDashboard({
  total,
  expired,
  next30,
  next90,
  invalid,
}: Props) {
  const cards = [
    {
      title: "סה״כ חומרים",
      value: total,
      color: "text-slate-900",
    },
    {
      title: "פגי תוקף",
      value: expired,
      color: "text-red-600",
    },
    {
      title: "עד 30 יום",
      value: next30,
      color: "text-orange-500",
    },
    {
      title: "עד 90 יום",
      value: next90,
      color: "text-yellow-500",
    },
    {
      title: "תאריכים שגויים",
      value: invalid,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <p className={`text-4xl font-extrabold ${card.color}`}>
            {card.value}
          </p>

          <p className="mt-3 text-sm font-medium text-slate-500">
            {card.title}
          </p>
        </div>
      ))}
    </div>
  );
}