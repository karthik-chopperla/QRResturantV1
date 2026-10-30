"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, updateOrderStatus, updateOrderPaymentStatus } from "@/actions/orders";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/format";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { toast } from "sonner";
import { Search, RefreshCw, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(),
    refetchInterval: 10000,
  });

  const filtered = orders.filter((o) => {
    const matchSearch =
      !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.id.includes(search) ||
      o.table.number.includes(search);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleStatusUpdate = async (id: string, status: OrderStatus) => {
    const result = await updateOrderStatus(id, status);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Order marked as ${getOrderStatusLabel(status)}`);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  };

  const handlePaymentUpdate = async (id: string, paymentStatus: PaymentStatus) => {
    const result = await updateOrderPaymentStatus(id, paymentStatus);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Payment status updated");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  };

  const statusFlow: OrderStatus[] = [
    OrderStatus.PLACED,
    OrderStatus.PREPARING,
    OrderStatus.PREPARED,
    OrderStatus.READY,
    OrderStatus.SERVED,
    OrderStatus.COMPLETED,
  ];

  return (
    <div>
      <StaffHeader title="Orders" subtitle="Manage and track all orders" />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.values(OrderStatus).map((s) => (
                  <SelectItem key={s} value={s}>{getOrderStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="size-11 shrink-0" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">Loading orders...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No orders found</p>
        ) : (
          <div className="grid gap-4">
            {filtered.map((order) => (
              <Card key={order.id} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold">{order.customerName}</span>
                        <Badge variant="outline">Table {order.table.number}</Badge>
                        <Badge className={getOrderStatusColor(order.status)} variant="secondary">
                          {getOrderStatusLabel(order.status)}
                        </Badge>
                        <Badge variant={order.paymentStatus === "SUCCESS" ? "default" : "outline"}>
                          {order.paymentStatus}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{order.customerPhone} · {formatDate(order.createdAt)}</p>
                      <div className="mt-3 space-y-1">
                        {order.orderItems.map((item) => (
                          <p key={item.id} className="text-sm">
                            {item.quantity}x {item.menuItem.name} — {formatCurrency(Number(item.price) * item.quantity)}
                          </p>
                        ))}
                      </div>
                      <p className="mt-2 text-lg font-bold">{formatCurrency(order.totalAmount)}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <Select
                        value={order.status}
                        onValueChange={(v) => v && handleStatusUpdate(order.id, v as OrderStatus)}
                      >
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusFlow.map((s) => (
                            <SelectItem key={s} value={s}>{getOrderStatusLabel(s)}</SelectItem>
                          ))}
                          <SelectItem value={OrderStatus.CANCELLED}>Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        {order.paymentStatus === PaymentStatus.PENDING && (
                          <Button size="sm" onClick={() => handlePaymentUpdate(order.id, PaymentStatus.SUCCESS)} className="flex-1 sm:flex-none">
                            Mark Paid
                          </Button>
                        )}
                        {order.status === OrderStatus.COMPLETED && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 flex-1 sm:flex-none"
                            onClick={() => window.open(`/api/bills/${order.id}`, "_blank")}
                          >
                            <FileText className="size-3.5" />
                            View Bill
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
