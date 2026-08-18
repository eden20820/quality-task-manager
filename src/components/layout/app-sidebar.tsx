"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ClipboardList,
  LayoutDashboard,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "לוח בקרה",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "משימות",
    href: "/tasks",
    icon: ClipboardList,
  },
  {
    title: "עובדים",
    href: "/users",
    icon: Users,
  },
];

export function AppSidebar() {
  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="border-b p-4">
        <div className="text-right">
          <Image src="/caeli-logo.png" alt="Caeli" width={90} height={52} className="mb-2 h-auto w-[90px]" />
          <p className="text-lg font-bold">Caeli Quality Hub</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold">
            ניווט
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          מחלקת איכות
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
