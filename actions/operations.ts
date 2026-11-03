"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/actions/auth";
import {
  PaymentStatus,
  Role,
  OrderStatus,
  NotificationType,
  ReservationStatus,
} from "@prisma/client";
import { toNumber } from "@/lib/decimal";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { convertDecimalsDeep } from "@/lib/decimal";

export async function getManagerOverview() {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.role !== Role.RESTAURANT_OWNER && user.role !== Role.MANAGER)
  ) {
    return { error: "Unauthorized" as const };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    todayOrders,
    pendingOrders,
    completedOrders,
    dineInOrders,
    takeawayOrders,
    todayRevenue,
    availableTables,
    occupiedTables,
    activeStaff,
    kitchenStatuses,
    ingredients,
    pendingPurchases,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.count({
      where: {
        status: {
          in: [
            OrderStatus.PLACED,
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.PREPARED,
            OrderStatus.READY,
          ],
        },
      },
    }),
    prisma.order.count({
      where: { status: OrderStatus.COMPLETED, createdAt: { gte: todayStart } },
    }),
    prisma.order.count({
      where: { orderType: "DINE_IN", createdAt: { gte: todayStart } },
    }),
    prisma.order.count({
      where: { orderType: "TAKEAWAY", createdAt: { gte: todayStart } },
    }),
    prisma.order.aggregate({
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
        createdAt: { gte: todayStart },
      },
      _sum: { totalAmount: true },
    }),
    prisma.table.count({ where: { status: "AVAILABLE" } }),
    prisma.table.count({ where: { status: "OCCUPIED" } }),
    prisma.adminUser.count({ where: { isActive: true } }),
    prisma.order.groupBy({
      by: ["status"],
      where: {
        status: {
          in: [
            OrderStatus.PLACED,
            OrderStatus.PREPARING,
            OrderStatus.PREPARED,
            OrderStatus.READY,
          ],
        },
      },
      _count: { _all: true },
    }),
    prisma.ingredient.findMany({
      where: { isActive: true },
      select: { quantityOnHand: true, minimumQuantity: true },
    }),
    prisma.purchaseOrder.count({
      where: { status: { in: ["SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED"] } },
    }),
  ]);

  return {
    todayOrders,
    pendingOrders,
    completedOrders,
    dineInOrders,
    takeawayOrders,
    todayRevenue: toNumber(todayRevenue._sum.totalAmount),
    availableTables,
    occupiedTables,
    activeStaff,
    kitchenStatuses: kitchenStatuses.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    lowStockItems: ingredients.filter(
      (ingredient) => ingredient.quantityOnHand.lte(ingredient.minimumQuantity)
    ).length,
    pendingPurchases,
  };
}

export async function getManagerOrders() {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.role !== Role.RESTAURANT_OWNER && user.role !== Role.MANAGER)
  ) {
    return [];
  }

  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      orderType: true,
      status: true,
      paymentStatus: true,
      customerName: true,
      totalAmount: true,
      createdAt: true,
      table: { select: { number: true } },
      orderItems: {
        select: {
          quantity: true,
          menuItem: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return convertDecimalsDeep(orders);
}

export async function getManagerReservations() {
  const user = await getCurrentUser();
  if (!user || (user.role !== Role.RESTAURANT_OWNER && user.role !== Role.MANAGER)) {
    return { error: "Unauthorized" as const };
  }

  const [reservations, tables] = await Promise.all([
    prisma.reservation.findMany({
      include: { table: { select: { number: true } } },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    prisma.table.findMany({
      select: { id: true, number: true },
      orderBy: { number: "asc" },
    }),
  ]);
  return { reservations, tables };
}

export async function createManagerReservation(input: unknown) {
  const user = await getCurrentUser();
  if (!user || (user.role !== Role.RESTAURANT_OWNER && user.role !== Role.MANAGER)) {
    return { error: "Unauthorized" as const };
  }
  const parsed = z.object({
    customerName: z.string().trim().min(1).max(120),
    customerPhone: z.string().trim().min(5).max(30),
    guestCount: z.number().int().min(1).max(100),
    startsAt: z.string().datetime(),
    tableId: z.string().uuid().optional().nullable(),
    notes: z.string().trim().max(500).optional(),
  }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (startsAt <= new Date()) {
    return { error: "Reservation time must be in the future." as const };
  }
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      if (parsed.data.tableId) {
        const table = await tx.table.findUnique({
          where: { id: parsed.data.tableId },
          select: { id: true },
        });
        if (!table) throw new Error("Selected table was not found.");

        const conflicts = await tx.reservation.findMany({
          where: {
            tableId: table.id,
            status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED] },
            startsAt: { lt: endsAt },
          },
          select: { startsAt: true, endsAt: true },
        });
        const hasOverlap = conflicts.some((existing) => {
          const existingEnd =
            existing.endsAt ?? new Date(existing.startsAt.getTime() + 2 * 60 * 60 * 1000);
          return existingEnd > startsAt;
        });
        if (hasOverlap) throw new Error("This table already has a reservation during that time.");
      }

      const created = await tx.reservation.create({
        data: {
          customerName: parsed.data.customerName,
          customerPhone: parsed.data.customerPhone,
          guestCount: parsed.data.guestCount,
          startsAt,
          endsAt,
          tableId: parsed.data.tableId || null,
          notes: parsed.data.notes || null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "RESERVATION_CREATED",
          entityType: "Reservation",
          entityId: created.id,
          details: { startsAt: startsAt.toISOString(), tableId: parsed.data.tableId ?? null },
        },
      });
      return created;
    });
    revalidatePath("/manager");
    return { success: true as const, id: reservation.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create reservation." };
  }
}

