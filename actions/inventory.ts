"use server";

import prisma from "@/lib/prisma";
import { requireInventoryAccess, requireOwner } from "@/lib/roles";
import { NotificationType, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { convertDecimalsDeep } from "@/lib/decimal";
import {
  addIngredientStock,
  removeIngredientStock,
} from "@/lib/inventory-stock";

const ingredientInput = z.object({
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(20),
  quantityOnHand: z.number().finite().nonnegative(),
  minimumQuantity: z.number().finite().nonnegative(),
  unitCost: z.number().finite().nonnegative(),
  categoryId: z.string().uuid().optional().nullable(),
  batchNumber: z.string().trim().max(100).optional().nullable(),
  expiresAt: z.string().date().optional().nullable(),
});

function parseExpiryDate(value: string | null | undefined) {
  return value ? new Date(`${value}T23:59:59.999Z`) : null;
}

export async function getInventoryData() {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };

  const [ingredients, categories, movements, menuItems, purchaseRequests] = await Promise.all([
    prisma.ingredient.findMany({
      include: {
        category: true,
        batches: {
          where: { quantityOnHand: { gt: 0 } },
          orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.ingredientCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      include: { ingredient: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.menuItem.findMany({
      include: {
        variants: true,
        addons: true,
        recipeItems: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, unitCost: true, quantityOnHand: true, isActive: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseRequest.findMany({
      include: {
        items: {
          include: {
            ingredient: { select: { name: true, unit: true } },
          },
        },
        purchaseOrder: {
          select: {
            purchaseNumber: true,
            status: true,
            expectedDeliveryAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return convertDecimalsDeep({
    ingredients,
    categories,
    movements,
    menuItems,
    purchaseRequests,
  });
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
            expiresAt: parseExpiryDate(parsed.data.expiresAt),
          },
        });
        const delta = parsed.data.quantityOnHand - Number(existing.quantityOnHand);
        if (delta !== 0) {
          if (delta > 0) {
            const batch = await addIngredientStock(tx, {
              ingredientId: updated.id,
              quantity: delta,
              unitCost: parsed.data.unitCost,
              batchNumber: parsed.data.batchNumber,
              expiresAt: parseExpiryDate(parsed.data.expiresAt),
            });
            await tx.stockMovement.create({
              data: {
                ingredientId: updated.id,
                batchId: batch.id,
                type: StockMovementType.ADJUSTMENT,
                quantity: delta,
                reason: "Opening stock or inventory correction",
                actorId: user.id,
              },
            });
          } else {
            const { allocations } = await removeIngredientStock(tx, {
              ingredientId: updated.id,
              quantity: Math.abs(delta),
              includeExpired: true,
            });
            for (const allocation of allocations) {
              await tx.stockMovement.create({
                data: {
                  ingredientId: updated.id,
                  batchId: allocation.batchId,
                  type: StockMovementType.ADJUSTMENT,
                  quantity: -allocation.quantity,
                  reason: "Opening stock or inventory correction",
                  actorId: user.id,
                },
              });
            }
          }
        }
        return updated;
      }

      const created = await tx.ingredient.create({
        data: {
          name: parsed.data.name,
          unit: parsed.data.unit,
          quantityOnHand: 0,
          minimumQuantity: parsed.data.minimumQuantity,
          unitCost: parsed.data.unitCost,
          categoryId: parsed.data.categoryId ?? null,
          expiresAt: parseExpiryDate(parsed.data.expiresAt),
        },
      });
      if (parsed.data.quantityOnHand > 0) {
        const batch = await addIngredientStock(tx, {
          ingredientId: created.id,
          quantity: parsed.data.quantityOnHand,
          unitCost: parsed.data.unitCost,
          batchNumber: parsed.data.batchNumber,
          expiresAt: parseExpiryDate(parsed.data.expiresAt),
        });
        await tx.stockMovement.create({
          data: {
            ingredientId: created.id,
            batchId: batch.id,
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
  batchNumber?: string;
  expiresAt?: string;
}) {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    ingredientId: z.string().uuid(),
    quantity: z.number().finite().positive(),
    type: z.enum(["ADJUSTMENT", "WASTAGE"]),
    reason: z.string().trim().min(1).max(300),
    batchNumber: z.string().trim().max(100).optional(),
    expiresAt: z.string().date().optional(),
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

      const isWastage = parsed.data.type === "WASTAGE";
      if (isWastage) {
        const { allocations } = await removeIngredientStock(tx, {
          ingredientId: ingredient.id,
          quantity: parsed.data.quantity,
          includeExpired: true,
        });
        for (const allocation of allocations) {
          await tx.stockMovement.create({
            data: {
              ingredientId: ingredient.id,
              batchId: allocation.batchId,
              type: StockMovementType.WASTAGE,
              quantity: -allocation.quantity,
              reason: parsed.data.reason,
              actorId: user.id,
            },
          });
        }
      } else {
        const batch = await addIngredientStock(tx, {
          ingredientId: ingredient.id,
          quantity: parsed.data.quantity,
          unitCost: Number(ingredient.unitCost),
          batchNumber: parsed.data.batchNumber,
          expiresAt: parseExpiryDate(parsed.data.expiresAt),
        });
        await tx.stockMovement.create({
          data: {
            ingredientId: ingredient.id,
            batchId: batch.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: parsed.data.quantity,
            reason: parsed.data.reason,
            actorId: user.id,
          },
        });
      }

      const updatedQuantity =
        Number(ingredient.quantityOnHand) +
        (isWastage ? -parsed.data.quantity : parsed.data.quantity);

      if (
        updatedQuantity <= Number(ingredient.minimumQuantity)
      ) {
        await tx.notification.create({
          data: {
            title: `Low stock: ${ingredient.name}`,
            message: `Available ${updatedQuantity} ${ingredient.unit}; minimum is ${ingredient.minimumQuantity} ${ingredient.unit}.`,
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

export async function setIngredientStockCount(input: {
  ingredientId: string;
  actualQuantity: number;
  reason: string;
}) {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    ingredientId: z.string().uuid(),
    actualQuantity: z.number().finite().nonnegative(),
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
      const delta = parsed.data.actualQuantity - Number(ingredient.quantityOnHand);
      if (delta === 0) return;

      if (delta > 0) {
        const batch = await addIngredientStock(tx, {
          ingredientId: ingredient.id,
          quantity: delta,
          unitCost: Number(ingredient.unitCost),
          batchNumber: "Physical stock adjustment",
        });
        await tx.stockMovement.create({
          data: {
            ingredientId: ingredient.id,
            batchId: batch.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: delta,
            reason: parsed.data.reason,
            actorId: user.id,
          },
        });
      } else {
        const { allocations } = await removeIngredientStock(tx, {
          ingredientId: ingredient.id,
          quantity: Math.abs(delta),
          includeExpired: true,
        });
        for (const allocation of allocations) {
          await tx.stockMovement.create({
            data: {
              ingredientId: ingredient.id,
              batchId: allocation.batchId,
              type: StockMovementType.ADJUSTMENT,
              quantity: -allocation.quantity,
              reason: parsed.data.reason,
              actorId: user.id,
            },
          });
        }
      }
    });
    revalidatePath("/inventory");
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update physical stock count.",
    };
  }
}

export async function setIngredientActive(id: string, isActive: boolean) {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    id: z.string().uuid(),
    isActive: z.boolean(),
  }).safeParse({ id, isActive });
  if (!parsed.success) return { error: "Invalid ingredient update." as const };

  try {
    await prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUnique({
        where: { id: parsed.data.id },
        select: { quantityOnHand: true, isActive: true },
      });
      if (!ingredient) throw new Error("Ingredient not found.");
      if (!parsed.data.isActive && ingredient.isActive) {
        if (Number(ingredient.quantityOnHand) > 0) {
          throw new Error("An ingredient with stock on hand cannot be deactivated.");
        }
        const recipeCount = await tx.recipeIngredient.count({
          where: { ingredientId: parsed.data.id },
        });
        if (recipeCount > 0) {
          throw new Error("Remove this ingredient from its recipes before deactivating it.");
        }
      }
      await tx.ingredient.update({
        where: { id: parsed.data.id },
        data: { isActive: parsed.data.isActive },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: parsed.data.isActive ? "INGREDIENT_REACTIVATED" : "INGREDIENT_DEACTIVATED",
          entityType: "Ingredient",
          entityId: parsed.data.id,
        },
      });
    });
    revalidatePath("/inventory");
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update ingredient.",
    };
  }
}

export async function recordExpiredBatchWastage(
  batchId: string,
  reason: string
) {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    batchId: z.string().min(1),
    reason: z.string().trim().min(1).max(300),
  }).safeParse({ batchId, reason });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const batch = await tx.ingredientBatch.findUnique({
        where: { id: parsed.data.batchId },
        include: { ingredient: { select: { id: true, name: true } } },
      });
      if (!batch || !batch.expiresAt || batch.expiresAt > new Date()) {
        throw new Error("Only an expired batch can be recorded as expired wastage.");
      }
      const quantity = Number(batch.quantityOnHand);
      if (quantity <= 0) throw new Error("This batch has no remaining stock.");

      const updated = await tx.ingredientBatch.updateMany({
        where: {
          id: batch.id,
          quantityOnHand: { gte: quantity },
        },
        data: { quantityOnHand: { decrement: quantity } },
      });
      if (updated.count !== 1) throw new Error("Batch stock changed. Refresh and retry.");
      const updatedIngredient = await tx.ingredient.updateMany({
        where: {
          id: batch.ingredientId,
          quantityOnHand: { gte: quantity },
        },
        data: { quantityOnHand: { decrement: quantity } },
      });
      if (updatedIngredient.count !== 1) {
        throw new Error("Ingredient stock changed. Refresh and retry.");
      }
      await tx.stockMovement.create({
        data: {
          ingredientId: batch.ingredientId,
          batchId: batch.id,
          type: StockMovementType.WASTAGE,
          quantity: -quantity,
          reason: parsed.data.reason,
          actorId: user.id,
        },
      });
    });
    revalidatePath("/inventory");
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not record expired stock.",
    };
  }
}

export async function saveRecipe(
  menuItemId: string,
  ingredients: Array<{ ingredientId: string; quantity: number }>,
  scope:
    | { type: "BASE" }
    | { type: "VARIANT"; id: string }
    | { type: "ADDON"; id: string } = { type: "BASE" }
) {
  const user = await requireOwner();
  if (!user) return { error: "Only the Restaurant Owner can change recipes." as const };
  const parsed = z.object({
    menuItemId: z.string().uuid(),
    ingredients: z.array(z.object({
      ingredientId: z.string().uuid(),
      quantity: z.number().finite().positive(),
    })).max(100),
    scope: z.discriminatedUnion("type", [
      z.object({ type: z.literal("BASE") }),
      z.object({ type: z.literal("VARIANT"), id: z.string().uuid() }),
      z.object({ type: z.literal("ADDON"), id: z.string().uuid() }),
    ]),
  }).safeParse({ menuItemId, ingredients, scope });
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
        select: {
          id: true,
          variants: { select: { id: true } },
          addons: { select: { id: true } },
        },
      });
      if (!menuItem) throw new Error("Menu item not found.");
      const scopeId =
        parsed.data.scope.type === "BASE" ? null : parsed.data.scope.id;
      if (
        (parsed.data.scope.type === "VARIANT" &&
          !menuItem.variants.some((variant) => variant.id === scopeId)) ||
        (parsed.data.scope.type === "ADDON" &&
          !menuItem.addons.some((addon) => addon.id === scopeId))
      ) {
        throw new Error("Recipe scope does not belong to this menu item.");
      }
      const ingredientCount = await tx.ingredient.count({
        where: {
          id: { in: ingredients.map((item) => item.ingredientId) },
          isActive: true,
        },
      });
      if (ingredientCount !== ingredients.length) {
        throw new Error("One or more ingredients were not found or are inactive.");
      }
      const variantId =
        parsed.data.scope.type === "VARIANT" ? parsed.data.scope.id : null;
      const addonId =
        parsed.data.scope.type === "ADDON" ? parsed.data.scope.id : null;
      await tx.recipeIngredient.deleteMany({
        where: { menuItemId, variantId, addonId },
      });
      if (ingredients.length) {
        await tx.recipeIngredient.createMany({
          data: ingredients.map((item) => ({
            menuItemId,
            variantId,
            addonId,
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
          details: {
            ingredientCount: ingredients.length,
            scope: parsed.data.scope,
          },
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

export async function getIngredientStockHistory(ingredientId: string) {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.string().uuid().safeParse(ingredientId);
  if (!parsed.success) return { error: "Invalid ingredient." as const };
  const movements = await prisma.stockMovement.findMany({
    where: { ingredientId: parsed.data },
    include: { batch: { select: { batchNumber: true, expiresAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return convertDecimalsDeep(movements);
}

export async function getInventoryReportData(input: {
  report: "current-stock" | "low-stock" | "consumption" | "wastage" | "purchase-history";
  from?: string;
  to?: string;
}) {
  const user = await requireInventoryAccess();
  if (!user) return { error: "Unauthorized" as const };
  const parsed = z.object({
    report: z.enum(["current-stock", "low-stock", "consumption", "wastage", "purchase-history"]),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }
  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    return { error: "The start date must be on or before the end date." as const };
  }

  if (parsed.data.report === "current-stock" || parsed.data.report === "low-stock") {
    const ingredients = await prisma.ingredient.findMany({
      where: { isActive: true },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    const reportIngredients =
      parsed.data.report === "low-stock"
        ? ingredients.filter(
            (ingredient) =>
              Number(ingredient.quantityOnHand) <= Number(ingredient.minimumQuantity)
          )
        : ingredients;
    return {
      rows: reportIngredients.map((ingredient) => ({
        ingredient: ingredient.name,
        category: ingredient.category?.name ?? "",
        quantity: Number(ingredient.quantityOnHand),
        unit: ingredient.unit,
        minimum: Number(ingredient.minimumQuantity),
        unitCost: Number(ingredient.unitCost),
        stockValue:
          Number(ingredient.quantityOnHand) * Number(ingredient.unitCost),
      })),
    };
  }

  const dateRange = {
    ...(parsed.data.from
      ? { gte: new Date(`${parsed.data.from}T00:00:00.000Z`) }
      : {}),
    ...(parsed.data.to
      ? { lte: new Date(`${parsed.data.to}T23:59:59.999Z`) }
      : {}),
  };
  if (parsed.data.report === "purchase-history") {
    const receipts = await prisma.purchaseReceiptItem.findMany({
      where: {
        ...(Object.keys(dateRange).length
          ? { receipt: { receivedAt: dateRange } }
          : {}),
      },
      include: {
        ingredient: { select: { name: true, unit: true } },
        receipt: {
          select: {
            receivedAt: true,
            purchaseOrder: {
              select: {
                purchaseNumber: true,
                supplier: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { receipt: { receivedAt: "desc" } },
    });
    return {
      rows: receipts.map((receipt) => ({
        receivedAt: receipt.receipt.receivedAt.toISOString(),
        purchaseNumber: receipt.receipt.purchaseOrder.purchaseNumber,
        supplier: receipt.receipt.purchaseOrder.supplier.name,
        ingredient: receipt.ingredient.name,
        quantity: Number(receipt.quantity),
        unit: receipt.ingredient.unit,
        unitCost: Number(receipt.unitCost),
        totalCost: Number(receipt.quantity) * Number(receipt.unitCost),
      })),
    };
  }
  const movements = await prisma.stockMovement.findMany({
    where: {
      type:
        parsed.data.report === "consumption"
          ? StockMovementType.ORDER_CONSUMPTION
          : StockMovementType.WASTAGE,
      ...(Object.keys(dateRange).length ? { createdAt: dateRange } : {}),
    },
    include: { ingredient: { select: { name: true, unit: true } } },
    orderBy: { createdAt: "desc" },
  });
  return {
    rows: movements.map((movement) => ({
      date: movement.createdAt.toISOString(),
      ingredient: movement.ingredient.name,
      quantity: Math.abs(Number(movement.quantity)),
      unit: movement.ingredient.unit,
      reason: movement.reason ?? "",
      reference: movement.referenceId ?? "",
    })),
  };
}
