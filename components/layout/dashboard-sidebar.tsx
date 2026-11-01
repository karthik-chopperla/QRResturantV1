"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Grid3X3,
  ShoppingBag,
  Ticket,
  Settings,
  LogOut,
  ChefHat,

  Bell,
  UsersRound,
  Wallet,
  Boxes,
  Truck,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/actions/auth";
import { Role } from "@prisma/client";
import { canAccessKitchen } from "@/lib/roles";
import { roleLabels } from "@/lib/roles";
import { toast } from "sonner";

const adminLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/tables", label: "Tables", icon: Grid3X3 },
  { href: "/dashboard/offers", label: "Offers", icon: Ticket },
  { href: "/dashboard/staff", label: "Staff", icon: UsersRound },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/purchasing", label: "Purchasing", icon: Truck },
  { href: "/accountant", label: "Accounting", icon: Calculator },
];

interface DashboardSidebarProps {
  user: {
    name: string | null;
    email: string;
    role: Role;
  };
  unreadCount?: number;
}

export function DashboardSidebar({ user, unreadCount = 0 }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-58 flex-col border-r border-border bg-card">
      <div className="border-b border-border/60 p-5">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          QRFast
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {adminLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
            {label === "Dashboard" && unreadCount > 0 && (
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                {unreadCount}
              </span>
            )}
          </Link>
        ))}

        {canAccessKitchen(user.role) && (
          <Link
            href="/kitchen"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/kitchen")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ChefHat className="size-4" />
            Kitchen
          </Link>
        )}

        {user.role === Role.RESTAURANT_OWNER || user.role === Role.CASHIER ? (
          <Link
            href="/cashier"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/cashier")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Wallet className="size-4" />
            Cashier POS
          </Link>
        ) : null}


      </nav>

      <div className="border-t border-border/60 p-4 space-y-3">
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/dashboard/settings")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabels[user.role]}</p>
          </div>
          <ThemeToggle />
        </div>
        <SignOutButton className="w-full" />
      </div>
    </aside>
  );
}

function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const result = await signOut();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
      toast.error("Failed to sign out. Please try again.");
    }
  };

  return (
    <Button variant="outline" size="sm" className={className} onClick={handleSignOut}>
      <LogOut className="mr-2 size-4" />
      Sign Out
    </Button>
  );
}

export function StaffHeader({
  title,
  subtitle,
  role,
}: {
  title: string;
  subtitle?: string;
  role?: Role;
}) {
  const roleLinks: Partial<Record<Role, Array<{ href: string; label: string }>>> = {
    [Role.MANAGER]: [
      { href: "/manager", label: "Operations" },
      { href: "/kitchen", label: "Kitchen" },
      { href: "/service", label: "Service" },
    ],
    [Role.CASHIER]: [{ href: "/cashier", label: "POS & Billing" }],
    [Role.SERVICE_STAFF]: [{ href: "/service", label: "Service Tasks" }],
    [Role.CHEF_KITCHEN_STAFF]: [{ href: "/kitchen", label: "Kitchen Board" }],
    [Role.INVENTORY_MANAGER]: [{ href: "/inventory", label: "Inventory" }],
    [Role.PURCHASE_MANAGER]: [{ href: "/purchasing", label: "Purchasing" }],
    [Role.ACCOUNTANT]: [{ href: "/accountant", label: "Accounts" }],
  };
  const links = role ? roleLinks[role] ?? [] : [];

  return (
    <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:block"><ThemeToggle /></div>
          <SignOutButton />
        </div>
      </div>
      {links.length > 0 && (
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Role navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

export function NotificationBell({ count }: { count: number }) {
  return (
    <div className="relative">
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </div>
  );
}
