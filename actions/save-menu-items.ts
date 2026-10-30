"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import type { SaveMenuItemsResult } from "@/types/menu-import";

interface MenuItemToSave {
  name: string;
  description: string;
  price: number;
  foodType: "VEG" | "NON_VEG" | "VEGAN";
  spicyLevel: number;
  ingredients: string[];
  allergens: string[];
  categoryId: string;
  imageUrl?: string | null;
}

export async function saveMenuItems(
  items: MenuItemToSave[]
): Promise<SaveMenuItemsResult> {
  const user = await requireAdmin();
  if (!user) {
    return { error: "Unauthorized" };
  }

  if (!items || items.length === 0) {
    return { error: "No items to import." };
  }

  for (const item of items) {
    if (!item.name?.trim()) {
      return { error: "All items must have a name." };
    }
    if (item.price < 0) {
      return { error: `Invalid price for "${item.name}".` };
    }
    if (!item.categoryId) {
      return { error: `"${item.name}" must have a category assigned.` };
    }
  }

  const categoryIds = [...new Set(items.map((i) => i.categoryId))];
  const existingCategories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });

  const existingIds = new Set(existingCategories.map((c) => c.id));
  for (const item of items) {
    if (!existingIds.has(item.categoryId)) {
      return {
        error: `Category not found for "${item.name}". Please refresh and try again.`,
      };
    }
  }

  try {
    await prisma.menuItem.createMany({
      data: items.map((item) => ({
        name: item.name.trim(),
        description: item.description?.trim() || null,
        price: item.price,
        foodType: item.foodType,
        spicyLevel: item.spicyLevel,
        preparationTime: 15,
        images: item.imageUrl ? [item.imageUrl] : [],
        ingredients: item.ingredients,
        allergens: item.allergens,
        categoryId: item.categoryId,
      })),
      skipDuplicates: false,
    });

    revalidatePath("/dashboard/menu");
    return { success: true, count: items.length };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Database error";
    console.error("saveMenuItems error:", error);
    return { error: `Failed to save items: ${msg}` };
  }
}
