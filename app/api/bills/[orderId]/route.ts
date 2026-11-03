import { NextResponse } from "next/server";
import { generateBillHtml } from "@/lib/bill-generator";
import { getCurrentUser } from "@/actions/auth";
import prisma from "@/lib/prisma";
import { verifyTableToken } from "@/lib/table-token";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const user = await getCurrentUser();
  let authorized =
    user?.role === Role.RESTAURANT_OWNER ||
    user?.role === Role.MANAGER ||
    user?.role === Role.CASHIER ||
    user?.role === Role.ACCOUNTANT;

  if (!user) {
    const tableToken = new URL(_request.url).searchParams.get("table");
    if (tableToken) {
      const tableId = verifyTableToken(tableToken);
      if (tableId) {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { tableId: true },
        });
        authorized = order?.tableId === tableId;
      }
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: user ? 403 : 401 });
  }

  const html = await generateBillHtml(orderId);
  if (!html) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
