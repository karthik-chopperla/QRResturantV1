"use server";

import prisma from "@/lib/prisma";
import { requireCashier } from "@/lib/roles";
import { createTakeawayOrderSchema } from "@/schemas";
import { calculateOrderTotals, priceOrderItems } from "@/lib/order-pricing";
import {
  NotificationType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { convertDecimalsDeep, toNumber } from "@/lib/decimal";

export async function getCashierData() {
  const user = await requireCashier();
  if (!user) return { error: "Unauthorized" as const };

  const [categories, menuItems, orders, openRegister, settings] =
    await Promise.all([
      prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }),
      prisma.menuItem.findMany({
        where: { isAvailable: true },
        include: {
          category: { select: { id: true, name: true } },
          variants: true,
          addons: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.order.findMany({
        where: {
          OR: [
            { orderType: OrderType.DINE_IN },
            { orderType: OrderType.TAKEAWAY },
          ],
          status: {
            notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.COLLECTED],
          },
        },
        select: {
          id: true,
          orderNumber: true,
          orderType: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          customerName: true,
          totalAmount: true,
          createdAt: true,
          table: { select: { number: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.cashRegisterSession.findFirst({
        where: { cashierId: user.id, closedAt: null },
        orderBy: { openedAt: "desc" },
        select: { id: true, openedAt: true },
      }),
      prisma.settings.findUnique({
        where: { id: "singleton" },
        select: {
          currency: true,
          gstPercentage: true,
          serviceChargePercentage: true,
        },
      }),
    ]);

  return convertDecimalsDeep({
    categories,
    menuItems,
    orders,
    openRegister,
    settings: settings
      ? {
          currency: settings.currency,
          gstPercentage: toNumber(settings.gstPercentage),
          serviceChargePercentage: toNumber(settings.serviceChargePercentage),
        }
      : null,
  });
}

export async function createTakeawayOrder(rawData: unknown) {
  const cashier = await requireCashier();
  if (!cashier) return { error: "Unauthorized" as const };

  const parsed = createTakeawayOrderSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const settings = await tx.settings.findUnique({
        where: { id: "singleton" },
      });
      if (!settings) throw new Error("Restaurant settings are not initialized.");

      const menuItems = await tx.menuItem.findMany({
        where: {
          id: { in: data.items.map((item) => item.menuItemId) },
          isAvailable: true,
        },
        include: { variants: true, addons: true },
      });
      const { subtotal, verifiedItems } = priceOrderItems(data.items, menuItems);

      let discountAmount = 0;
      let offerCode: string | null = null;
      if (data.couponCode) {
        const offer = await tx.offer.findUnique({
          where: { code: data.couponCode.trim().toUpperCase() },
        });
        if (
          offer &&
          offer.isActive &&
          offer.expiryDate >= new Date() &&
          (!offer.usageLimit || offer.usageCount < offer.usageLimit) &&
          subtotal >= toNumber(offer.minOrderAmount)
        ) {
          const value = toNumber(offer.discountValue);
          discountAmount =
            offer.discountType === "PERCENTAGE"
              ? Math.min(subtotal, (subtotal * value) / 100)
              : Math.min(subtotal, value);
          offerCode = offer.code;
          await tx.offer.update({
            where: { id: offer.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      const totals = calculateOrderTotals(
        subtotal,
        discountAmount,
        toNumber(settings.gstPercentage),
        toNumber(settings.serviceChargePercentage)
      );
      const orderNumber = `TA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const customerName = data.customerName || "Walk-in customer";
      const register = await tx.cashRegisterSession.findFirst({
        where: { cashierId: cashier.id, closedAt: null },
        orderBy: { openedAt: "desc" },
        select: { id: true },
      });
      if (!register) {
        throw new Error("Open your cash register before creating a takeaway order.");
      }
      const order = await tx.order.create({
        data: {
          orderNumber,
          orderType: OrderType.TAKEAWAY,
          tableId: null,
          customerName,
          customerPhone: data.customerPhone,
          status: OrderStatus.PLACED,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: data.paymentMethod as PaymentMethod,
          subtotal,
          ...totals,
          offerCode,
          notes: data.notes || null,
        },
      });

      await tx.orderItem.createMany({
        data: verifiedItems.map((item) => ({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes,
          customizations: item.customizations,
        })),
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: totals.totalAmount,
          method: data.paymentMethod as PaymentMethod,
          status: PaymentStatus.PENDING,
          cashRegisterSessionId: register?.id,
        },
      });

      await tx.invoice.create({
        data: {
          orderId: order.id,
          invoiceNumber: orderNumber,
          amount: totals.totalAmount,
          taxAmount: totals.gstAmount,
          discountAmount: totals.discountAmount,
        },
      });

      await tx.notification.create({
        data: {
          title: `New Takeaway Order #${orderNumber}`,
          message: `${customerName} placed a takeaway order for ${settings.currency} ${totals.totalAmount}.`,
          type: NotificationType.NEW_ORDER,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: cashier.id,
          actorEmail: cashier.email,
          action: "TAKEAWAY_ORDER_CREATED",
          entityType: "Order",
          entityId: order.id,
          details: {
            orderNumber,
            paymentMethod: data.paymentMethod,
            paymentStatus: PaymentStatus.PENDING,
          },
        },
      });

      return {
        orderId: order.id,
        orderNumber,
        totalAmount: totals.totalAmount,
      };
    });

    revalidatePath("/cashier");
    revalidatePath("/kitchen");
    revalidatePath("/dashboard/orders");
    revalidatePath("/manager");
    return { success: true as const, ...result };
  } catch (error) {
    console.error("createTakeawayOrder error:", error);
    return {
      error: error instanceof Error ? error.message : "Could not create takeaway order.",
    };
  }
}

export async function openCashRegister(openingBalance: number) {
  const cashier = await requireCashier();
  if (!cashier) return { error: "Unauthorized" as const };
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    return { error: "Opening balance must be zero or more." as const };
  }

  try {
    const session = await prisma.cashRegisterSession.create({
      data: { cashierId: cashier.id, openingBalance },
    });
    await prisma.auditLog.create({
      data: {
        actorId: cashier.id,
        actorEmail: cashier.email,
        action: "CASH_REGISTER_OPENED",
        entityType: "CashRegisterSession",
        entityId: session.id,
        details: { openingBalance },
      },
    });
  } catch (error) {
    console.error("openCashRegister error:", error);
    return {
      error: "Could not open register. Check whether you already have an open session.",
    };
  }
  revalidatePath("/cashier");
  return { success: true as const };
}

export async function closeCashRegister(closingBalance: number, notes?: string) {
  const cashier = await requireCashier();
  if (!cashier) return { error: "Unauthorized" as const };
  if (!Number.isFinite(closingBalance) || closingBalance < 0) {
    return { error: "Closing balance must be zero or more." as const };
  }

  const session = await prisma.cashRegisterSession.findFirst({
    where: { cashierId: cashier.id, closedAt: null },
    orderBy: { openedAt: "desc" },
  });
  if (!session) return { error: "There is no open cash register to close." as const };

  const cashSales = await prisma.payment.aggregate({
    where: {
      method: PaymentMethod.CASH,
      status: PaymentStatus.SUCCESS,
      cashRegisterSessionId: session.id,
    },
    _sum: { amount: true },
  });
  const expectedBalance =
    toNumber(session.openingBalance) + toNumber(cashSales._sum.amount);

  await prisma.$transaction(async (tx) => {
    await tx.cashRegisterSession.update({
      where: { id: session.id },
      data: {
        closedAt: new Date(),
        closingBalance,
        expectedBalance,
        notes: notes?.trim() || null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: cashier.id,
        actorEmail: cashier.email,
        action: "CASH_REGISTER_CLOSED",
        entityType: "CashRegisterSession",
        entityId: session.id,
        details: { closingBalance, expectedBalance },
      },
    });
  });

  revalidatePath("/cashier");
  return { success: true as const, expectedBalance };
}
