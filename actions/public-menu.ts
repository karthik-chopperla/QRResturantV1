"use server";

import prisma from "@/lib/prisma";
import { verifyTableToken } from "@/lib/table-token";
import { convertDecimalsDeep } from "@/lib/decimal";

export async function getPublicMenu(tableParam: string) {
  const tableId = verifyTableToken(tableParam);
  if (!tableId) return null;

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) return null;

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    where: { parentId: null },
    include: {
      menuItems: {
        where: { isAvailable: true },
        include: { variants: true, addons: true },
        orderBy: { name: "asc" },
      },
      children: {
        orderBy: { sortOrder: "asc" },
        include: {
          menuItems: {
            where: { isAvailable: true },
            include: { variants: true, addons: true },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });

  const table = await prisma.table.findUnique({
    where: { id: tableId },
  });

  if (!table) return null;

  const popularItems = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 8,
  });

  const popularIds = popularItems.map((p) => p.menuItemId);
  const bestsellers = popularIds.length
    ? await prisma.menuItem.findMany({
        where: { id: { in: popularIds }, isAvailable: true },
        include: { variants: true, addons: true, category: true },
      })
    : [];

  const newItems = await prisma.menuItem.findMany({
    where: { isAvailable: true },
    include: { variants: true, addons: true, category: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const reviews = await prisma.review.findMany({
    include: { menuItem: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return convertDecimalsDeep({
    restaurant: settings,
    table,
    categories,
    bestsellers,
    newItems,
    reviews,
  });
}

export async function getPublicMenuItem(itemId: string) {
  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, isAvailable: true },
    include: { variants: true, addons: true, category: true, reviews: true },
  });
  return convertDecimalsDeep(item);
}
