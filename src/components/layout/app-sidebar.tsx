"use client";

import Link from "next/link";
import {
  ClipboardList,
  LayoutDashboard,
  Settings,
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
  SidebarMenuButton,
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
  {
    title: "הגדרות",
    href: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="border-b p-4">
        <div className="text-right">
          <p className="text-lg font-bold">CAELI Quality</p>
          <p className="text-sm text-muted-foreground">מערכת משימות</p>
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
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
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
