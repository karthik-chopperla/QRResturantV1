"use server";

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/roles";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { convertDecimalsDeep, toNumber } from "@/lib/decimal";

const emptyStats = { todayOrders: 0, pendingOrders: 0, completedToday: 0, todayRevenue: 0, totalTables: 0, occupiedTables: 0, topItems: [] as { item: Prisma.MenuItemGetPayload<object> | null; quantity: number }[], chartData: [] as { date: string; revenue: number }[], totalRevenue: 0, avgOrderValue: 0 };

export async function getDashboardStats() {
  const user = await requireAdmin();
  if (!user) return { ...emptyStats };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const [
      todayOrders,
      pendingOrders,
      completedToday,
      todayRevenue,
      totalTables,
      occupiedTables,
      allOrders,
    ] = await Promise.all([
      prisma.order.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.order.count({
        where: {
          status: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.PREPARED, OrderStatus.READY] },
        },
      }),
      prisma.order.count({
        where: { status: OrderStatus.COMPLETED, createdAt: { gte: todayStart } },
      }),
      prisma.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.SUCCESS,
          createdAt: { gte: todayStart },
        },
        _sum: { totalAmount: true },
      }),
      prisma.table.count(),
      prisma.table.count({ where: { status: "OCCUPIED" } }),
      prisma.order.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { totalAmount: true, createdAt: true, paymentStatus: true },
      }),
    ]);

    const popularItems = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    const menuItemIds = popularItems.map((p) => p.menuItemId);
    const menuItems = menuItemIds.length
      ? await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } })
      : [];

    const topItems = popularItems.map((p) => ({
      item: menuItems.find((m) => m.id === p.menuItemId),
      quantity: p._sum.quantity || 0,
    }));

    const salesByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      salesByDay[d.toISOString().split("T")[0]] = 0;
    }
    allOrders
      .filter((o) => o.paymentStatus === PaymentStatus.SUCCESS)
      .forEach((o) => {
        const key = o.createdAt.toISOString().split("T")[0];
        if (salesByDay[key] !== undefined) {
          salesByDay[key] += toNumber(o.totalAmount);
        }
      });

    const chartData = Object.entries(salesByDay).map(([date, revenue]) => ({
      date: new Date(date).toLocaleDateString("en-IN", { weekday: "short" }),
      revenue,
    }));

    const totalRevenue = allOrders
      .filter((o) => o.paymentStatus === PaymentStatus.SUCCESS)
      .reduce((s, o) => s + toNumber(o.totalAmount), 0);

    const avgOrderValue = todayOrders > 0 ? toNumber(todayRevenue._sum.totalAmount) / todayOrders : 0;

    return convertDecimalsDeep({
      todayOrders,
      pendingOrders,
      completedToday,
      todayRevenue: toNumber(todayRevenue._sum.totalAmount),
      totalTables,
      occupiedTables,
      topItems,
      chartData,
      totalRevenue,
      avgOrderValue,
    });
  } catch {
    return { ...emptyStats };
  }
}

function csvSafeField(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : `"${escaped}"`;
}

export async function exportOrdersCSV() {
  const user = await requireAdmin();
  if (!user) return "";

  try {
    const orders = await prisma.order.findMany({
      include: { table: true },
      orderBy: { createdAt: "desc" },
    });

    const header = "Order ID,Table,Customer,Phone,Status,Payment,Total,Date\n";
    const rows = orders
      .map(
        (o) =>
          `${o.id},${o.table?.number ?? o.orderNumber ?? "Takeaway"},${csvSafeField(o.customerName)},${o.customerPhone},${o.status},${o.paymentStatus},${o.totalAmount},${o.createdAt.toISOString()}`
      )
      .join("\n");

    return header + rows;
  } catch {
    return "";
  }
}
