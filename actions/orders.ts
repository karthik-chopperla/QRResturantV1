"use server";

import prisma from "@/lib/prisma";
import { getRazorpayClient } from "@/lib/razorpay";
import {
  requireCashier,
  requireOrderStatusAccess,
  requireOrdersViewer,
  canAccessKitchen,
} from "@/lib/roles";
import { getCurrentUser } from "./auth";
import { validateOffer } from "./offers";
import { createOrderSchema, type CreateOrderInput } from "@/schemas";
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  NotificationType,
  TableStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { convertDecimalsDeep, toNumber } from "@/lib/decimal";
import { getNextOrderStatuses } from "@/lib/order-transitions";
import {
  completeServedDineInOrder,
  releaseTableIfNoOpenOrders,
  sendCompletedOrderReceipt,
} from "@/lib/order-lifecycle";
import {
  removeIngredientStock,
  restoreIngredientStock,
} from "@/lib/inventory-stock";

function isJsonObject(
  value: Prisma.JsonValue | null | undefined
): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCustomizationId(value: Prisma.JsonValue | undefined) {
  return isJsonObject(value) && typeof value.id === "string"
    ? value.id
    : null;
}

function getCustomizationIds(value: Prisma.JsonValue | undefined) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    isJsonObject(entry) && typeof entry.id === "string" ? [entry.id] : []
  );
}

function getCustomizationName(value: Prisma.JsonValue | undefined) {
  return isJsonObject(value) && typeof value.name === "string"
    ? value.name
    : null;
}

function getCustomizationNames(value: Prisma.JsonValue | undefined) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    isJsonObject(entry) && typeof entry.name === "string" ? [entry.name] : []
  );
}

// ─── Public ──────────────────────────────────────────────────────────────────

/**
 * Creates a new customer order.
 * Input is validated against a strict Zod schema — no `any` types.
 */
