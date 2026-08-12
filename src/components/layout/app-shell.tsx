import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  Settings,
  CalendarClock,
} from "lucide-react";

import { getPortalUser } from "@/lib/auth/portal-user";

const navigationItems = [
  { title: "לוח בקרה", href: "/", icon: LayoutDashboard },
  { title: "משימות", href: "/tasks", icon: ClipboardList },
  { title: "משימות שהושלמו", href: "/tasks/completed", icon: CheckCircle2 },
  { title: "ניהול חומרים", href: "/expiry", icon: CalendarClock },
  { title: "הגדרות", href: "/settings", icon: Settings },
];

/*
 * AppShell עצמו הוא סינכרוני ולא ממתין לשום דבר —
 * הסיידבר וה-header מצטיירים מיידית בכל ניווט, בלי "הבהוב" של המסך כולו.
 * רק החלקים שתלויים בנתוני המשתמש (השם, ובדיקת ההרשאה שמגינה על children)
 * עטופים ב-Suspense נפרד, כך שהם "משלימים" ברקע בלי לחסום את השלד.
 */
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
          <Suspense fallback={<span className="block h-[18px] w-24 animate-pulse rounded bg-slate-200" />}>
            <UserName />
          </Suspense>
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
              <Suspense fallback={<span className="block h-[16px] w-20 animate-pulse rounded bg-slate-200" />}>
                <UserName />
              </Suspense>
            </p>
          </div>
        </header>

        <main className="px-10 py-12">
          <div className="mx-auto w-full max-w-[1250px]">
            <Suspense fallback={<ContentSkeleton />}>
              <AuthGate>{children}</AuthGate>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

async function UserName() {
  // getPortalUser עטופה ב-React cache(), אז הקריאה כאן משתפת
  // את אותה תוצאה עם AuthGate בלי לשלוף פעמיים באותה בקשה.
  const portalUser = await getPortalUser();
  return <>{portalUser?.profile.full_name ?? ""}</>;
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  const portalUser = await getPortalUser();
  if (!portalUser) {
    redirect("/login");
  }
  if (!portalUser.profile.is_active) {
    redirect("/login?error=not-authorized");
  }

  return <>{children}</>;
}

function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded bg-slate-200" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-200" />
    </div>
  );
}



