"use server";

import prisma from "@/lib/prisma";
import { requireInventoryAccess, requireOwner } from "@/lib/roles";
import { NotificationType, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { convertDecimalsDeep } from "@/lib/decimal";

const ingredientInput = z.object({
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(20),
  quantityOnHand: z.number().finite().nonnegative(),
  minimumQuantity: z.number().finite().nonnegative(),
  unitCost: z.number().finite().nonnegative(),
  categoryId: z.string().uuid().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function getInventoryData() {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };

  const [ingredients, categories, movements, menuItems] = await Promise.all([
    prisma.ingredient.findMany({
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.ingredientCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      include: { ingredient: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.menuItem.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return convertDecimalsDeep({ ingredients, categories, movements, menuItems });
}

export async function createIngredientCategory(name: string) {
  const user = await requireOwner();
  if (!user) return { error: "Only the Restaurant Owner can manage ingredient categories." as const };
  const parsed = z.string().trim().min(1).max(100).safeParse(name);
  if (!parsed.success) return { error: "Enter a valid category name." as const };

  try {
    const category = await prisma.ingredientCategory.create({
      data: { name: parsed.data },
    });
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "INGREDIENT_CATEGORY_CREATED",
        entityType: "IngredientCategory",
        entityId: category.id,
      },
    });
    revalidatePath("/inventory");
    return { success: true as const };
  } catch {
    return { error: "A category with this name already exists." as const };
  }
}

export async function saveIngredient(
  input: z.input<typeof ingredientInput> & { id?: string }
) {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = ingredientInput.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  try {
    const ingredient = await prisma.$transaction(async (tx) => {
      if (input.id) {
        const existing = await tx.ingredient.findUnique({
          where: { id: input.id },
          select: { quantityOnHand: true, name: true },
        });
        if (!existing) throw new Error("Ingredient not found.");
        const updated = await tx.ingredient.update({
          where: { id: input.id },
          data: {
            name: parsed.data.name,
            unit: parsed.data.unit,
            minimumQuantity: parsed.data.minimumQuantity,
            unitCost: parsed.data.unitCost,
            categoryId: parsed.data.categoryId ?? null,
            expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          },
        });
        const delta = parsed.data.quantityOnHand - Number(existing.quantityOnHand);
        if (delta !== 0) {
          await tx.ingredient.update({
            where: { id: updated.id },
            data: { quantityOnHand: parsed.data.quantityOnHand },
          });
          await tx.stockMovement.create({
            data: {
              ingredientId: updated.id,
              type: StockMovementType.ADJUSTMENT,
              quantity: delta,
              reason: "Opening stock or inventory correction",
              actorId: user.id,
            },
          });
        }
        return updated;
      }

      const created = await tx.ingredient.create({
        data: {
          name: parsed.data.name,
          unit: parsed.data.unit,
          quantityOnHand: parsed.data.quantityOnHand,
          minimumQuantity: parsed.data.minimumQuantity,
          unitCost: parsed.data.unitCost,
          categoryId: parsed.data.categoryId ?? null,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        },
      });
      if (parsed.data.quantityOnHand > 0) {
        await tx.stockMovement.create({
          data: {
            ingredientId: created.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: parsed.data.quantityOnHand,
            reason: "Opening stock",
            actorId: user.id,
          },
        });
      }
      return created;
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: input.id ? "INGREDIENT_UPDATED" : "INGREDIENT_CREATED",
        entityType: "Ingredient",
        entityId: ingredient.id,
      },
    });
    revalidatePath("/inventory");
    return { success: true as const };
  } catch (error) {
    console.error("saveIngredient error:", error);
    return {
      error: error instanceof Error ? error.message : "Could not save ingredient.",
    };
  }
}

export async function adjustIngredientStock(input: {
  ingredientId: string;
  quantity: number;
  type: "ADJUSTMENT" | "WASTAGE";
  reason: string;
}) {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    ingredientId: z.string().uuid(),
    quantity: z.number().finite().positive(),
    type: z.enum(["ADJUSTMENT", "WASTAGE"]),
    reason: z.string().trim().min(1).max(300),
  }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUnique({
        where: { id: parsed.data.ingredientId },
      });
      if (!ingredient) throw new Error("Ingredient not found.");

      const delta =
        parsed.data.type === "WASTAGE"
          ? -parsed.data.quantity
          : parsed.data.quantity;
      if (delta < 0 && Number(ingredient.quantityOnHand) < Math.abs(delta)) {
        throw new Error("Stock adjustment cannot reduce inventory below zero.");
      }

      await tx.ingredient.update({
        where: { id: ingredient.id },
        data: { quantityOnHand: { increment: delta } },
      });
      await tx.stockMovement.create({
        data: {
          ingredientId: ingredient.id,
          type:
            parsed.data.type === "WASTAGE"
              ? StockMovementType.WASTAGE
              : StockMovementType.ADJUSTMENT,
          quantity: delta,
          reason: parsed.data.reason,
          actorId: user.id,
        },
      });

      if (
        Number(ingredient.quantityOnHand) + delta <=
        Number(ingredient.minimumQuantity)
      ) {
        await tx.notification.create({
          data: {
            title: `Low stock: ${ingredient.name}`,
            message: `Available ${Number(ingredient.quantityOnHand) + delta} ${ingredient.unit}; minimum is ${ingredient.minimumQuantity} ${ingredient.unit}.`,
            type: NotificationType.LOW_STOCK,
          },
        });
      }
    });
    revalidatePath("/inventory");
    revalidatePath("/manager");
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not adjust stock.",
    };
  }
}

export async function saveRecipe(
  menuItemId: string,
  ingredients: Array<{ ingredientId: string; quantity: number }>
) {
  const user = await requireOwner();
  if (!user) return { error: "Only the Restaurant Owner can change recipes." as const };
  const parsed = z.object({
    menuItemId: z.string().uuid(),
    ingredients: z.array(z.object({
      ingredientId: z.string().uuid(),
      quantity: z.number().finite().positive(),
    })).max(100),
  }).safeParse({ menuItemId, ingredients });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }
  if (new Set(ingredients.map((item) => item.ingredientId)).size !== ingredients.length) {
    return { error: "Each ingredient can appear only once in a recipe." as const };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const menuItem = await tx.menuItem.findUnique({
        where: { id: menuItemId },
        select: { id: true },
      });
      if (!menuItem) throw new Error("Menu item not found.");
      const ingredientCount = await tx.ingredient.count({
        where: { id: { in: ingredients.map((item) => item.ingredientId) } },
      });
      if (ingredientCount !== ingredients.length) {
        throw new Error("One or more ingredients were not found.");
      }
      await tx.recipeIngredient.deleteMany({ where: { menuItemId } });
      if (ingredients.length) {
        await tx.recipeIngredient.createMany({
          data: ingredients.map((item) => ({
            menuItemId,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "MENU_RECIPE_UPDATED",
          entityType: "MenuItem",
          entityId: menuItemId,
          details: { ingredientCount: ingredients.length },
        },
      });
    });
    revalidatePath("/inventory");
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save recipe.",
    };
  }
}