export async function createOrder(rawData: CreateOrderInput) {
  // 1. Validate and sanitize input
  const parsed = createOrderSchema.safeParse(rawData);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join(", ");
    return { error: `Invalid order data: ${message}` };
  }
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.table.findUnique({ where: { id: data.tableId } });
      if (!table) throw new Error("Table not found.");

      const settings = await tx.settings.findUnique({ where: { id: "singleton" } });
      if (!settings) throw new Error("Restaurant settings not initialized.");

      const itemIds = data.items.map((i) => i.menuItemId);
      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: itemIds }, isAvailable: true },
        include: { variants: true, addons: true },
      });

      let subtotal = 0;
      const verifiedItems = data.items.map((cartItem) => {
        const menuItem = menuItems.find((m) => m.id === cartItem.menuItemId);
        if (!menuItem) throw new Error(`Menu item not found or unavailable.`);

        let itemPrice = toNumber(menuItem.discountPrice) || toNumber(menuItem.price);

        if (cartItem.customizations?.variant) {
          const v = menuItem.variants.find(
            (x) => x.id === cartItem.customizations!.variant!.id
          );
          if (v) itemPrice = toNumber(v.price);
        }

        let addonsPrice = 0;
        const addonsDetails: { id: string; name: string; price: number }[] = [];
        if (cartItem.customizations?.addons) {
          for (const addonInput of cartItem.customizations.addons) {
            const add = menuItem.addons.find((a) => a.id === addonInput.id);
            if (add) {
              addonsPrice += toNumber(add.price);
              addonsDetails.push({ id: add.id, name: add.name, price: toNumber(add.price) });
            }
          }
        }

        const totalUnitPrice = itemPrice + addonsPrice;
        subtotal += totalUnitPrice * cartItem.quantity;

        return {
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity: cartItem.quantity,
          price: totalUnitPrice,
          notes: cartItem.notes ?? null,
          customizations: {
            variant: cartItem.customizations?.variant
              ? {
                  id: cartItem.customizations.variant.id,
                  name: cartItem.customizations.variant.name,
                  price: itemPrice,
                }
              : null,
            addons: addonsDetails,
          },
        };
      });

      let discountAmount = 0;
      let offerCodeApplied: string | null = null;
      if (data.couponCode) {
        const offerVal = await validateOffer(data.couponCode, subtotal);
        if (offerVal.isValid && offerVal.discountAmount) {
          discountAmount = offerVal.discountAmount;
          offerCodeApplied = offerVal.offer?.code ?? null;
          if (offerCodeApplied) {
            await tx.offer.update({
              where: { code: offerCodeApplied },
              data: { usageCount: { increment: 1 } },
            });
          }
        }
      }

      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const gstPercentage = toNumber(settings.gstPercentage);
      const serviceChargePercentage = toNumber(settings.serviceChargePercentage);
      const gstAmount =
        Math.round(((taxableAmount * gstPercentage) / 100) * 100) / 100;
      const serviceChargeAmount =
        Math.round(
          ((taxableAmount * serviceChargePercentage) / 100) * 100
        ) / 100;
      const totalAmount =
        Math.round((taxableAmount + gstAmount + serviceChargeAmount) * 100) / 100;

      const isRazorpay = data.paymentMethod === PaymentMethod.RAZORPAY;

      const order = await tx.order.create({
        data: {
          tableId: table.id,
          customerName: data.customerName,
          customerPhone: data.customerPhone ?? "",
          // For Razorpay: keep as CONFIRMED until payment is verified.
          // For Cash: immediate PLACED (customer pays at counter).
          status: isRazorpay ? OrderStatus.CONFIRMED : OrderStatus.PLACED,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: data.paymentMethod as PaymentMethod,
          subtotal,
          discountAmount,
          gstAmount,
          serviceChargeAmount,
          totalAmount,
          offerCode: offerCodeApplied,
          notes: data.notes ?? null,
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

      // For Cash: occupy table and notify immediately.
      // For Razorpay: defer until payment is confirmed in /api/payments/verify.
      if (!isRazorpay) {
        await tx.table.update({
          where: { id: table.id },
          data: { status: TableStatus.OCCUPIED },
        });

        await tx.notification.create({
          data: {
            title: `New Order! Table ${table.number}`,
            message: `${data.customerName} placed an order for ₹${totalAmount}`,
            type: NotificationType.NEW_ORDER,
          },
        });
      }

      let razorpayOrder = null;
      if (isRazorpay) {
        try {
          console.log("[createOrder] Creating Razorpay order:", {
            orderId: order.id,
            amount: totalAmount,
            currency: settings.currency || "INR",
          });

          const rzpOrder = await getRazorpayClient().orders.create({
            amount: Math.round(totalAmount * 100),
            currency: settings.currency || "INR",
            receipt: `rcpt_${order.id.substring(0, 14)}`,
            notes: { orderId: order.id },
            payment: { capture: "automatic" },
          });

          const rzpOrderData = rzpOrder as unknown as { id: string; amount: number; currency: string };
          console.log("[createOrder] Razorpay order created:", rzpOrderData.id);

          razorpayOrder = {
            id: rzpOrderData.id,
            amount: rzpOrderData.amount,
            currency: rzpOrderData.currency,
          };

          await tx.payment.create({
            data: {
              orderId: order.id,
              amount: totalAmount,
              method: PaymentMethod.RAZORPAY,
              transactionId: rzpOrder.id,
              status: PaymentStatus.PENDING,
            },
          });
        } catch (rzpError) {
          console.error("Razorpay order creation failed:", rzpError);
          throw new Error("Failed to initialize payment gateway.");
        }
      } else {
        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: totalAmount,
            method: PaymentMethod.CASH,
            status: PaymentStatus.PENDING,
          },
        });
      }

      return { orderId: order.id, totalAmount, razorpayOrder };
    });

    return { success: true, ...result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    console.error("createOrder error:", error);
    return { error: message };
  }
}

/**
 * Cancels an unpaid Razorpay order when the customer dismisses the payment modal.
 * Only affects orders still in CONFIRMED status with PENDING payment.
 */
export async function cancelUnpaidOrder(orderId: string, tableId: string) {
  if (!orderId || typeof orderId !== "string") return;
  if (!tableId || typeof tableId !== "string") return;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, paymentStatus: true, tableId: true },
      });

      if (!order) return;
      if (order.tableId !== tableId) return;
      if (order.status !== OrderStatus.CONFIRMED) return;
      if (order.paymentStatus !== PaymentStatus.PENDING) return;

      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.payment.deleteMany({ where: { orderId } });
      await tx.order.delete({ where: { id: orderId } });
    });
  } catch (error: unknown) {
    console.error("cancelUnpaidOrder error:", error);
  }
}

