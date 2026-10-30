"use server";

import prisma from "@/lib/prisma";
import { analyzeMenuImage } from "@/lib/gemini";
import { validateGeminiResponse } from "@/lib/validators";
import { requireAdmin } from "@/lib/roles";
import type { MenuScanResponse, ParsedMenuItem } from "@/types/menu-import";

const MAX_SIZE = 10 * 1024 * 1024;

interface ScanResultItem extends ParsedMenuItem {
  categoryId: string;
}

interface ScanResultSuccess {
  success: true;
  items: ScanResultItem[];
}

type ScanResponse = ScanResultSuccess | MenuScanError;

interface MenuScanError {
  success: false;
  error: string;
}

export async function scanMenuImage(
  base64Data: string,
  mimeType: string
): Promise<ScanResponse> {
  const user = await requireAdmin();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!["image/png", "image/jpeg", "image/jpg"].includes(mimeType)) {
    return { success: false, error: "Invalid file type. Please upload a PNG, JPG, or JPEG image." };
  }

  const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
  if (sizeInBytes > MAX_SIZE) {
    return { success: false, error: "File too large. Maximum size is 10MB." };
  }

  try {
    const rawResponse = await analyzeMenuImage(base64Data, mimeType);
    const validation = validateGeminiResponse(rawResponse);

    if (!validation.valid) {
      return { success: false, error: validation.error! };
    }

    const items = validation.data!.items;

    // Fetch existing categories
    const existingCategories = await prisma.category.findMany({
      select: { id: true, name: true },
    });

    // Build a case-insensitive lookup map
    const categoryMap = new Map<string, string>();
    existingCategories.forEach((cat) => {
      categoryMap.set(cat.name.toLowerCase().trim(), cat.id);
    });

    // Collect unique category names from AI suggestions
    const uniqueCategoryNames = [
      ...new Set(items.map((item) => item.category.trim()).filter(Boolean)),
    ];

    // Create missing categories
    for (const catName of uniqueCategoryNames) {
      const normalized = catName.toLowerCase().trim();
      if (!categoryMap.has(normalized)) {
        try {
          const newCategory = await prisma.category.create({
            data: { name: catName.trim() },
          });
          categoryMap.set(normalized, newCategory.id);
        } catch {
          // Category might have been created by a concurrent request
          const existing = await prisma.category.findFirst({
            where: { name: { equals: catName.trim(), mode: "insensitive" } },
            select: { id: true },
          });
          if (existing) {
            categoryMap.set(normalized, existing.id);
          }
        }
      }
    }

    // Map items with categoryId
    const itemsWithCategory: ScanResultItem[] = items.map((item) => {
      const normalized = item.category.toLowerCase().trim();
      const categoryId = categoryMap.get(normalized) || "";
      return {
        ...item,
        categoryId,
      };
    });

    return { success: true, items: itemsWithCategory };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    const msg = raw.toLowerCase();
    console.error("[menu-scanner] Error:", raw);

    if (msg.includes("api key") || msg.includes("apikey") || msg.includes("invalid_key") || msg.includes("401") || msg.includes("403")) {
      return { success: false, error: "AI service authentication failed. Check your GEMINI_API_KEY." };
    }
    if (msg.includes("timeout") || msg.includes("deadline")) {
      return { success: false, error: "AI service timed out. Please try again." };
    }
    if (msg.includes("resource_exhausted") || msg.includes("429") || msg.includes("quota")) {
      return { success: false, error: "AI service rate limit exceeded. Please try again later." };
    }
    if (msg.includes("not found") || msg.includes("404") || msg.includes("does not exist")) {
      return { success: false, error: `AI model not available. Detail: ${raw}` };
    }

    return { success: false, error: `Failed to analyze menu: ${raw}` };
  }
}
