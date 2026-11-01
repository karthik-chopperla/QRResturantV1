"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OrderStatus, ReservationStatus } from "@prisma/client";
import {
  createManagerReservation,
  getManagerOrders,
  getManagerOverview,
  getManagerReservations,
  updateManagerReservationStatus,
} from "@/actions/operations";
import { updateOrderStatus } from "@/actions/orders";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, getOrderStatusLabel } from "@/lib/format";
import { toast } from "sonner";
import { useState } from "react";

const statCards = [
  { key: "todayOrders", label: "Orders Today", format: (value: number) => String(value) },
  { key: "pendingOrders", label: "Pending Orders", format: (value: number) => String(value) },
  { key: "completedOrders", label: "Completed Today", format: (value: number) => String(value) },
  { key: "todayRevenue", label: "Paid Revenue Today", format: formatCurrency },
  { key: "dineInOrders", label: "Dine-in Today", format: (value: number) => String(value) },
  { key: "takeawayOrders", label: "Takeaway Today", format: (value: number) => String(value) },
  { key: "availableTables", label: "Available Tables", format: (value: number) => String(value) },
  { key: "occupiedTables", label: "Occupied Tables", format: (value: number) => String(value) },
  { key: "activeStaff", label: "Active Staff", format: (value: number) => String(value) },
  { key: "lowStockItems", label: "Low-stock Ingredients", format: (value: number) => String(value) },
  { key: "pendingPurchases", label: "Pending Purchases", format: (value: number) => String(value) },
] as const;