/**
 * Fetches a customer-facing order by ID.
 * This is a public action — no authentication required by design (customers need
 * to track their own order after paying). No sensitive staff data is exposed.
 */
export async function getCustomerOrder(id: string) {
  if (!id || typeof id !== "string") return null;
  const user = await getCurrentUser();
  if (
    user &&
    [
      Role.CASHIER,
      Role.SERVICE_STAFF,
      Role.CHEF_KITCHEN_STAFF,
    ].some((restrictedRole) => restrictedRole === user.role)
  ) {
    return null;
  }
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        customerName: true,
        subtotal: true,
        discountAmount: true,
        gstAmount: true,
        serviceChargeAmount: true,
        totalAmount: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        table: { select: { number: true } },
        orderItems: {
          select: {
            id: true,
            quantity: true,
            price: true,
            notes: true,
            customizations: true,
            menuItem: { select: { id: true, name: true, images: true } },
          },
        },
        payments: {
          select: { id: true, status: true, method: true, amount: true, createdAt: true },
        },
        invoices: {
          select: { id: true, invoiceNumber: true, amount: true, createdAt: true },
        },
      },
    });
    return convertDecimalsDeep(order);
  } catch {
    return null;
  }
}

/**
 * Creates a waiter-call or bill-request notification.
 * Public action — no auth required (customer-facing). Table existence is
 * validated from the database, not from user input.
 */
