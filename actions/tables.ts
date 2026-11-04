"use server";

import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { createTableSchema } from "@/schemas";
import QRCode from "qrcode";
import { generateTableToken } from "@/lib/table-token";
import { TableStatus } from "@prisma/client";
import { getPublicAppUrl } from "@/lib/app-url";

async function generateTableQrCode(tableId: string): Promise<string> {
  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    throw new Error(
      "App URL is not configured. Set NEXT_PUBLIC_APP_URL or configure the Vercel production domain."
    );
  }

  if (!process.env.TABLE_TOKEN_SECRET || process.env.TABLE_TOKEN_SECRET.length < 16) {
    throw new Error(
      "TABLE_TOKEN_SECRET is not configured on the server. Please add it to your environment variables."
    );
  }

  const token = generateTableToken(tableId);
  return QRCode.toDataURL(`${appUrl}/menu/${token}`, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function getTables() {
  const user = await requireAdmin();
  if (!user) return [];

  try {
    return prisma.table.findMany({
      orderBy: { number: "asc" },
    });
  } catch {
    return [];
  }
}

export async function createTable(data: { number: string }) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const parsed = createTableSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    const tableId = randomUUID();
    const qrCodeDataUrl = await generateTableQrCode(tableId);

    const table = await prisma.table.create({
      data: {
        id: tableId,
        number: parsed.data.number,
        qrCodeUrl: qrCodeDataUrl,
      },
    });

    revalidatePath("/dashboard/tables");
    return { success: true, table };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Table create failure:", msg);
    if (msg.includes("Unique constraint")) {
      return { error: "A table with this number already exists." };
    }
    return { error: `Failed to create table: ${msg}` };
  }
}

export async function regenerateTableQrCode(tableId: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    const qrCodeUrl = await generateTableQrCode(tableId);
    const table = await prisma.table.update({
      where: { id: tableId },
      data: { qrCodeUrl },
      select: { id: true, number: true, qrCodeUrl: true },
    });

    revalidatePath("/dashboard/tables");
    return { success: true, table };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "QR code regeneration failed.";
    console.error("Table QR regeneration failure:", msg);
    return { error: msg };
  }
}

export async function deleteTable(id: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    const [orderCount, reservationCount] = await Promise.all([
      prisma.order.count({ where: { tableId: id } }),
      prisma.reservation.count({ where: { tableId: id } }),
    ]);
    if (orderCount > 0 || reservationCount > 0) {
      return {
        error: "This table has order or reservation history and cannot be deleted. Set it to unavailable instead.",
      };
    }

    await prisma.table.delete({ where: { id } });
    revalidatePath("/dashboard/tables");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed.";
    return { error: msg };
  }
}

export async function updateTableStatus(id: string, status: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  if (!Object.values(TableStatus).includes(status as TableStatus)) {
    return { error: "Invalid table status." };
  }

  try {
    const table = await prisma.table.update({
      where: { id },
      data: { status: status as TableStatus },
    });
    revalidatePath("/dashboard/tables");
    return { success: true, table };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}
