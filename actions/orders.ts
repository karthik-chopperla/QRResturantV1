"use server";

import prisma from "@/lib/prisma";
import { getRazorpayClient } from "@/lib/razorpay";
import { resend } from "@/lib/resend";
import { getCurrentUser } from "./auth";
import { requireAdmin, requireStaff } from "@/lib/roles";
import { validateOffer } from "./offers";
import { createOrderSchema, type CreateOrderInput } from "@/schemas";
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  NotificationType,
  TableStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { toNumber } from "@/lib/decimal";

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
  try {
    return prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
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
  const user = await requireStaff();
  if (!user) return [];

  try {
    return prisma.order.findMany({
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
        payments: true,
        invoices: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const user = await requireStaff();
  if (!user) return { error: "Unauthorized" };

  try {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: { status },
        include: { table: true },
      });

      if (status === OrderStatus.READY) {
        await tx.notification.create({
          data: {
            title: `Order Ready! Table ${order.table.number}`,
            message: `Order for ${order.customerName} is prepared and ready to serve.`,
            type: NotificationType.KITCHEN_READY,
          },
        });
      } else if (status === OrderStatus.COMPLETED) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });

        const invoiceCount = await tx.invoice.count();
        const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;

        await tx.invoice.create({
          data: {
            orderId: order.id,
            invoiceNumber,
            amount: order.totalAmount,
            taxAmount: order.gstAmount,
            discountAmount: order.discountAmount,
          },
        });

        if (order.paymentMethod === PaymentMethod.CASH) {
          await tx.order.update({
            where: { id },
            data: { paymentStatus: PaymentStatus.SUCCESS },
          });
          await tx.payment.updateMany({
            where: { orderId: id, method: PaymentMethod.CASH },
            data: { status: PaymentStatus.SUCCESS },
          });
        }

        // Send email receipt only if Resend is configured and a valid email exists
        if (resend) {
          const customerEmail = order.customerName.includes("@")
            ? order.customerName // legacy: email stored in customerName field
            : null;

          // In production, you should store customerEmail in its own column.
          // Until then we only send if the name looks like an email.
          if (customerEmail) {
            try {
              await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || "receipts@resend.dev",
                to: customerEmail,
                subject: `Invoice ${invoiceNumber} | QRFast`,
                html: `<p>Dear Customer,</p><p>Thank you for dining with us! Here is your bill summary:</p><ul><li>Invoice: ${invoiceNumber}</li><li>Subtotal: ₹${toNumber(order.subtotal)}</li><li>Discount: ₹${toNumber(order.discountAmount)}</li><li>GST: ₹${toNumber(order.gstAmount)}</li><li>Service Charge: ₹${toNumber(order.serviceChargeAmount)}</li><li><strong>Grand Total: ₹${toNumber(order.totalAmount)}</strong></li></ul><p>We hope to see you again soon!</p>`,
              });
            } catch (resendError) {
              console.error("Email send failed:", resendError);
              // Non-fatal — order is still completed
            }
          }
        }
      } else if (status === OrderStatus.CANCELLED) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });

        if (order.paymentStatus === PaymentStatus.SUCCESS) {
          await tx.payment.updateMany({
            where: { orderId: id },
            data: { status: PaymentStatus.REFUNDED },
          });
          await tx.order.update({
            where: { id },
            data: { paymentStatus: PaymentStatus.REFUNDED },
          });
        } else {
          await tx.payment.updateMany({
            where: { orderId: id },
            data: { status: PaymentStatus.FAILED },
          });
          await tx.order.update({
            where: { id },
            data: { paymentStatus: PaymentStatus.FAILED },
          });
        }
      }

      return order;
    });

    revalidatePath("/dashboard/orders");
    return { success: true, order: updatedOrder };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return { error: message };
  }
}

export async function updateOrderPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus
) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { paymentStatus } });
      await tx.payment.updateMany({ where: { orderId: id }, data: { status: paymentStatus } });
      await tx.notification.create({
        data: {
          title: "Payment Updated",
          message: `Order payment status changed to ${paymentStatus}.`,
          type: NotificationType.PAYMENT,
        },
      });
    });

    revalidatePath("/dashboard/orders");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return { error: message };
  }
}
