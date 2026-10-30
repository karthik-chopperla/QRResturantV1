"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { ShoppingBag, Clock, CheckCircle, IndianRupee, Users } from "lucide-react";

interface Stats {
  todayOrders: number;
  pendingOrders: number;
  completedToday: number;
  todayRevenue: number;
  totalTables: number;
  occupiedTables: number;
}

export function DashboardStats({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Today's Revenue", value: formatCurrency(stats.todayRevenue), icon: IndianRupee, color: "text-emerald-600" },
    { label: "Today's Orders", value: stats.todayOrders, icon: ShoppingBag, color: "text-blue-600" },
    { label: "Pending Orders", value: stats.pendingOrders, icon: Clock, color: "text-amber-600" },
    { label: "Completed Today", value: stats.completedToday, icon: CheckCircle, color: "text-green-600" },
    { label: "Tables Occupied", value: `${stats.occupiedTables}/${stats.totalTables}`, icon: Users, color: "text-purple-600" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className={`size-4 ${color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
