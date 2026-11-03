import prisma from "@/lib/prisma";
import { toNumber } from "@/lib/decimal";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export async function generateBillHtml(orderId: string): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
      payments: true,
      invoices: true,
    },
  });

  if (!order) return null;

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });

  const restaurant = settings ?? {
    restaurantName: "DineDesk Restaurant",
    logo: null,
    address: null,
    phone: null,
    email: null,
    gstNumber: null,
    gstPercentage: 5,
    serviceChargePercentage: 0,
    currency: "INR",
      primaryColor: "#DC2626",
  };

  const invoice = order.invoices[0] ?? null;

  const items = order.orderItems.map((item) => {
    const customizations = item.customizations as Record<string, unknown> | null;
    const variant = customizations?.variant as { name: string; price: number } | undefined;
    const addons = (customizations?.addons as { name: string; price: number }[]) ?? [];
    const itemPrice = toNumber(item.price);

    return `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
          <div style="font-weight:500;">${escapeHtml(item.menuItem.name)}${variant ? ` (${escapeHtml(variant.name)})` : ""}</div>
          ${addons.length > 0 ? `<div style="font-size:11px;color:#666;margin-top:2px;">+ ${addons.map((a) => escapeHtml(a.name)).join(", ")}</div>` : ""}
          ${item.notes ? `<div style="font-size:11px;color:#888;margin-top:2px;font-style:italic;">${escapeHtml(item.notes)}</div>` : ""}
        </td>
        <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#666;">${item.quantity}</td>
        <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:500;">${formatCurrency(itemPrice * item.quantity)}</td>
      </tr>
    `;
  }).join("");

  const paymentMethod = order.payments[0]?.method === "RAZORPAY" ? "Online (Razorpay)" : "Cash";
  const paymentStatus = order.paymentStatus;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bill - ${invoice?.invoiceNumber ?? order.id.slice(0, 8).toUpperCase()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f5f5f5; display: flex; justify-content: center; padding: 20px; }
    .bill { background: #fff; width: 100%; max-width: 400px; padding: 24px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { text-align: center; border-bottom: 2px dashed #e0e0e0; padding-bottom: 16px; margin-bottom: 16px; }
    .header h1 { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
    .header p { font-size: 12px; color: #666; line-height: 1.4; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f0f0f0; }
    .meta span { display: block; }
    .meta strong { color: #1a1a1a; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #999; padding: 4px 0 8px; border-bottom: 2px solid #1a1a1a; }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3) { text-align: right; }
    .totals { margin-top: 12px; border-top: 2px solid #1a1a1a; padding-top: 12px; }
    .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .totals .row.discount { color: #16a34a; }
    .totals .row.total { font-size: 16px; font-weight: 700; border-top: 2px dashed #e0e0e0; margin-top: 8px; padding-top: 8px; }
    .payment-info { margin-top: 16px; padding: 12px; background: #f9f9f9; border-radius: 8px; font-size: 12px; color: #666; }
    .payment-info .label { font-weight: 600; color: #1a1a1a; }
    .footer { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 2px dashed #e0e0e0; }
    .footer p { font-size: 12px; color: #666; line-height: 1.5; }
    .footer .thanks { font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
    @media print {
      body { background: #fff; padding: 0; }
      .bill { box-shadow: none; border-radius: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="bill">
    <div class="header">
      ${restaurant.logo && isHttpUrl(restaurant.logo) ? `<img src="${escapeHtml(restaurant.logo)}" alt="Logo" style="height:48px;margin:0 auto 8px;object-fit:contain;" />` : ""}
      <h1>${escapeHtml(restaurant.restaurantName)}</h1>
      ${restaurant.address ? `<p>${escapeHtml(restaurant.address)}</p>` : ""}
      ${restaurant.phone ? `<p>Ph: ${escapeHtml(restaurant.phone)}</p>` : ""}
      ${restaurant.gstNumber ? `<p>GSTIN: ${escapeHtml(restaurant.gstNumber)}</p>` : ""}
    </div>

    <div class="meta">
      <div>
        <span class="label">Invoice</span>
        <strong>${invoice?.invoiceNumber ?? "—"}</strong>
      </div>
      <div style="text-align:right;">
        <span class="label">Date</span>
        <strong>${formatDate(order.createdAt)}</strong>
      </div>
    </div>

    <div class="meta">
      <div>
        <span class="label">Table</span>
        <strong>${escapeHtml(order.table?.number ?? order.orderNumber ?? "Takeaway")}</strong>
      </div>
      <div style="text-align:center;">
        <span class="label">Customer</span>
        <strong>${escapeHtml(order.customerName)}</strong>
      </div>
      <div style="text-align:right;">
        <span class="label">Order ID</span>
        <strong>#${order.id.slice(0, 8).toUpperCase()}</strong>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items}
      </tbody>
    </table>

    <div class="totals">
      <div class="row">
        <span>Subtotal</span>
        <span>${formatCurrency(toNumber(order.subtotal))}</span>
      </div>
      ${toNumber(order.discountAmount) > 0 ? `
      <div class="row discount">
        <span>Discount${order.offerCode ? ` (${escapeHtml(order.offerCode)})` : ""}</span>
        <span>−${formatCurrency(toNumber(order.discountAmount))}</span>
      </div>` : ""}
      ${toNumber(order.gstAmount) > 0 ? `
      <div class="row">
        <span>GST (${restaurant.gstPercentage}%)</span>
        <span>${formatCurrency(toNumber(order.gstAmount))}</span>
      </div>` : ""}
      ${toNumber(order.serviceChargeAmount) > 0 ? `
      <div class="row">
        <span>Service Charge (${restaurant.serviceChargePercentage}%)</span>
        <span>${formatCurrency(toNumber(order.serviceChargeAmount))}</span>
      </div>` : ""}
      <div class="row total">
        <span>Grand Total</span>
        <span>${formatCurrency(toNumber(order.totalAmount))}</span>
      </div>
    </div>

    <div class="payment-info">
      <span class="label">Payment:</span> ${paymentMethod}
      <span style="margin-left:12px;" class="label">Status:</span>
      <span style="color:${paymentStatus === "SUCCESS" ? "#16a34a" : "#dc2626"};font-weight:600;">${paymentStatus}</span>
    </div>

    <div class="footer">
      <p class="thanks">Thank you for dining with us!</p>
      <p>We hope to see you again soon.</p>
      ${restaurant.email ? `<p style="margin-top:4px;">${escapeHtml(restaurant.email)}</p>` : ""}
    </div>

    <div class="no-print" style="text-align:center;margin-top:16px;">
      <button onclick="window.print()" style="padding:10px 24px;border:none;border-radius:8px;background:#1a1a1a;color:#fff;font-size:14px;font-weight:500;cursor:pointer;">
        Print / Save as PDF
      </button>
    </div>
  </div>
</body>
</html>`;
}