export default function ManagerPage() {
  const queryClient = useQueryClient();
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [reservation, setReservation] = useState({
    customerName: "",
    customerPhone: "",
    guestCount: "2",
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    tableId: "",
    notes: "",
  });
  const { data: reservationData } = useQuery({
    queryKey: ["manager-reservations"],
    queryFn: getManagerReservations,
  });
  const { data: overview } = useQuery({
    queryKey: ["manager-overview"],
    queryFn: getManagerOverview,
    refetchInterval: 15000,
  });
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["manager-orders"],
    queryFn: getManagerOrders,
    refetchInterval: 10000,
  });

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    setUpdatingOrderId(id);
    try {
      const result = await updateOrderStatus(id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Order updated to ${getOrderStatusLabel(status)}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manager-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["manager-overview"] }),
      ]);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleCreateReservation = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await createManagerReservation({
      ...reservation,
      guestCount: Number(reservation.guestCount),
      startsAt: new Date(reservation.startsAt).toISOString(),
      tableId: reservation.tableId || null,
    });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Reservation created");
    setReservation((current) => ({
      ...current,
      customerName: "",
      customerPhone: "",
      notes: "",
    }));
    await queryClient.invalidateQueries({ queryKey: ["manager-reservations"] });
  };

  const handleReservationStatus = async (id: string, status: ReservationStatus) => {
    const result = await updateManagerReservationStatus(id, status);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Reservation marked ${status.toLowerCase()}`);
    await queryClient.invalidateQueries({ queryKey: ["manager-reservations"] });
  };

  return (
    <main>
      <StaffHeader title="Manager Dashboard" subtitle="Restaurant operations overview" role="MANAGER" />
      <div className="space-y-6 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(({ key, label, format }) => (
            <Card key={key}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">
                  {overview && "error" in overview ? "—" : format(Number(overview?.[key] ?? 0))}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Reservations</h2>
            <p className="text-sm text-muted-foreground">Create bookings and track confirmation, seating, and completion.</p>
          </div>
          <Card>
            <CardContent className="p-4">
              <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => void handleCreateReservation(event)}>
                <input className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Guest name" placeholder="Guest name" value={reservation.customerName} onChange={(event) => setReservation({ ...reservation, customerName: event.target.value })} required />
                <input className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Guest phone" placeholder="Phone" value={reservation.customerPhone} onChange={(event) => setReservation({ ...reservation, customerPhone: event.target.value })} required />
                <input className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Guest count" type="number" min="1" max="100" value={reservation.guestCount} onChange={(event) => setReservation({ ...reservation, guestCount: event.target.value })} required />
                <input className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Reservation time" type="datetime-local" value={reservation.startsAt} onChange={(event) => setReservation({ ...reservation, startsAt: event.target.value })} required />
                <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Reservation table" value={reservation.tableId} onChange={(event) => setReservation({ ...reservation, tableId: event.target.value })}>
                  <option value="">Assign table later</option>
                  {reservationData && "tables" in reservationData && (reservationData.tables ?? []).map((table) => <option key={table.id} value={table.id}>Table {table.number}</option>)}
                </select>
                <input className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Reservation notes" placeholder="Notes (optional)" value={reservation.notes} onChange={(event) => setReservation({ ...reservation, notes: event.target.value })} />
                <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:col-span-2 lg:col-span-3" type="submit">Create reservation</button>
              </form>
            </CardContent>
          </Card>
          {reservationData && "error" in reservationData ? (
            <p className="text-sm text-destructive">{reservationData.error}</p>
          ) : reservationData && "reservations" in reservationData && (reservationData.reservations ?? []).length > 0 ? (
            <div className="space-y-2">
              {(reservationData.reservations ?? []).map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><strong>{item.customerName}</strong><Badge variant="outline">{item.status}</Badge></div>
                      <p className="text-sm text-muted-foreground">{item.customerPhone} · {item.guestCount} guests · {formatDate(item.startsAt)} · {item.table ? `Table ${item.table.number}` : "Table unassigned"}</p>
                      {item.notes && <p className="text-sm">{item.notes}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.status === ReservationStatus.PENDING && <Button size="sm" onClick={() => void handleReservationStatus(item.id, ReservationStatus.CONFIRMED)}>Confirm</Button>}
                      {(item.status === ReservationStatus.PENDING || item.status === ReservationStatus.CONFIRMED) && <Button size="sm" variant="outline" onClick={() => void handleReservationStatus(item.id, ReservationStatus.CANCELLED)}>Cancel</Button>}
                      {item.status === ReservationStatus.CONFIRMED && <Button size="sm" onClick={() => void handleReservationStatus(item.id, ReservationStatus.SEATED)}>Seat guests</Button>}
                      {item.status === ReservationStatus.SEATED && <Button size="sm" onClick={() => void handleReservationStatus(item.id, ReservationStatus.COMPLETED)}>Complete</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No reservations recorded.</p>}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Kitchen Queue</h2>
            <p className="text-sm text-muted-foreground">Current active orders by preparation status.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {overview && !("error" in overview) && overview.kitchenStatuses.map((item) => (
              <Badge key={item.status} variant="secondary">
                {getOrderStatusLabel(item.status)}: {item.count}
              </Badge>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Recent Orders</h2>
            <p className="text-sm text-muted-foreground">Operations view. Payment records and staff administration remain Owner-only.</p>
          </div>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading orders…</p>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{order.customerName}</strong>
                        <Badge variant="outline">
                          {order.table ? `Table ${order.table.number}` : `Takeaway #${order.orderNumber ?? order.id.slice(-8)}`}
                        </Badge>
                        <Badge variant="secondary">{getOrderStatusLabel(order.status)}</Badge>
                        <Badge variant="outline">{order.paymentStatus}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.orderItems.map((item) => `${item.quantity}× ${item.menuItem.name}`).join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.createdAt)} · {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                    <Select
                      value={order.status}
                      disabled={updatingOrderId === order.id}
                      onValueChange={(value) => {
                        if (value) void handleStatusChange(order.id, value as OrderStatus);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(OrderStatus)
                          .filter((status) => status !== OrderStatus.COLLECTED)
                          .map((status) => (
                            <SelectItem key={status} value={status}>
                              {getOrderStatusLabel(status)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
