import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { getUnreadNotificationCount } from "@/actions/notifications";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { canAccessDashboard } from "@/lib/roles";
import { getDefaultRouteForRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, unreadCount] = await Promise.all([
    getCurrentUser().catch(() => null),
    getUnreadNotificationCount().catch(() => 0),
  ]);

  if (!user) redirect("/login?redirect=/dashboard");
  if (!canAccessDashboard(user.role)) redirect(getDefaultRouteForRole(user.role));

  return (
    <DashboardShell user={user} unreadCount={unreadCount}>
      {children}
    </DashboardShell>
  );
}
