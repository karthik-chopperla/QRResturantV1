import type { FoodType } from "@prisma/client";

export interface ParsedMenuItem {
  name: string;
  description: string;
  price: number;
  foodType: FoodType;
  spicyLevel: number;
  ingredients: string[];
  allergens: string[];
  category: string;
}

export interface MenuScanResult {
  success: true;
  items: ParsedMenuItem[];
}

export interface MenuScanError {
  success: false;
  error: string;
}

export type MenuScanResponse = MenuScanResult | MenuScanError;

export interface MenuImportItem {
  id: string;
  name: string;
  description: string;
  price: number;
  foodType: FoodType;
  spicyLevel: number;
  ingredients: string[];
  allergens: string[];
  categoryId: string;
  categoryName: string;
  selected: boolean;
  imageUrl?: string | null;
}

export interface SaveMenuItemsResponse {
  success: true;
  count: number;
}

export interface SaveMenuItemsError {
  error: string;
}

export type SaveMenuItemsResult = SaveMenuItemsResponse | SaveMenuItemsError;
