"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/format";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Order = {
  id: string;
  customerName: string;
  totalAmount: number | { toNumber(): number };
  status: string;
  createdAt: Date;
  table: { number: string };
};

export function RecentOrdersTable({ orders }: { orders: Order[] }) {
  return (
    <Card className="border-border/60 h-full flex flex-col justify-start">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Orders</CardTitle>
        <Link href="/dashboard/orders">
          <Button variant="outline" size="sm">View All</Button>
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders yet</p>
        ) : (
          <>
            {/* Desktop: table layout */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Order</th>
                    <th className="pb-3 pr-4 font-medium">Table</th>
                    <th className="pb-3 pr-4 font-medium">Customer</th>
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border/50">
                      <td className="py-3 pr-4 font-mono text-xs">{order.id.slice(0, 8)}...</td>
                      <td className="py-3 pr-4">T-{order.table.number}</td>
                      <td className="py-3 pr-4">{order.customerName}</td>
                      <td className="py-3 pr-4 font-medium">{formatCurrency(order.totalAmount)}</td>
                      <td className="py-3 pr-4">
                        <Badge className={getOrderStatusColor(order.status)} variant="secondary">
                          {getOrderStatusLabel(order.status)}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: card layout */}
            <div className="space-y-3 md:hidden">
              {orders.map((order) => (
                <div key={order.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{order.customerName}</span>
                    <span className="font-bold">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <span>T-{order.table.number}</span>
                    <span>·</span>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  <div className="mt-2">
                    <Badge className={getOrderStatusColor(order.status)} variant="secondary">
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
