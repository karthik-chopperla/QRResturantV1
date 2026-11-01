"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/roles";
import { menuItemSchema, type MenuItemInput } from "@/schemas";
import { revalidatePath } from "next/cache";
import { convertDecimalsDeep } from "@/lib/decimal";

export async function getMenuItems() {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");

  const menuItems = await prisma.menuItem.findMany({
    include: { category: true, variants: true, addons: true },
    orderBy: { createdAt: "desc" },
  });
  return convertDecimalsDeep(menuItems);
}

export async function createMenuItem(rawData: MenuItemInput) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const parsed = menuItemSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const data = parsed.data;

  try {
    const menuItem = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.create({
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          discountPrice: data.discountPrice ?? null,
          foodType: data.foodType,
          spicyLevel: data.spicyLevel,
          preparationTime: data.preparationTime,
          images: data.images ?? [],
          ingredients: data.ingredients ?? [],
          allergens: data.allergens ?? [],
          nutrition: data.nutrition != null ? (data.nutrition as Prisma.InputJsonValue) : Prisma.JsonNull,
          categoryId: data.categoryId,
          isChefSpecial: data.isChefSpecial ?? false,
          isBestSeller: data.isBestSeller ?? false,
        },
      });

      if (data.variants && data.variants.length > 0) {
        await tx.variant.createMany({
          data: data.variants.map((v) => ({
            menuItemId: item.id,
            name: v.name,
            price: v.price,
          })),
        });
      }

      if (data.addons && data.addons.length > 0) {
        await tx.addon.createMany({
          data: data.addons.map((a) => ({
            menuItemId: item.id,
            name: a.name,
            price: a.price,
            isVeg: a.isVeg ?? true,
          })),
        });
      }

      return item;
    });

    revalidatePath("/dashboard/menu");
    return { success: true, menuItem };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create menu item.";
    console.error("createMenuItem error:", error);
    return { error: msg };
  }
}

export async function updateMenuItem(id: string, rawData: MenuItemInput) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const parsed = menuItemSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const data = parsed.data;

  try {
    const menuItem = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          discountPrice: data.discountPrice ?? null,
          foodType: data.foodType,
          spicyLevel: data.spicyLevel,
          preparationTime: data.preparationTime,
          images: data.images ?? [],
          ingredients: data.ingredients ?? [],
          allergens: data.allergens ?? [],
          nutrition: data.nutrition != null ? (data.nutrition as Prisma.InputJsonValue) : Prisma.JsonNull,
          categoryId: data.categoryId,
          isChefSpecial: data.isChefSpecial ?? false,
          isBestSeller: data.isBestSeller ?? false,
        },
      });

      await tx.variant.deleteMany({ where: { menuItemId: id } });
      await tx.addon.deleteMany({ where: { menuItemId: id } });

      if (data.variants && data.variants.length > 0) {
        await tx.variant.createMany({
          data: data.variants.map((v) => ({
            menuItemId: id,
            name: v.name,
            price: v.price,
          })),
        });
      }

      if (data.addons && data.addons.length > 0) {
        await tx.addon.createMany({
          data: data.addons.map((a) => ({
            menuItemId: id,
            name: a.name,
            price: a.price,
            isVeg: a.isVeg ?? true,
          })),
        });
      }

      return item;
    });

    revalidatePath("/dashboard/menu");
    return { success: true, menuItem };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update menu item.";
    console.error("updateMenuItem error:", error);
    return { error: msg };
  }
}

export async function deleteMenuItem(id: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    const orderHistoryCount = await prisma.orderItem.count({
      where: { menuItemId: id },
    });
    if (orderHistoryCount > 0) {
      return {
        error: "This menu item appears in order history and cannot be deleted. Mark it unavailable instead.",
      };
    }

    const item = await prisma.menuItem.findUnique({
      where: { id },
      select: { images: true },
    });

    if (!item) {
      return { error: "Menu item not found." };
    }

    await prisma.menuItem.delete({ where: { id } });

    if (item.images.length > 0) {
      const { deleteImages } = await import("@/lib/supabase/storage");
      try {
        await deleteImages(item.images);
      } catch (storageError) {
        console.error("Failed to delete images from storage:", storageError);
      }
    }

    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete menu item.";
    return { error: msg };
  }
}

export async function toggleMenuItemAvailability(
  id: string,
  isAvailable: boolean
) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.menuItem.update({ where: { id }, data: { isAvailable } });
    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}
