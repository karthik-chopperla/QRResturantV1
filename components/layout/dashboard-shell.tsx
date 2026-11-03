"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "./dashboard-sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Role } from "@prisma/client";

interface Props {
  children: React.ReactNode;
  user: {
    name: string | null;
    email: string;
    role: Role;
  };
  unreadCount?: number;
}

export function DashboardShell({ children, user, unreadCount = 0 }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, drawer on mobile when open */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-58 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <DashboardSidebar user={user} unreadCount={unreadCount} />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header bar */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <span className="text-sm font-semibold">DineDesk</span>
          <ThemeToggle />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
