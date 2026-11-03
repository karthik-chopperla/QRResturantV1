"use server";

import prisma from "@/lib/prisma";
import {
  requireInventoryAccess,
  requireOwner,
  requirePurchaseAccess,
} from "@/lib/roles";
import {
  NotificationType,
  PaymentMethod,
  PurchaseStatus,
  PurchaseRequestStatus,
  StockMovementType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { convertDecimalsDeep } from "@/lib/decimal";
import { addIngredientStock } from "@/lib/inventory-stock";

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

  const [suppliers, ingredients, purchaseOrders, purchaseRequests] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.ingredient.findMany({
      where: { isActive: true },
      select: { id: true, name: true, unit: true, unitCost: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { name: true } },
        purchaseRequest: { select: { requestNumber: true } },
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
    prisma.purchaseRequest.findMany({
      include: {
        items: {
          include: { ingredient: { select: { id: true, name: true, unit: true } } },
        },
        purchaseOrder: {
          select: {
            id: true,
            purchaseNumber: true,
            status: true,
            expectedDeliveryAt: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return convertDecimalsDeep({ suppliers, ingredients, purchaseOrders, purchaseRequests });
}

export async function createPurchaseRequest(input: unknown) {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    notes: z.string().trim().max(500).optional(),
    items: z.array(z.object({
      ingredientId: z.string().uuid(),
      quantity: z.number().finite().positive(),
    })).min(1).max(100),
  }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }
  if (new Set(parsed.data.items.map((item) => item.ingredientId)).size !== parsed.data.items.length) {
    return { error: "Each ingredient can appear only once in a request." as const };
  }

  try {
    const request = await prisma.$transaction(async (tx) => {
      const activeIngredients = await tx.ingredient.count({
        where: {
          id: { in: parsed.data.items.map((item) => item.ingredientId) },
          isActive: true,
        },
      });
      if (activeIngredients !== parsed.data.items.length) {
        throw new Error("One or more ingredients were not found or are inactive.");
      }
      const requestNumber = `PR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const created = await tx.purchaseRequest.create({
        data: {
          requestNumber,
          notes: parsed.data.notes || null,
          requestedById: user.id,
          items: {
            create: parsed.data.items.map((item) => ({
              ingredientId: item.ingredientId,
              quantity: item.quantity,
            })),
          },
        },
      });
      await tx.notification.create({
        data: {
          title: `Inventory purchase request: ${requestNumber}`,
          message: "An Inventory Manager submitted a purchase request for review.",
          type: NotificationType.PURCHASE_APPROVAL,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "PURCHASE_REQUEST_SUBMITTED",
          entityType: "PurchaseRequest",
          entityId: created.id,
          details: { requestNumber, itemCount: parsed.data.items.length },
        },
      });
      return created;
    });
    revalidatePath("/inventory");
    revalidatePath("/purchasing");
    return { success: true as const, requestNumber: request.requestNumber };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not submit purchase request.",
    };
  }
}

export async function rejectPurchaseRequest(id: string) {
  const user = await requirePurchaseAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid purchase request." as const };
  try {
    await prisma.$transaction(async (tx) => {
      const request = await tx.purchaseRequest.findUnique({
        where: { id: parsed.data },
        select: { status: true },
      });
      if (!request || request.status !== PurchaseRequestStatus.PENDING) {
        throw new Error("Only pending requests can be rejected.");
      }
      await tx.purchaseRequest.update({
        where: { id: parsed.data },
        data: { status: PurchaseRequestStatus.REJECTED },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "PURCHASE_REQUEST_REJECTED",
          entityType: "PurchaseRequest",
          entityId: parsed.data,
        },
      });
    });
    revalidatePath("/purchasing");
    revalidatePath("/inventory");
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not reject purchase request.",
    };
  }
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
    purchaseRequestId: z.string().uuid().optional(),
    expectedDeliveryAt: z.string().date().optional(),
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

      const request = parsed.data.purchaseRequestId
        ? await tx.purchaseRequest.findUnique({
            where: { id: parsed.data.purchaseRequestId },
            include: { items: true },
          })
        : null;
      if (parsed.data.purchaseRequestId && !request) {
        throw new Error("Purchase request not found.");
      }
      if (request && request.status !== PurchaseRequestStatus.PENDING) {
        throw new Error("This purchase request has already been processed.");
      }
      if (request) {
        const orderIngredientIds = new Set(
          parsed.data.items.map((item) => item.ingredientId)
        );
        if (request.items.some((item) => !orderIngredientIds.has(item.ingredientId))) {
          throw new Error("The purchase order must include every requested ingredient.");
        }
        for (const requestItem of request.items) {
          const orderItem = parsed.data.items.find(
            (item) => item.ingredientId === requestItem.ingredientId
          );
          if (!orderItem || orderItem.quantity < Number(requestItem.quantity)) {
            throw new Error("Purchase quantities cannot be lower than the requested quantities.");
          }
        }
      }

      const ingredientCount = await tx.ingredient.count({
        where: {
          id: { in: parsed.data.items.map((item) => item.ingredientId) },
          isActive: true,
        },
      });
      if (ingredientCount !== parsed.data.items.length) {
        throw new Error("One or more ingredients were not found or are inactive.");
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
          purchaseRequestId: request?.id,
          status: PurchaseStatus.SUBMITTED,
          totalAmount,
          notes: parsed.data.notes || null,
          expectedDeliveryAt: parsed.data.expectedDeliveryAt
            ? new Date(`${parsed.data.expectedDeliveryAt}T23:59:59.999Z`)
            : null,
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
      if (request) {
        await tx.purchaseRequest.update({
          where: { id: request.id },
          data: { status: PurchaseRequestStatus.PO_SUBMITTED },
        });
      }
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
        select: { status: true, purchaseRequestId: true },
      });
      if (!purchase || purchase.status !== PurchaseStatus.SUBMITTED) {
        throw new Error("Only submitted purchase orders can be approved.");
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseStatus.APPROVED, approvedById: owner.id },
      });
      if (purchase.purchaseRequestId) {
        await tx.purchaseRequest.update({
          where: { id: purchase.purchaseRequestId },
          data: { status: PurchaseRequestStatus.APPROVED },
        });
      }
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
      batchNumber: z.string().trim().max(100).optional(),
      expiresAt: z.string().date().optional(),
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
                batchNumber: item.batchNumber || null,
                expiresAt: item.expiresAt
                  ? new Date(`${item.expiresAt}T23:59:59.999Z`)
                  : null,
              };
            }),
          },
        },
        include: { items: true },
      });

      for (const received of receipt.items) {
        const key = `receipt:${parsed.data.idempotencyKey}:${received.ingredientId}`;
        const batch = await addIngredientStock(tx, {
          ingredientId: received.ingredientId,
          quantity: Number(received.quantity),
          unitCost: Number(received.unitCost),
          batchNumber: received.batchNumber,
          expiresAt: received.expiresAt,
        });
        await tx.purchaseReceiptItem.update({
          where: { id: received.id },
          data: { batchId: batch.id },
        });
        await tx.purchaseOrderItem.update({
          where: { id: received.purchaseOrderItemId },
          data: { receivedQuantity: { increment: received.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            ingredientId: received.ingredientId,
            batchId: batch.id,
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
      if (purchase.purchaseRequestId) {
        await tx.purchaseRequest.update({
          where: { id: purchase.purchaseRequestId },
          data: {
            status: allReceived
              ? PurchaseRequestStatus.RECEIVED
              : PurchaseRequestStatus.PARTIALLY_RECEIVED,
          },
        });
      }
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
