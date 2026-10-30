import { z } from "zod";

export const parsedMenuItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).default(""),
  price: z.coerce.number().nonnegative("Price must be ≥ 0"),
  foodType: z.enum(["VEG", "NON_VEG", "VEGAN"]).default("VEG"),
  spicyLevel: z.coerce.number().int().min(0).max(3).default(0),
  ingredients: z.array(z.string().max(100)).default([]),
  allergens: z.array(z.string().max(100)).default([]),
  category: z.string().max(100).default("Uncategorized"),
});

export const menuScanResponseSchema = z.object({
  items: z.array(parsedMenuItemSchema),
});

export type ParsedMenuItemInput = z.infer<typeof parsedMenuItemSchema>;
export type MenuScanResponseInput = z.infer<typeof menuScanResponseSchema>;
