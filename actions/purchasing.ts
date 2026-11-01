"use server";

import prisma from "@/lib/prisma";
import { requireOwner, requirePurchaseAccess } from "@/lib/roles";
import {
  NotificationType,
  PaymentMethod,
  PurchaseStatus,
  StockMovementType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { convertDecimalsDeep } from "@/lib/decimal";

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(150),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function getPurchasingData() {
  const user = await requirePurchaseAccess();
  if (!user) return { error: "Unauthorized" as const };

  const [suppliers, ingredients, purchaseOrders] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.ingredient.findMany({
      select: { id: true, name: true, unit: true, unitCost: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { name: true } },
        items: {
          include: { ingredient: { select: { name: true, unit: true } } },
        },
        receipts: { select: { id: true, receivedAt: true } },
        supplierPayments: {
          select: { id: true, amount: true, paidAt: true, method: true, reference: true },
          orderBy: { paidAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return convertDecimalsDeep({ suppliers, ingredients, purchaseOrders });
}

export async function saveSupplier(input: unknown) {
  const user = await requirePurchaseAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    id: z.string().uuid().optional(),
    ...supplierSchema.shape,
  }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }
  try {
    const supplier = parsed.data.id
      ? await prisma.supplier.update({
          where: { id: parsed.data.id },
          data: {
            name: parsed.data.name,
            contactName: parsed.data.contactName || null,
            email: parsed.data.email || null,
            phone: parsed.data.phone || null,
            address: parsed.data.address || null,
            notes: parsed.data.notes || null,
          },
        })
      : await prisma.supplier.create({
          data: {
            name: parsed.data.name,
            contactName: parsed.data.contactName || null,
            email: parsed.data.email || null,
            phone: parsed.data.phone || null,
            address: parsed.data.address || null,
            notes: parsed.data.notes || null,
          },
        });
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: parsed.data.id ? "SUPPLIER_UPDATED" : "SUPPLIER_CREATED",
        entityType: "Supplier",
        entityId: supplier.id,
      },
    });
    revalidatePath("/purchasing");
    return { success: true as const };
  } catch {
    return { error: "Could not save supplier; verify the details and try again." as const };
  }
}

export async function setSupplierActive(id: string, isActive: boolean) {
  const user = await requirePurchaseAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    id: z.string().uuid(),
    isActive: z.boolean(),
  }).safeParse({ id, isActive });
  if (!parsed.success) return { error: "Invalid supplier update." as const };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id: parsed.data.id },
        data: { isActive: parsed.data.isActive },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: parsed.data.isActive ? "SUPPLIER_REACTIVATED" : "SUPPLIER_DEACTIVATED",
          entityType: "Supplier",
          entityId: parsed.data.id,
        },
      });
    });
    revalidatePath("/purchasing");
    return { success: true as const };
  } catch {
    return { error: "Could not update supplier." as const };
  }
}

export async function createPurchaseOrder(input: unknown) {
  const user = await requirePurchaseAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    supplierId: z.string().uuid(),
    notes: z.string().trim().max(1000).optional(),
    items: z.array(z.object({
      ingredientId: z.string().uuid(),
      quantity: z.number().finite().positive(),
      unitCost: z.number().finite().nonnegative(),
    })).min(1).max(100),
  }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }
  if (new Set(parsed.data.items.map((item) => item.ingredientId)).size !== parsed.data.items.length) {
    return { error: "Each ingredient can appear only once in a purchase order." as const };
  }

  try {
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: parsed.data.supplierId, isActive: true },
        select: { id: true },
      });
      if (!supplier) throw new Error("Supplier not found or inactive.");

      const ingredientCount = await tx.ingredient.count({
        where: { id: { in: parsed.data.items.map((item) => item.ingredientId) } },
      });
      if (ingredientCount !== parsed.data.items.length) {
        throw new Error("One or more ingredients were not found.");
      }

      const totalAmount = parsed.data.items.reduce(
        (total, item) => total + item.quantity * item.unitCost,
        0
      );
      const purchaseNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const purchase = await tx.purchaseOrder.create({
        data: {
          purchaseNumber,
          supplierId: supplier.id,
          status: PurchaseStatus.SUBMITTED,
          totalAmount,
          notes: parsed.data.notes || null,
          createdById: user.id,
          items: {
            create: parsed.data.items.map((item) => ({
              ingredientId: item.ingredientId,
              orderedQuantity: item.quantity,
              unitCost: item.unitCost,
            })),
          },
        },
      });
      await tx.notification.create({
        data: {
          title: `Purchase approval needed: ${purchaseNumber}`,
          message: "A purchase order was submitted for Owner approval.",
          type: NotificationType.PURCHASE_APPROVAL,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "PURCHASE_ORDER_SUBMITTED",
          entityType: "PurchaseOrder",
          entityId: purchase.id,
          details: { purchaseNumber, totalAmount },
        },
      });
      return purchase;
    });
    revalidatePath("/purchasing");
    revalidatePath("/manager");
    return { success: true as const, purchaseNumber: purchaseOrder.purchaseNumber };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create purchase order.",
    };
  }
}

export async function approvePurchaseOrder(id: string) {
  const owner = await requireOwner();
  if (!owner) return { error: "Only the Restaurant Owner can approve purchases." as const };

  try {
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchaseOrder.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!purchase || purchase.status !== PurchaseStatus.SUBMITTED) {
        throw new Error("Only submitted purchase orders can be approved.");
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseStatus.APPROVED, approvedById: owner.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: owner.id,
          actorEmail: owner.email,
          action: "PURCHASE_ORDER_APPROVED",
          entityType: "PurchaseOrder",
          entityId: id,
        },
      });
    });
    revalidatePath("/purchasing");
    return { success: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not approve purchase." };
  }
}

