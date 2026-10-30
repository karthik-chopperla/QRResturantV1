"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { categorySchema } from "@/schemas";

export async function getCategories() {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");

  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCategory(data: {
  name: string;
  description?: string;
  sortOrder?: number;
  parentId?: string | null;
}) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        sortOrder: parsed.data.sortOrder ?? 0,
        parentId: parsed.data.parentId || null,
      },
    });
    revalidatePath("/dashboard/menu");
    return { success: true, category };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { error: "A category with this name already exists in this location." };
    }
    return { error: "Failed to create category." };
  }
}

export async function updateCategory(
  id: string,
  data: { name?: string; description?: string; sortOrder?: number; parentId?: string | null }
) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const parsed = categorySchema.partial().safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    if (data.parentId === id) return { error: "A category cannot be its own parent." };

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
        ...(parsed.data.parentId !== undefined && { parentId: parsed.data.parentId || null }),
      },
    });
    revalidatePath("/dashboard/menu");
    return { success: true, category };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { error: "A category with this name already exists in this location." };
    }
    return { error: "Failed to update category." };
  }
}

export async function deleteCategory(id: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.category.delete({
      where: { id },
    });
    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch {
    return { error: "Failed to delete category." };
  }
}
