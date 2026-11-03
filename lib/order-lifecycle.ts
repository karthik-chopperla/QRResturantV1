import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  TableStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { resend } from "@/lib/resend";
import { toNumber } from "@/lib/decimal";

type Transaction = Prisma.TransactionClient;

export type CompletedOrderReceipt = {
  id: string;
  orderNumber: string | null;
  customerName: string;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  gstAmount: Prisma.Decimal;
  serviceChargeAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};

async function lockTable(tx: Transaction, tableId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Table" WHERE "id" = ${tableId} FOR UPDATE
  `;
  if (rows.length === 0) throw new Error("The order table no longer exists.");
}

export async function releaseTableIfNoOpenOrders(
  tx: Transaction,
  tableId: string
) {
  await lockTable(tx, tableId);
  const openOrders = await tx.order.count({
    where: {
      tableId,
      status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
    },
  });
  if (openOrders === 0) {
    await tx.table.updateMany({
      where: { id: tableId, status: { not: TableStatus.RESERVED } },
      data: { status: TableStatus.AVAILABLE },
    });
  }
}

export async function completeServedDineInOrder(
  tx: Transaction,
  orderId: string
): Promise<CompletedOrderReceipt | null> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      orderType: true,
      status: true,
      paymentStatus: true,
      tableId: true,
      subtotal: true,
      serviceChargeAmount: true,
      totalAmount: true,
      gstAmount: true,
      discountAmount: true,
    },
  });
  if (
    !order ||
    order.orderType !== OrderType.DINE_IN ||
    order.status !== OrderStatus.SERVED ||
    order.paymentStatus !== PaymentStatus.SUCCESS
  ) {
    return null;
  }
  if (!order.tableId) {
    throw new Error("A served dine-in order must have an associated table.");
  }

  await lockTable(tx, order.tableId);
  const updated = await tx.order.updateMany({
    where: {
      id: order.id,
      orderType: OrderType.DINE_IN,
      status: OrderStatus.SERVED,
      paymentStatus: PaymentStatus.SUCCESS,
      tableId: order.tableId,
    },
    data: { status: OrderStatus.COMPLETED },
  });
  if (updated.count !== 1) return null;

  await tx.invoice.upsert({
    where: { orderId: order.id },
    update: {},
    create: {
      orderId: order.id,
      invoiceNumber: `INV-${order.orderNumber ?? order.id}`,
      amount: order.totalAmount,
      taxAmount: order.gstAmount,
      discountAmount: order.discountAmount,
    },
  });

  const otherOpenOrders = await tx.order.count({
    where: {
      tableId: order.tableId,
      id: { not: order.id },
      status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
    },
  });
  if (otherOpenOrders === 0) {
    await tx.table.updateMany({
      where: { id: order.tableId, status: { not: TableStatus.RESERVED } },
      data: { status: TableStatus.AVAILABLE },
    });
  }
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    gstAmount: order.gstAmount,
    serviceChargeAmount: order.serviceChargeAmount,
    totalAmount: order.totalAmount,
  };
}

export async function sendCompletedOrderReceipt(
  order: CompletedOrderReceipt | null
) {
  if (!order || !resend) return;
  const customerEmail = order.customerName.includes("@")
    ? order.customerName
    : null;
  if (!customerEmail) return;

  const invoiceNumber = `INV-${order.orderNumber ?? order.id}`;
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "receipts@resend.dev",
      to: customerEmail,
      subject: `Invoice ${invoiceNumber} | QRFast`,
      html: `<p>Dear Customer,</p><p>Thank you for dining with us! Here is your bill summary:</p><ul><li>Invoice: ${invoiceNumber}</li><li>Subtotal: ₹${toNumber(order.subtotal)}</li><li>Discount: ₹${toNumber(order.discountAmount)}</li><li>GST: ₹${toNumber(order.gstAmount)}</li><li>Service Charge: ₹${toNumber(order.serviceChargeAmount)}</li><li><strong>Grand Total: ₹${toNumber(order.totalAmount)}</strong></li></ul><p>We hope to see you again soon!</p>`,
    });
  } catch (error) {
    console.error("Email send failed:", error);
  }
}
