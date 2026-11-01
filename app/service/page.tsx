"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OrderStatus } from "@prisma/client";
import {
  getServiceDashboardData,
  markServiceRequestHandled,
} from "@/actions/operations";
import { updateOrderStatus } from "@/actions/orders";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, getOrderStatusLabel } from "@/lib/format";
import { toast } from "sonner";

export default function ServicePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["service-dashboard"],
    queryFn: getServiceDashboardData,
    refetchInterval: 10000,
  });

  const handleOrder = async (id: string, status: OrderStatus) => {
    const result = await updateOrderStatus(id, status);
    if (result.error) toast.error(result.error);
    else {
      toast.success(status === OrderStatus.SERVED ? "Order marked served" : "Takeaway marked collected");
      await queryClient.invalidateQueries({ queryKey: ["service-dashboard"] });
    }
  };

  const handleRequest = async (id: string) => {
    const result = await markServiceRequestHandled(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Service request marked handled");
      await queryClient.invalidateQueries({ queryKey: ["service-dashboard"] });
    }
  };

  const orders = data?.orders ?? [];
  const readyOrders = orders.filter((order) => order.status === OrderStatus.READY);

  return (
    <main>
      <StaffHeader title="Service Staff" subtitle="Tables, ready orders, and customer requests" role="SERVICE_STAFF" />
      <div className="space-y-6 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active orders</p><p className="text-2xl font-semibold">{orders.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Ready to hand over</p><p className="text-2xl font-semibold">{readyOrders.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Open customer requests</p><p className="text-2xl font-semibold">{data?.requests.length ?? 0}</p></CardContent></Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Customer Requests</h2>
          {(data?.requests.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No open service requests.</p>
          ) : data?.requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <strong>{request.title}</strong>
                  <p className="text-sm text-muted-foreground">{request.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
                </div>
                <Button size="sm" onClick={() => void handleRequest(request.id)}>Mark handled</Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Active Orders</h2>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading orders…</p>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No active orders assigned.</p>
          ) : orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{order.customerName}</strong>
                    <Badge variant="outline">
                      {order.table ? `Table ${order.table.number}` : `Takeaway #${order.orderNumber ?? order.id.slice(-8)}`}
                    </Badge>
                    <Badge variant="secondary">{getOrderStatusLabel(order.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.orderItems.map((item) => `${item.quantity}× ${item.menuItem.name}`).join(", ")}
                  </p>
                  {order.notes && <p className="text-sm">Note: {order.notes}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                {order.status === OrderStatus.READY && (
                  <Button
                    onClick={() =>
                      void handleOrder(
                        order.id,
                        order.orderType === "TAKEAWAY"
                          ? OrderStatus.COLLECTED
                          : OrderStatus.SERVED
                      )
                    }
                  >
                    {order.orderType === "TAKEAWAY" ? "Mark collected" : "Mark served"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
