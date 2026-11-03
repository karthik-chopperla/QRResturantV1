import type { Prisma } from "@prisma/client";

type Transaction = Prisma.TransactionClient;

export async function addIngredientStock(
  tx: Transaction,
  input: {
    ingredientId: string;
    quantity: number;
    unitCost?: number;
    batchNumber?: string | null;
    expiresAt?: Date | null;
  }
) {
  const ingredient = await tx.ingredient.update({
    where: { id: input.ingredientId },
    data: {
      quantityOnHand: { increment: input.quantity },
      ...(input.unitCost !== undefined ? { unitCost: input.unitCost } : {}),
    },
    select: { id: true },
  });
  const batch = await tx.ingredientBatch.create({
    data: {
      ingredientId: ingredient.id,
      batchNumber: input.batchNumber || null,
      quantityReceived: input.quantity,
      quantityOnHand: input.quantity,
      unitCost: input.unitCost ?? 0,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true },
  });
  return batch;
}

export async function removeIngredientStock(
  tx: Transaction,
  input: {
    ingredientId: string;
    quantity: number;
    includeExpired?: boolean;
  }
) {
  const now = new Date();
  const [ingredient, batches] = await Promise.all([
    tx.ingredient.findUnique({
      where: { id: input.ingredientId },
      select: { name: true, unit: true, quantityOnHand: true },
    }),
    tx.ingredientBatch.findMany({
      where: {
        ingredientId: input.ingredientId,
        quantityOnHand: { gt: 0 },
        ...(input.includeExpired
          ? {}
          : { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }),
      },
      orderBy: [
        { expiresAt: { sort: "asc", nulls: "last" } },
        { receivedAt: "asc" },
      ],
      select: { id: true, quantityOnHand: true },
    }),
  ]);
  if (!ingredient) throw new Error("Ingredient not found.");

  const available = batches.reduce(
    (sum, batch) => sum + Number(batch.quantityOnHand),
    0
  );
  if (available < input.quantity) {
    const qualifier = input.includeExpired ? "" : " unexpired";
    throw new Error(
      `Insufficient${qualifier} stock for ${ingredient.name}: need ${input.quantity} ${ingredient.unit}, available ${available} ${ingredient.unit}.`
    );
  }

  let remaining = input.quantity;
  const allocations: Array<{ batchId: string; quantity: number }> = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, Number(batch.quantityOnHand));
    const updated = await tx.ingredientBatch.updateMany({
      where: { id: batch.id, quantityOnHand: { gte: quantity } },
      data: { quantityOnHand: { decrement: quantity } },
    });
    if (updated.count !== 1) {
      throw new Error(`Stock changed while allocating ${ingredient.name}. Please retry.`);
    }
    allocations.push({ batchId: batch.id, quantity });
    remaining -= quantity;
  }

  const updatedIngredient = await tx.ingredient.updateMany({
    where: {
      id: input.ingredientId,
      quantityOnHand: { gte: input.quantity },
    },
    data: { quantityOnHand: { decrement: input.quantity } },
  });
  if (updatedIngredient.count !== 1) {
    throw new Error(`Stock changed while updating ${ingredient.name}. Please retry.`);
  }
  return { ingredient, allocations };
}

export async function restoreIngredientStock(
  tx: Transaction,
  input: {
    ingredientId: string;
    quantity: number;
    batchId?: string | null;
    reason: string;
  }
) {
  if (input.batchId) {
    const batch = await tx.ingredientBatch.findUnique({
      where: { id: input.batchId },
      select: { id: true },
    });
    if (batch) {
      await tx.ingredientBatch.update({
        where: { id: batch.id },
        data: { quantityOnHand: { increment: input.quantity } },
      });
    } else {
      await addIngredientStock(tx, {
        ingredientId: input.ingredientId,
        quantity: input.quantity,
        batchNumber: input.reason,
      });
      return;
    }
  } else {
    await addIngredientStock(tx, {
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      batchNumber: input.reason,
    });
    return;
  }
  await tx.ingredient.update({
    where: { id: input.ingredientId },
    data: { quantityOnHand: { increment: input.quantity } },
  });
}
