import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";
import {
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  FolderArchive,
  Gauge,
  ListChecks,
  Truck,
} from "lucide-react";

import { getPortalUser } from "@/lib/auth/portal-user";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

const navigationItems = [
  { title: "לוח בקרה", href: "/", icon: LayoutDashboard },
  { title: "משימות", href: "/tasks", icon: ClipboardList },
  { title: "משימות שהושלמו", href: "/tasks/completed", icon: CheckCircle2 },
  { title: "יומן ותזכורות", href: "/calendar", icon: CalendarDays },
  { title: "מעקב פגי תוקף", href: "/expiry", icon: CalendarClock },
  { title: "מעקב כיולים", href: "/calibrations", icon: Gauge },
  { title: "מעקב ספקים", href: "/suppliers", icon: Truck },
  { title: "פק״ע, אי התאמה, ECO", href: "/followups", icon: ListChecks },
  { title: "מרכז מסמכים", href: "/documents", icon: FolderArchive },
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
      <aside className="fixed right-0 top-0 z-20 hidden h-screen w-[260px] flex-col border-l border-slate-200 bg-white lg:flex">
        <nav className="flex-1 space-y-2 p-4 pt-6">
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

      </aside>

      <div className="min-h-screen lg:mr-[260px]">
        <header className="flex min-h-20 items-center border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:min-h-[130px] lg:px-10">
          <div className="grid w-full grid-cols-[44px_1fr] items-center gap-3 lg:grid-cols-[180px_1fr_180px] lg:gap-0">
            <MobileNavigation />
            <Image
              src="/caeli-logo.png"
              alt="Caeli"
              width={105}
              height={61}
              priority
              className="hidden h-auto w-[105px] justify-self-start lg:block"
            />

            <div className="text-center">
              <h1 className="text-xl font-black leading-tight tracking-tight sm:text-2xl lg:text-[42px]">
                Caeli Quality Hub
              </h1>
              <p className="mt-1 hidden text-sm font-bold text-slate-500 sm:block lg:mt-3 lg:text-[21px]">
                מחלקת איכות
              </p>
            </div>

            <p className="hidden text-left text-[16px] font-bold text-slate-600 lg:block">
              <Suspense fallback={<span className="block h-[16px] w-20 animate-pulse rounded bg-slate-200" />}>
                <UserName />
              </Suspense>
            </p>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
          <div className="mx-auto w-full max-w-[1800px]">
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