export async function requestService(
  tableId: string,
  type: "CALL_WAITER" | "REQUEST_BILL"
) {
  if (!tableId || typeof tableId !== "string") return { error: "Invalid table." };

  try {
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) throw new Error("Table not found.");

    const notificationType =
      type === "CALL_WAITER"
        ? NotificationType.CALL_WAITER
        : NotificationType.REQUEST_BILL;

    await prisma.notification.create({
      data: {
        title: type === "CALL_WAITER" ? "Waiter Requested!" : "Bill Requested!",
        message:
          type === "CALL_WAITER"
            ? `Table ${table.number} has called the waiter.`
            : `Table ${table.number} has requested their final bill.`,
        type: notificationType,
      },
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Service request failed.";
    return { error: message };
  }
}

/**
 * Submits a post-meal review.
 * Public action — no auth required (customer-facing).
 * Input is sanitized — customerName is trimmed, rating is clamped.
 */
export async function submitReview(data: {
  orderId?: string;
  menuItemId?: string;
  customerName: string;
  rating: number;
  comment?: string;
  images?: string[];
}) {
  const customerName = String(data.customerName ?? "").trim().slice(0, 100);
  const rating = Math.max(1, Math.min(5, Math.round(Number(data.rating))));
  const comment = data.comment ? String(data.comment).slice(0, 2000) : null;

  try {
    const review = await prisma.review.create({
      data: {
        orderId: data.orderId ?? null,
        menuItemId: data.menuItemId ?? null,
        customerName,
        rating,
        comment,
        images: data.images ?? [],
      },
    });
    return { success: true, review };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit review.";
    return { error: message };
  }
}

// ─── Staff (authenticated) ────────────────────────────────────────────────────

export async function getOrders() {
  const user = await requireOrdersViewer();
  if (!user) return [];

  try {
    const orders = await prisma.order.findMany({
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
        payments: true,
        invoices: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return convertDecimalsDeep(orders);
  } catch {
    return [];
  }
}

export async function getKitchenOrders() {
  const user = await getCurrentUser();
  if (!user || !canAccessKitchen(user.role)) return [];

  try {
    const orders = await prisma.order.findMany({
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
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        notes: true,
        createdAt: true,
        table: { select: { number: true } },
        orderItems: {
          select: {
            id: true,
            quantity: true,
            notes: true,
            customizations: true,
            menuItem: {
              select: {
                id: true,
                name: true,
                recipeItems: {
                  select: { variantId: true, addonId: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return orders.map((order) => {
      const orderItems = order.orderItems.map((item) => {
        const customizations = isJsonObject(item.customizations)
          ? item.customizations
          : null;
        const variant = customizations?.variant;
        const variantId = getCustomizationId(variant);
        const itemRecipes = item.menuItem.recipeItems;
        const variantRecipes = itemRecipes.filter(
          (recipe) => recipe.variantId === variantId && recipe.addonId === null
        );
        const hasBaseRecipe = itemRecipes.some(
          (recipe) => recipe.variantId === null && recipe.addonId === null
        );
        const hasRecipe = variantRecipes.length > 0 || hasBaseRecipe;

        return {
          id: item.id,
          quantity: item.quantity,
          notes: item.notes,
          menuItem: { id: item.menuItem.id, name: item.menuItem.name },
          variantName: getCustomizationName(variant),
          addonNames: getCustomizationNames(customizations?.addons),
          missingRecipe: !hasRecipe,
        };
      });

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        status: order.status,
        notes: order.notes,
        createdAt: order.createdAt,
        table: order.table,
        orderItems,
        missingRecipeItems: [
          ...new Set(
            orderItems
              .filter((item) => item.missingRecipe)
              .map((item) => item.menuItem.name)
          ),
        ],
      };
    });
  } catch (error) {
    console.error("getKitchenOrders error:", error);
    return [];
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  if (!Object.values(OrderStatus).includes(status)) {
    return { error: "Invalid order status." };
  }
  if (status === OrderStatus.COMPLETED) {
    return { error: "Eligible dine-in orders are completed automatically after service and payment." };
  }
  const user = await requireOrderStatusAccess(status);
  if (!user) return { error: "Unauthorized" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        select: {
          status: true,
          orderType: true,
          paymentStatus: true,
          tableId: true,
        },
      });
      if (!current) throw new Error("Order not found.");

      const isOwnerOrManager =
        user.role === Role.RESTAURANT_OWNER || user.role === Role.MANAGER;
      if (status === OrderStatus.CANCELLED) {
        if (!isOwnerOrManager) throw new Error("Only the Owner or Manager can cancel an order.");
        if (
          current.status === OrderStatus.COMPLETED ||
          current.status === OrderStatus.CANCELLED
        ) {
          throw new Error("This order can no longer be cancelled.");
        }
        if (current.paymentStatus === PaymentStatus.SUCCESS) {
          throw new Error("This paid order cannot be cancelled as a refund. Process a provider-confirmed refund first.");
        }
      } else {
        const nextStatuses = getNextOrderStatuses(
          current.status,
          current.orderType
        );
        if (!nextStatuses.includes(status)) {
          throw new Error("That order status transition is not allowed.");
        }
        if (
          user.role === Role.CHEF_KITCHEN_STAFF &&
          ![
            OrderStatus.PREPARING,
            OrderStatus.PREPARED,
            OrderStatus.READY,
          ].some((allowedStatus) => allowedStatus === status)
        ) {
          throw new Error("Kitchen staff can only advance preparation statuses.");
        }
        if (
          user.role === Role.SERVICE_STAFF &&
          ![OrderStatus.SERVED, OrderStatus.COLLECTED].some(
            (allowedStatus) => allowedStatus === status
          )
        ) {
          throw new Error("Service staff can only complete a ready-order handover.");
        }
      }

      const requirementByIngredient = new Map<string, number>();
      if (status === OrderStatus.READY) {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: id },
          select: {
            menuItemId: true,
            quantity: true,
            customizations: true,
            menuItem: { select: { name: true } },
          },
        });
        const recipes = await tx.recipeIngredient.findMany({
          where: {
            menuItemId: { in: orderItems.map((item) => item.menuItemId) },
          },
        });
        const missingRecipes: string[] = [];
        for (const item of orderItems) {
          const customizations = isJsonObject(item.customizations)
            ? item.customizations
            : null;
          const variantId = getCustomizationId(customizations?.variant);
          const addonIds = getCustomizationIds(customizations?.addons);
          const itemRecipes = recipes.filter(
            (recipe) => recipe.menuItemId === item.menuItemId
          );
          const variantRecipes = itemRecipes.filter(
            (recipe) =>
              recipe.variantId === variantId &&
              recipe.addonId === null &&
              variantId !== null
          );
          const baseRecipes = itemRecipes.filter(
            (recipe) => recipe.variantId === null && recipe.addonId === null
          );
          const selectedRecipes = variantRecipes.length
            ? variantRecipes
            : baseRecipes;
          const addonRecipes = itemRecipes.filter(
            (recipe) =>
              recipe.variantId === null &&
              recipe.addonId !== null &&
              addonIds.includes(recipe.addonId)
          );

          if (selectedRecipes.length === 0) {
            missingRecipes.push(item.menuItem.name);
          }
          for (const recipe of [...selectedRecipes, ...addonRecipes]) {
            requirementByIngredient.set(
              recipe.ingredientId,
              (requirementByIngredient.get(recipe.ingredientId) ?? 0) +
                Number(recipe.quantity) * item.quantity
            );
          }
        }
        if (missingRecipes.length > 0) {
          throw new Error(
            `Cannot mark Ready. Add a saved recipe for: ${[...new Set(missingRecipes)].join(", ")}.`
          );
        }
      }

      const updateResult = await tx.order.updateMany({
        where: {
          id,
          status: current.status,
          ...(status === OrderStatus.CANCELLED
            ? { paymentStatus: current.paymentStatus }
            : {}),
        },
        data: {
          status,
          ...(status === OrderStatus.SERVED && { servedAt: new Date() }),
          ...(status === OrderStatus.COLLECTED && { collectedAt: new Date() }),
        },
      });
      if (updateResult.count !== 1) {
        throw new Error("The order changed before this update was applied. Refresh and retry.");
      }

      const order = await tx.order.findUnique({
        where: { id },
        include: { table: true },
      });
      if (!order) throw new Error("Order not found.");

      if (status === OrderStatus.READY) {
        const existingConsumptions = await tx.stockMovement.findMany({
          where: {
            referenceType: "Order",
            referenceId: id,
            type: "ORDER_CONSUMPTION",
          },
          select: { ingredientId: true },
        });
        const alreadyConsumed = new Set(
          existingConsumptions.map((movement) => movement.ingredientId)
        );
        for (const [ingredientId, quantity] of requirementByIngredient) {
          if (alreadyConsumed.has(ingredientId)) continue;
          const { allocations } = await removeIngredientStock(tx, {
            ingredientId,
            quantity,
          });
          for (const allocation of allocations) {
            await tx.stockMovement.create({
              data: {
                ingredientId,
                batchId: allocation.batchId,
                type: "ORDER_CONSUMPTION",
                quantity: -allocation.quantity,
                reason: `Ingredients used for order ${order.orderNumber ?? order.id}`,
                referenceType: "Order",
                referenceId: id,
                idempotencyKey: `order-consumption:${id}:${ingredientId}:${allocation.batchId}`,
                actorId: user.id,
              },
            });
          }
        }
      }

      if (status === OrderStatus.CANCELLED) {
        const consumedMovements = await tx.stockMovement.findMany({
          where: {
            referenceType: "Order",
            referenceId: id,
            type: "ORDER_CONSUMPTION",
          },
          select: {
            id: true,
            ingredientId: true,
            quantity: true,
            batchId: true,
          },
        });
        const movementsByIngredient = new Map<
          string,
          typeof consumedMovements
        >();
        for (const movement of consumedMovements) {
          const group = movementsByIngredient.get(movement.ingredientId) ?? [];
          group.push(movement);
          movementsByIngredient.set(movement.ingredientId, group);
        }
        for (const [ingredientId, movements] of movementsByIngredient) {
          const idempotencyKey = `order-reversal:${id}:${ingredientId}`;
          const alreadyReversed = await tx.stockMovement.findUnique({
            where: { idempotencyKey },
            select: { id: true },
          });
          if (alreadyReversed) continue;
          let quantity = 0;
          for (const movement of movements) {
            const restored = Math.abs(Number(movement.quantity));
            quantity += restored;
            await restoreIngredientStock(tx, {
              ingredientId,
              quantity: restored,
              batchId: movement.batchId,
              reason: `Cancelled order ${order.orderNumber ?? order.id}`,
            });
          }
          await tx.stockMovement.create({
            data: {
              ingredientId,
              type: "REVERSAL",
              quantity,
              reason: `Stock restored for cancelled order ${order.orderNumber ?? order.id}`,
              referenceType: "Order",
              referenceId: id,
              idempotencyKey,
              actorId: user.id,
            },
          });
        }
      }

      if (status === OrderStatus.READY) {
        const orderLabel = order.table
          ? `Table ${order.table.number}`
          : `Takeaway #${order.orderNumber ?? order.id.slice(-8).toUpperCase()}`;
        await tx.notification.create({
          data: {
            title: `Order Ready! ${orderLabel}`,
            message: `Order for ${order.customerName} is prepared and ready to serve.`,
            type: NotificationType.KITCHEN_READY,
          },
        });
      } else if (status === OrderStatus.CANCELLED) {
        await tx.payment.updateMany({
          where: { orderId: id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED },
        });
        await tx.order.update({
          where: { id },
          data: { paymentStatus: PaymentStatus.FAILED },
        });
        if (order.tableId) {
          await releaseTableIfNoOpenOrders(tx, order.tableId);
        }
      }

      const receipt =
        status === OrderStatus.SERVED
          ? await completeServedDineInOrder(tx, id)
          : null;

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "ORDER_STATUS_UPDATED",
          entityType: "Order",
          entityId: id,
          details: { previousStatus: current.status, status },
        },
      });

      const finalOrder = receipt
        ? await tx.order.findUnique({
            where: { id },
            include: { table: true },
          })
        : order;
      return { order: finalOrder, receipt };
    });

    await sendCompletedOrderReceipt(result.receipt);
    revalidatePath("/inventory");
    revalidatePath("/manager");
    revalidatePath("/dashboard/orders");
    revalidatePath("/service");
    revalidatePath("/cashier");
    return {
      success: true,
      order: result.order,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return { error: message };
  }
}

export async function updateOrderPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus
) {
  const user = await requireCashier();
  if (!user) return { error: "Unauthorized" };
  if (paymentStatus !== PaymentStatus.SUCCESS) {
    return {
      error: "Manual payment updates may only confirm a received cash payment. Refunds and online payment status must be provider-verified.",
    };
  }

  try {
    const receipt = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: { paymentMethod: true, paymentStatus: true },
      });
      if (!order) throw new Error("Order not found.");
      if (order.paymentMethod === PaymentMethod.RAZORPAY) {
        throw new Error("Online Razorpay payments must be provider-verified.");
      }
      if (order.paymentStatus === PaymentStatus.SUCCESS) {
        return completeServedDineInOrder(tx, id);
      }
      if (order.paymentStatus !== PaymentStatus.PENDING) {
        throw new Error("This payment cannot be confirmed from its current status.");
      }

      const register = await tx.cashRegisterSession.findFirst({
        where: { cashierId: user.id, closedAt: null },
        orderBy: { openedAt: "desc" },
        select: { id: true },
      });
      if (!register) {
        throw new Error("Open your cash register before confirming a collected payment.");
      }

      const pendingPayments = await tx.payment.findMany({
        where: {
          orderId: id,
          status: PaymentStatus.PENDING,
          method: order.paymentMethod,
        },
        select: { id: true },
      });
      if (pendingPayments.length === 0) {
        throw new Error("No matching pending payment record was found.");
      }

      const updated = await tx.order.updateMany({
        where: { id, paymentStatus: PaymentStatus.PENDING },
        data: { paymentStatus },
      });
      if (updated.count !== 1) {
        throw new Error("The payment status changed before confirmation. Refresh and retry.");
      }
      await tx.payment.updateMany({
        where: {
          orderId: id,
          status: PaymentStatus.PENDING,
          method: order.paymentMethod,
        },
        data: {
          status: paymentStatus,
          cashRegisterSessionId: register.id,
        },
      });
      await tx.notification.create({
        data: {
          title: "Payment Updated",
          message: `Order payment status changed to ${paymentStatus}.`,
          type: NotificationType.PAYMENT,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "OFFLINE_PAYMENT_CONFIRMED",
          entityType: "Order",
          entityId: id,
          details: { method: order.paymentMethod },
        },
      });
      return completeServedDineInOrder(tx, id);
    });

    await sendCompletedOrderReceipt(receipt);
    revalidatePath("/dashboard/orders");
    revalidatePath("/service");
    revalidatePath("/cashier");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return { error: message };
  }
}