export async function updateManagerReservationStatus(id: string, status: ReservationStatus) {
  const user = await getCurrentUser();
  if (!user || (user.role !== Role.RESTAURANT_OWNER && user.role !== Role.MANAGER)) {
    return { error: "Unauthorized" as const };
  }
  const parsed = z.object({
    id: z.string().uuid(),
    status: z.nativeEnum(ReservationStatus),
  }).safeParse({ id, status });
  if (!parsed.success) return { error: "Invalid reservation status." as const };

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({
        where: { id: parsed.data.id },
        select: { status: true },
      });
      if (!current) throw new Error("Reservation not found.");
      const allowedNextStatuses: Record<ReservationStatus, ReservationStatus[]> = {
        [ReservationStatus.PENDING]: [ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED],
        [ReservationStatus.CONFIRMED]: [ReservationStatus.SEATED, ReservationStatus.CANCELLED],
        [ReservationStatus.SEATED]: [ReservationStatus.COMPLETED, ReservationStatus.CANCELLED],
        [ReservationStatus.CANCELLED]: [],
        [ReservationStatus.COMPLETED]: [],
      };
      if (!allowedNextStatuses[current.status].includes(parsed.data.status)) {
        throw new Error("That reservation status change is not allowed.");
      }
      await tx.reservation.update({
        where: { id: parsed.data.id },
        data: { status: parsed.data.status },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "RESERVATION_STATUS_UPDATED",
          entityType: "Reservation",
          entityId: parsed.data.id,
          details: { from: current.status, to: parsed.data.status },
        },
      });
    });
    revalidatePath("/manager");
    return { success: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update reservation." };
  }
}

export async function getServiceDashboardData() {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.role !== Role.RESTAURANT_OWNER &&
      user.role !== Role.MANAGER &&
      user.role !== Role.SERVICE_STAFF)
  ) {
    return { orders: [], requests: [] };
  }

  const orderWhere =
    user.role === Role.SERVICE_STAFF
      ? {
          OR: [
            { assignedServiceStaffId: user.id },
            { assignedServiceStaffId: null },
          ],
        }
      : {};

  const [orders, requests] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...orderWhere,
        status: {
          in: [
            OrderStatus.PLACED,
            OrderStatus.PREPARING,
            OrderStatus.PREPARED,
            OrderStatus.READY,
          ],
        },
      },
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        customerName: true,
        customerPhone: true,
        notes: true,
        createdAt: true,
        table: { select: { number: true } },
        orderItems: {
          select: {
            quantity: true,
            menuItem: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.notification.findMany({
      where: {
        type: { in: [NotificationType.CALL_WAITER, NotificationType.REQUEST_BILL] },
        isRead: false,
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);

  return { orders, requests };
}

export async function markServiceRequestHandled(id: string) {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.role !== Role.RESTAURANT_OWNER &&
      user.role !== Role.MANAGER &&
      user.role !== Role.SERVICE_STAFF)
  ) {
    return { error: "Unauthorized" as const };
  }

  const result = await prisma.notification.updateMany({
    where: {
      id,
      type: { in: [NotificationType.CALL_WAITER, NotificationType.REQUEST_BILL] },
      isRead: false,
    },
    data: { isRead: true },
  });
  if (result.count === 0) {
    return { error: "Service request was not found or was already handled." as const };
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: "SERVICE_REQUEST_HANDLED",
      entityType: "Notification",
      entityId: id,
    },
  });
  return { success: true as const };
}
