import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { PaymentStatus, OrderStatus, TableStatus, NotificationType } from "@prisma/client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { toNumber } from "@/lib/decimal";
import { getRazorpayClient } from "@/lib/razorpay";
import {
  completeServedDineInOrder,
  sendCompletedOrderReceipt,
} from "@/lib/order-lifecycle";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log("[verify] Payment verification started");

  // Rate limit: 10 requests per minute per IP
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`verify:${ip}`, 10, 60_000);
  if (!allowed) {
    console.warn(`[verify] Rate limited IP: ${ip}`);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { ...NO_CACHE_HEADERS, "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.warn("[verify] Missing parameters:", {
        hasOrderId: !!razorpay_order_id,
        hasPaymentId: !!razorpay_payment_id,
        hasSignature: !!razorpay_signature,
      });
      return NextResponse.json(
        { error: "Missing required verification parameters." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    console.log("[verify] Verifying payment:", {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("[verify] RAZORPAY_KEY_SECRET is not configured.");
      return NextResponse.json(
        { error: "Payment verification is not configured." },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // Verify Razorpay HMAC signature
    const hash = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const hashBuf = Buffer.from(hash, "utf8");
    const sigBuf = Buffer.from(razorpay_signature, "utf8");
    const signatureValid = hashBuf.length === sigBuf.length && crypto.timingSafeEqual(hashBuf, sigBuf);

    if (!signatureValid) {
      console.warn("[verify] Signature mismatch!", {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
      return NextResponse.json(
        { error: "Payment verification failed. Invalid signature." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const verifiedPayment =
      await getRazorpayClient().payments.fetch(razorpay_payment_id);
    if (
      verifiedPayment.order_id !== razorpay_order_id ||
      verifiedPayment.status !== "captured"
    ) {
      return NextResponse.json(
        { error: "Payment has not been captured yet." },
        { status: 409, headers: NO_CACHE_HEADERS }
      );
    }

    console.log("[verify] Signature verified successfully");

    // Transactionally update Payment, Order, table, and notification
    const receipt = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { transactionId: razorpay_order_id },
      });

      if (!payment) {
        console.error("[verify] Payment record not found for orderId:", razorpay_order_id);
        throw new Error("Local payment record not found.");
      }

      // Idempotent: if already SUCCESS, skip all updates
      if (payment.status === PaymentStatus.SUCCESS) {
        console.log("[verify] Payment already verified (idempotent), skipping");
        return completeServedDineInOrder(tx, payment.orderId);
      }

      console.log("[verify] Updating payment record:", {
        paymentId: payment.id,
        currentStatus: payment.status,
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          status: PaymentStatus.SUCCESS,
        },
      });

      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
        select: {
          id: true,
          status: true,
          orderType: true,
          customerName: true,
          orderNumber: true,
          totalAmount: true,
          tableId: true,
          table: { select: { number: true } },
        },
      });

      if (!order) throw new Error("Order not found.");

      console.log("[verify] Current order status:", {
        orderId: order.id,
        status: order.status,
      });

      // Finalize: CONFIRMED → PLACED, occupy table, notify kitchen
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

        console.log("[verify] Order confirmed → PLACED, table occupied, kitchen notified");
      } else {
        // Order already processed (webhook arrived first) — just update payment status
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: PaymentStatus.SUCCESS },
        });
        console.log("[verify] Order already in status", order.status, "— updated payment status only");
      }
      return completeServedDineInOrder(tx, payment.orderId);
    });
    await sendCompletedOrderReceipt(receipt);

    const elapsed = Date.now() - startTime;
    console.log(`[verify] Payment verification completed in ${elapsed}ms`);

    return NextResponse.json(
      { success: true, message: "Payment verified successfully." },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    console.error(`[verify] Exception after ${elapsed}ms:`, error);
    return NextResponse.json(
      { error: "Payment verification failed. Please try again." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
