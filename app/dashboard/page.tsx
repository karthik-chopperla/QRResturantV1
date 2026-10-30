"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/actions/analytics";
import { getOrders } from "@/actions/orders";
import { getNotifications } from "@/actions/notifications";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { DashboardStats } from "@/components/features/dashboard/dashboard-stats";
import { RecentOrdersTable } from "@/components/features/dashboard/recent-orders";
import { NotificationsPanel } from "@/components/features/dashboard/notifications-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesChartWrapper } from "@/components/features/dashboard/sales-chart-wrapper";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
    refetchInterval: 10000,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(),
    refetchInterval: 10000,
  });



  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    refetchInterval: 10000,
  });

  return (
    <div>
      <StaffHeader title="Dashboard" subtitle="Overview of your restaurant today" />
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <DashboardStats stats={stats} />
        ) : null}
        
        {/* Row 1: Sales Chart (2 cols) & Notifications Panel (1 col) */}
        <div className="grid gap-6 lg:grid-cols-3 items-stretch">
          {/* Left Column: Sales Chart & Recent Orders */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div>
              {statsLoading ? (
                <Skeleton className="h-[340px] w-full rounded-xl" />
              ) : stats ? (
                <SalesChartWrapper data={stats.chartData} />
              ) : null}
            </div>
            <div>
              {ordersLoading ? (
                <Skeleton className="h-[320px] w-full rounded-xl" />
              ) : (
                <RecentOrdersTable orders={orders.slice(0, 5)} />
              )}
            </div>
          </div>

          {/* Right Column: Notifications Panel */}
          <div className="lg:col-span-1 lg:relative min-h-[300px] sm:min-h-[400px] lg:min-h-0">
            <div className="lg:absolute lg:inset-0 flex flex-col">
              {notificationsLoading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : (
                <NotificationsPanel notifications={notifications} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
