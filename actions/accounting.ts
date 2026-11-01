"use server";

import prisma from "@/lib/prisma";
import { getRazorpayClient } from "@/lib/razorpay";
import { requireAccountingAccess } from "@/lib/roles";
import { PaymentMethod, PaymentStatus, RefundStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { convertDecimalsDeep, toNumber } from "@/lib/decimal";

const expenseSchema = z.object({
  description: z.string().trim().min(1).max(200),
  category: z.enum([
    "RENT",
    "ELECTRICITY",
    "WATER",
    "SALARIES",
    "MAINTENANCE",
    "MARKETING",
    "TRANSPORTATION",
    "SUPPLIES",
    "OTHER",
  ]),
  amount: z.number().finite().positive(),
  incurredAt: z.string().datetime(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function getAccountingData(from?: string, to?: string) {
  const user = await requireAccountingAccess();
  if (!user) return { error: "Unauthorized" as const };

  const start = from
    ? new Date(from)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = to ? new Date(to) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Invalid reporting date range." as const };
  }
  end.setHours(23, 59, 59, 999);

  const [payments, refunds, expenses, supplierPayments, paidOrders, transactions] =
    await Promise.all([
      prisma.payment.groupBy({
        by: ["method"],
        where: {
          status: PaymentStatus.SUCCESS,
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.refund.aggregate({
        where: {
          status: RefundStatus.SUCCEEDED,
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { incurredAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.supplierPayment.aggregate({
        where: { paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.SUCCESS,
          createdAt: { gte: start, lte: end },
        },
        _sum: { gstAmount: true, serviceChargeAmount: true },
      }),
      prisma.payment.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              orderType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

  const collections = Object.fromEntries(
    payments.map((payment) => [payment.method, toNumber(payment._sum.amount)])
  );
  const grossCollected = Object.values(collections).reduce(
    (total, amount) => total + amount,
    0
  );
  const refundTotal = toNumber(refunds._sum.amount);
  const netRevenue = grossCollected - refundTotal;
  const expenseTotal = toNumber(expenses._sum.amount);
  const supplierPaymentTotal = toNumber(supplierPayments._sum.amount);
  const expenseRows = await prisma.expense.findMany({
    where: { incurredAt: { gte: start, lte: end } },
    orderBy: { incurredAt: "desc" },
    take: 100,
  });

  return convertDecimalsDeep({
    summary: {
      grossCollected,
      refundTotal,
      netRevenue,
      expenseTotal,
      supplierPaymentTotal,
      estimatedNet: netRevenue - expenseTotal - supplierPaymentTotal,
      gstCollected: toNumber(paidOrders._sum.gstAmount),
      serviceCharges: toNumber(paidOrders._sum.serviceChargeAmount),
      collections,
    },
    transactions,
    expenses: expenseRows,
  });
}

export async function recordExpense(input: unknown) {
  const user = await requireAccountingAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  const expense = await prisma.expense.create({
    data: {
      ...parsed.data,
      incurredAt: new Date(parsed.data.incurredAt),
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || null,
      createdById: user.id,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: "EXPENSE_RECORDED",
      entityType: "Expense",
      entityId: expense.id,
      details: { amount: expense.amount.toString(), category: expense.category },
    },
  });
  revalidatePath("/accountant");
  return { success: true as const };
}

export async function exportAccountingCsv(from?: string, to?: string) {
  const user = await requireAccountingAccess();
  if (!user) return { error: "Unauthorized" as const };
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = to ? new Date(to) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Invalid reporting date range." as const };
  }
  end.setHours(23, 59, 59, 999);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { order: { select: { orderNumber: true, orderType: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.findMany({
      where: { incurredAt: { gte: start, lte: end } },
      orderBy: { incurredAt: "asc" },
    }),
  ]);
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    "Type,Date,Reference,Category or Method,Status,Amount",
    ...payments.map((payment) =>
      [
        "Payment",
        payment.createdAt.toISOString(),
        quote(payment.order.orderNumber ?? payment.orderId),
        payment.method,
        payment.status,
        payment.amount.toString(),
      ].join(",")
    ),
    ...expenses.map((expense) =>
      [
        "Expense",
        expense.incurredAt.toISOString(),
        quote(expense.description),
        expense.category,
        "RECORDED",
        expense.amount.toString(),
      ].join(",")
    ),
  ];
  return { csv: rows.join("\n") };
}

export async function refundRazorpayPayment(input: {
  orderId: string;
  amount: number;
  reason: string;
}) {
  const user = await requireAccountingAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    orderId: z.string().uuid(),
    amount: z.number().finite().positive(),
    reason: z.string().trim().min(1).max(300),
  }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId: parsed.data.orderId, method: PaymentMethod.RAZORPAY },
    orderBy: { createdAt: "desc" },
  });
  if (!payment || !payment.paymentId || payment.status !== PaymentStatus.SUCCESS) {
    return { error: "Only a provider-verified Razorpay payment can be refunded here." as const };
  }

  let refund;
  try {
    refund = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.id})::bigint)`;
      const priorRefunds = await tx.refund.aggregate({
        where: {
          paymentId: payment.id,
          status: { in: [RefundStatus.PROCESSING, RefundStatus.SUCCEEDED] },
        },
        _sum: { amount: true },
      });
      const remaining =
        toNumber(payment.amount) - toNumber(priorRefunds._sum.amount);
      if (parsed.data.amount > remaining) {
        throw new Error(
          `Refund exceeds the remaining refundable amount of ${remaining}.`
        );
      }
      return tx.refund.create({
        data: {
          orderId: parsed.data.orderId,
          paymentId: payment.id,
          amount: parsed.data.amount,
          method: PaymentMethod.RAZORPAY,
          status: RefundStatus.PROCESSING,
          reason: parsed.data.reason,
          requestedById: user.id,
        },
      });
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create refund record.",
    };
  }

  let providerRefund;
  try {
    providerRefund = await getRazorpayClient().payments.refund(
      payment.paymentId,
      {
        amount: Math.round(parsed.data.amount * 100),
        notes: {
          orderId: parsed.data.orderId,
          internalRefundId: refund.id,
          reason: parsed.data.reason,
        },
      }
    );
    if (providerRefund.status !== "processed" && providerRefund.status !== "pending") {
      throw new Error(`Razorpay returned unexpected refund status: ${providerRefund.status}.`);
    }
  } catch (error) {
    console.error("Razorpay refund request failed:", error);
    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: RefundStatus.FAILED },
    });
    return {
      error:
        error instanceof Error
          ? `Razorpay refund failed: ${error.message}`
          : "Razorpay refund failed.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          providerRefundId: providerRefund.id,
          status:
            providerRefund.status === "processed"
              ? RefundStatus.SUCCEEDED
              : RefundStatus.PROCESSING,
        },
      });

      if (providerRefund.status === "processed") {
        const successfulRefunds = await tx.refund.aggregate({
          where: {
            paymentId: payment.id,
            status: RefundStatus.SUCCEEDED,
          },
          _sum: { amount: true },
        });
        if (toNumber(successfulRefunds._sum.amount) >= toNumber(payment.amount)) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.REFUNDED },
          });
          await tx.order.update({
            where: { id: parsed.data.orderId },
            data: { paymentStatus: PaymentStatus.REFUNDED },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "RAZORPAY_REFUND_REQUESTED",
          entityType: "Refund",
          entityId: refund.id,
          details: {
            providerRefundId: providerRefund.id,
            status: providerRefund.status,
            amount: parsed.data.amount,
          },
        },
      });
    });

    revalidatePath("/accountant");
    revalidatePath("/dashboard/orders");
    return {
      success: true as const,
      message:
        providerRefund.status === "processed"
          ? "Razorpay confirmed the refund."
          : "Refund request was accepted and is still processing.",
    };
  } catch (error) {
    console.error("Razorpay refund reconciliation error:", error);
    return {
      error: "Razorpay returned a refund response, but the local record could not be reconciled. The refund remains PROCESSING; check Razorpay before retrying.",
    };
  }
}