export async function receivePurchase(input: unknown) {
  const user = await requirePurchaseAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    purchaseOrderId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
    supplierInvoiceNumber: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(500).optional(),
    items: z.array(z.object({
      purchaseOrderItemId: z.string().uuid(),
      quantity: z.number().finite().positive(),
    })).min(1).max(100),
  }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existingReceipt = await tx.purchaseReceipt.findUnique({
        where: { idempotencyKey: parsed.data.idempotencyKey },
        select: { id: true },
      });
      if (existingReceipt) return;

      const purchase = await tx.purchaseOrder.findUnique({
        where: { id: parsed.data.purchaseOrderId },
        include: { items: true },
      });
      if (
        !purchase ||
        (purchase.status !== PurchaseStatus.APPROVED &&
          purchase.status !== PurchaseStatus.PARTIALLY_RECEIVED)
      ) {
        throw new Error("Only approved purchase orders can receive stock.");
      }

      const receipt = await tx.purchaseReceipt.create({
        data: {
          purchaseOrderId: purchase.id,
          idempotencyKey: parsed.data.idempotencyKey,
          supplierInvoiceNumber: parsed.data.supplierInvoiceNumber || null,
          notes: parsed.data.notes || null,
          receivedById: user.id,
          items: {
            create: parsed.data.items.map((item) => {
              const purchaseItem = purchase.items.find(
                (entry) => entry.id === item.purchaseOrderItemId
              );
              if (!purchaseItem) throw new Error("Purchase item not found.");
              const remaining =
                Number(purchaseItem.orderedQuantity) -
                Number(purchaseItem.receivedQuantity);
              if (item.quantity > remaining) {
                throw new Error(`Received quantity exceeds the remaining amount for purchase item ${purchaseItem.id}.`);
              }
              return {
                purchaseOrderItemId: purchaseItem.id,
                ingredientId: purchaseItem.ingredientId,
                quantity: item.quantity,
                unitCost: purchaseItem.unitCost,
              };
            }),
          },
        },
        include: { items: true },
      });

      for (const received of receipt.items) {
        const key = `receipt:${parsed.data.idempotencyKey}:${received.ingredientId}`;
        await tx.ingredient.update({
          where: { id: received.ingredientId },
          data: {
            quantityOnHand: { increment: received.quantity },
            unitCost: received.unitCost,
          },
        });
        await tx.purchaseOrderItem.update({
          where: { id: received.purchaseOrderItemId },
          data: { receivedQuantity: { increment: received.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            ingredientId: received.ingredientId,
            type: StockMovementType.PURCHASE,
            quantity: received.quantity,
            unitCost: received.unitCost,
            reason: `Received for ${purchase.purchaseNumber}`,
            referenceType: "PurchaseReceipt",
            referenceId: receipt.id,
            idempotencyKey: key,
            actorId: user.id,
          },
        });
      }

      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: purchase.id },
        select: { orderedQuantity: true, receivedQuantity: true },
      });
      const allReceived = updatedItems.every(
        (item) => Number(item.receivedQuantity) >= Number(item.orderedQuantity)
      );
      await tx.purchaseOrder.update({
        where: { id: purchase.id },
        data: {
          status: allReceived
            ? PurchaseStatus.RECEIVED
            : PurchaseStatus.PARTIALLY_RECEIVED,
        },
      });
      await tx.notification.create({
        data: {
          title: `Purchase received: ${purchase.purchaseNumber}`,
          message: "Confirmed received quantities were added to inventory.",
          type: NotificationType.PURCHASE_RECEIVED,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "PURCHASE_RECEIPT_CONFIRMED",
          entityType: "PurchaseReceipt",
          entityId: receipt.id,
          details: { purchaseNumber: purchase.purchaseNumber },
        },
      });
    });
    revalidatePath("/purchasing");
    revalidatePath("/inventory");
    revalidatePath("/manager");
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not receive purchase.",
    };
  }
}

export async function recordSupplierPayment(input: unknown) {
  const user = await requirePurchaseAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    purchaseOrderId: z.string().uuid(),
    amount: z.number().finite().positive(),
    method: z.enum(["CASH", "UPI", "CARD"]),
    reference: z.string().trim().max(120).optional(),
  }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchaseOrder.findUnique({
        where: { id: parsed.data.purchaseOrderId },
      });
      if (!purchase) throw new Error("Purchase order not found.");
      const payments = await tx.supplierPayment.aggregate({
        where: { purchaseOrderId: purchase.id },
        _sum: { amount: true },
      });
      const outstanding =
        Number(purchase.totalAmount) - Number(payments._sum.amount ?? 0);
      if (parsed.data.amount > outstanding) {
        throw new Error(`Payment exceeds the outstanding balance of ${outstanding}.`);
      }

      const payment = await tx.supplierPayment.create({
        data: {
          purchaseOrderId: purchase.id,
          amount: parsed.data.amount,
          method: parsed.data.method as PaymentMethod,
          reference: parsed.data.reference || null,
          recordedById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "SUPPLIER_PAYMENT_RECORDED",
          entityType: "SupplierPayment",
          entityId: payment.id,
          details: {
            purchaseOrderId: purchase.id,
            amount: parsed.data.amount,
            method: parsed.data.method,
          },
        },
      });
    });
    revalidatePath("/purchasing");
    revalidatePath("/accountant");
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not record supplier payment.",
    };
  }
}
