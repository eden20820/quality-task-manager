import Link from "next/link";
import {
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

const navigationItems = [
  { title: "לוח בקרה", href: "/", icon: LayoutDashboard },
  { title: "משימות", href: "/tasks", icon: ClipboardList },
  { title: "עובדים", href: "/users", icon: Users },
  { title: "הגדרות", href: "/settings", icon: Settings },
];

export function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed right-0 top-0 z-20 flex h-screen w-[260px] flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-7">
          <h2 className="text-[24px] font-extrabold leading-tight">
            CAELI Quality
          </h2>
          <p className="mt-2 text-[16px] font-semibold text-slate-500">
            מערכת ניהול משימות
          </p>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[52px] items-center gap-4 rounded-xl px-4 text-[17px] font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
              >
                <Icon className="h-6 w-6" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-6 py-5">
          <p className="text-[15px] font-semibold text-slate-500">
            מחלקת איכות
          </p>
        </div>
      </aside>

      <div className="mr-[260px] min-h-screen">
        <header className="flex min-h-[130px] items-center border-b border-slate-200 bg-white px-10 shadow-sm">
          <div className="grid w-full grid-cols-[180px_1fr_180px] items-center">
            <div />

            <div className="text-center">
              <h1 className="text-[42px] font-black leading-tight tracking-tight">
                מערכת ניהול משימות
              </h1>
              <p className="mt-3 text-[21px] font-bold text-slate-500">
                מחלקת איכות
              </p>
            </div>

            <p className="text-left text-[16px] font-bold text-slate-600">
              מחובר למערכת
            </p>
          </div>
        </header>

        <main className="px-10 py-12">
          <div className="mx-auto w-full max-w-[1250px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
