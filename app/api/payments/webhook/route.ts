import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { PaymentStatus, OrderStatus, TableStatus, NotificationType } from "@prisma/client";
import { toNumber } from "@/lib/decimal";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      console.warn("[webhook] Missing signature header");
      return NextResponse.json(
        { error: "Webhook signature header missing." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[webhook] RAZORPAY_WEBHOOK_SECRET is not configured.");
      return NextResponse.json(
        { error: "Webhook endpoint is not configured." },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // Verify webhook HMAC signature against the raw request body
    const hash = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const hashBuf = Buffer.from(hash, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    const signatureValid = hashBuf.length === sigBuf.length && crypto.timingSafeEqual(hashBuf, sigBuf);

    if (!signatureValid) {
      console.warn("[webhook] Signature mismatch!");
      return NextResponse.json(
        { error: "Webhook verification failed." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const payload = JSON.parse(rawBody);
    const event: string = payload.event;
    console.log("[webhook] Received event:", event);

    // Handle payment success events
    if (event === "payment.captured" || event === "payment.authorized") {
      const paymentEntity = payload.payload?.payment?.entity;
      if (!paymentEntity) {
        console.log("[webhook] No payment entity in payload, ignoring");
        return NextResponse.json({ status: "ignored" }, { headers: NO_CACHE_HEADERS });
      }

      const razorpayOrderId: string = paymentEntity.order_id;
      const razorpayPaymentId: string = paymentEntity.id;
      const paymentStatus: string = paymentEntity.status;

      console.log("[webhook] Payment event:", {
        razorpayOrderId,
        razorpayPaymentId,
        razorpayStatus: paymentStatus,
        event,
      });

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { transactionId: razorpayOrderId },
          include: { order: { select: { id: true, status: true, orderType: true, orderNumber: true, customerName: true, totalAmount: true, tableId: true, table: { select: { number: true } } } } },
        });

        if (!payment) {
          console.warn("[webhook] Payment record not found for orderId:", razorpayOrderId);
          return;
        }

        // Idempotent: if already SUCCESS, skip
        if (payment.status === PaymentStatus.SUCCESS) {
          console.log("[webhook] Payment already SUCCESS (idempotent), skipping");
          return;
        }

        // Update payment record
        await tx.payment.update({
          where: { id: payment.id },
          data: { paymentId: razorpayPaymentId, status: PaymentStatus.SUCCESS },
        });

        console.log("[webhook] Payment updated to SUCCESS:", payment.id);

        // If order is still CONFIRMED (verify endpoint hasn't run yet), transition it
        if (payment.order.status === OrderStatus.CONFIRMED) {
          if (
            payment.order.orderType === "DINE_IN" &&
            (!payment.order.tableId || !payment.order.table)
          ) {
            throw new Error("Dine-in order is missing its table.");
          }

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              paymentStatus: PaymentStatus.SUCCESS,
              status: OrderStatus.PLACED,
            },
          });

          if (payment.order.tableId) {
            await tx.table.update({
              where: { id: payment.order.tableId },
              data: { status: TableStatus.OCCUPIED },
            });
          }

          const orderLabel = payment.order.table
            ? `Table ${payment.order.table.number}`
            : `Takeaway #${payment.order.orderNumber ?? payment.order.id.slice(-8).toUpperCase()}`;
          await tx.notification.create({
            data: {
              title: `New Order! ${orderLabel}`,
              message: `${payment.order.customerName} placed an order for ₹${toNumber(payment.order.totalAmount)}`,
              type: NotificationType.NEW_ORDER,
            },
          });

          console.log("[webhook] Order confirmed → PLACED via webhook (verify didn't run yet)");
        } else {
          // Verify endpoint already handled order status
          await tx.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus: PaymentStatus.SUCCESS },
          });
          console.log("[webhook] Order already in status", payment.order.status, "— updated payment status only");
        }
      });
    }
    // Handle payment failure events
    else if (event === "payment.failed") {
      const paymentEntity = payload.payload?.payment?.entity;
      if (!paymentEntity) {
        return NextResponse.json({ status: "ignored" }, { headers: NO_CACHE_HEADERS });
      }

      const razorpayOrderId: string = paymentEntity.order_id;
      console.log("[webhook] Payment failed for orderId:", razorpayOrderId);

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { transactionId: razorpayOrderId },
        });

        if (payment && payment.status !== PaymentStatus.SUCCESS) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED },
          });
          await tx.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus: PaymentStatus.FAILED },
          });
          console.log("[webhook] Payment and order marked as FAILED");
        }
      });
    }
    // Handle order paid event (Razorpay sends this after all payments for an order succeed)
    else if (event === "order.paid") {
      const orderEntity = payload.payload?.order?.entity;
      if (!orderEntity) {
        return NextResponse.json({ status: "ignored" }, { headers: NO_CACHE_HEADERS });
      }

      const razorpayOrderId: string = orderEntity.id;
      console.log("[webhook] order.paid for orderId:", razorpayOrderId);

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { transactionId: razorpayOrderId },
        });

        if (payment && payment.status !== PaymentStatus.SUCCESS) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.SUCCESS },
          });

          const order = await tx.order.findUnique({
            where: { id: payment.orderId },
            select: { id: true, status: true, orderType: true, orderNumber: true, customerName: true, totalAmount: true, tableId: true, table: { select: { number: true } } },
          });

          if (order) {
            if (order.status === OrderStatus.CONFIRMED) {
              if (order.orderType === "DINE_IN" && (!order.tableId || !order.table)) {
                throw new Error("Dine-in order is missing its table.");
              }

              await tx.order.update({
                where: { id: order.id },
                data: {
                  paymentStatus: PaymentStatus.SUCCESS,
                  status: OrderStatus.PLACED,
                },
              });
              if (order.tableId) {
                await tx.table.update({
                  where: { id: order.tableId },
                  data: { status: TableStatus.OCCUPIED },
                });
              }
              const orderLabel = order.table
                ? `Table ${order.table.number}`
                : `Takeaway #${order.orderNumber ?? order.id.slice(-8).toUpperCase()}`;
              await tx.notification.create({
                data: {
                  title: `New Order! ${orderLabel}`,
                  message: `${order.customerName} placed an order for ₹${toNumber(order.totalAmount)}`,
                  type: NotificationType.NEW_ORDER,
                },
              });
              console.log("[webhook] order.paid: Order confirmed → PLACED");
            } else {
              await tx.order.update({
                where: { id: order.id },
                data: { paymentStatus: PaymentStatus.SUCCESS },
              });
            }
          }
        }
      });
    } else {
      console.log("[webhook] Unhandled event:", event);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[webhook] Processed in ${elapsed}ms`);

    return NextResponse.json(
      { status: "success" },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    console.error(`[webhook] Exception after ${elapsed}ms:`, error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
