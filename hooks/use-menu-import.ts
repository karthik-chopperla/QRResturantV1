"use client";

import { useState, useCallback } from "react";
import { scanMenuImage } from "@/actions/menu-scanner";
import { saveMenuItems } from "@/actions/save-menu-items";
import { compressImage, validateImageFile } from "@/lib/validators";
import type { MenuImportItem } from "@/types/menu-import";
import type { FoodType } from "@prisma/client";

let nextId = 0;
function generateId(): string {
  return `import-${Date.now()}-${++nextId}`;
}

export type ImportStep = "upload" | "preview" | "importing" | "done";

export function useMenuImport() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [items, setItems] = useState<MenuImportItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    let processedFile = file;
    if (file.size > 5 * 1024 * 1024) {
      try {
        processedFile = await compressImage(file);
      } catch {
        // Use original if compression fails
      }
    }

    const url = URL.createObjectURL(processedFile);
    setPreviewUrl(url);
    setScanning(true);
    setStep("preview");

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Content = result.split(",")[1];
          resolve(base64Content);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(processedFile);
      });

      const result = await scanMenuImage(base64, processedFile.type);

      if (!result.success) {
        setError(result.error);
        setStep("upload");
        setScanning(false);
        return;
      }

      const parsed: MenuImportItem[] = result.items.map((item) => ({
        id: generateId(),
        name: item.name,
        description: item.description || "",
        price: item.price,
        foodType: item.foodType as FoodType,
        spicyLevel: item.spicyLevel,
        ingredients: item.ingredients,
        allergens: item.allergens,
        categoryId: item.categoryId || "",
        categoryName: item.category || "",
        selected: true,
      }));

      setItems(parsed);
      setScanning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan menu");
      setStep("upload");
      setScanning(false);
    }
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<MenuImportItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const toggleItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  }, []);

  const toggleAll = useCallback(() => {
    setItems((prev) => {
      const allSelected = prev.every((i) => i.selected);
      return prev.map((i) => ({ ...i, selected: !allSelected }));
    });
  }, []);

  const setBulkCategory = useCallback((categoryId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.selected ? { ...item, categoryId } : item))
    );
  }, []);

  const handleImport = useCallback(async () => {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) {
      setError("No items selected for import.");
      return;
    }

    const missingCategory = selected.find((i) => !i.categoryId);
    if (missingCategory) {
      setError(`"${missingCategory.name}" is missing a category.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await saveMenuItems(
        selected.map((i) => ({
          name: i.name,
          description: i.description,
          price: i.price,
          foodType: i.foodType,
          spicyLevel: i.spicyLevel,
          ingredients: i.ingredients,
          allergens: i.allergens,
          categoryId: i.categoryId,
          imageUrl: i.imageUrl,
        }))
      );

      if ("error" in result) {
        setError(result.error);
        setSaving(false);
        return;
      }

      setImportedCount(result.count);
      setStep("done");
      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import items");
      setSaving(false);
    }
  }, [items]);

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStep("upload");
    setPreviewUrl(null);
    setItems([]);
    setScanning(false);
    setSaving(false);
    setError(null);
    setImportedCount(0);
  }, [previewUrl]);

  const selectedCount = items.filter((i) => i.selected).length;
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  return {
    step,
    previewUrl,
    items,
    scanning,
    saving,
    error,
    importedCount,
    selectedCount,
    allSelected,
    handleFileSelect,
    updateItem,
    toggleItem,
    toggleAll,
    setBulkCategory,
    handleImport,
    reset,
  };
}
