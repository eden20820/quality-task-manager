import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  Settings,
  CalendarClock,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

const navigationItems = [
  { title: "לוח בקרה", href: "/", icon: LayoutDashboard },
  { title: "משימות", href: "/tasks", icon: ClipboardList },
  { title: "משימות שהושלמו", href: "/tasks/completed", icon: CheckCircle2 },
  { title: "ניהול חומרים", href: "/expiry", icon: CalendarClock },
  { title: "הגדרות", href: "/settings", icon: Settings },
];

export async function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active) {
    redirect("/login?error=not-authorized");
  }

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
            {profile.full_name}
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
              {profile.full_name}
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




