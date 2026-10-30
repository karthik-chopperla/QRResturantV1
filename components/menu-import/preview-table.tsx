"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ImageIcon, Loader2 } from "lucide-react";
import type { MenuImportItem } from "@/types/menu-import";
import type { FoodType } from "@prisma/client";

interface PreviewTableProps {
  items: MenuImportItem[];
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<MenuImportItem>) => void;
}

export function PreviewTable({
  items,
  categories,
  allSelected,
  onToggleItem,
  onUpdateItem,
  onToggleAll,
}: PreviewTableProps) {
  return (
    <div className="space-y-2">
      {/* Select All Header */}
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleAll}
          aria-label="Select all"
        />
        <span className="text-xs font-medium text-gray-500">
          Select all
        </span>
      </div>

      {/* Item Cards */}
      <div className="space-y-2 max-h-[40vh] sm:max-h-[50vh] overflow-y-auto pr-1">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            categories={categories}
            onToggle={() => onToggleItem(item.id)}
            onUpdate={(updates) => onUpdateItem(item.id, updates)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  categories,
  onToggle,
  onUpdate,
}: {
  item: MenuImportItem;
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  onToggle: () => void;
  onUpdate: (updates: Partial<MenuImportItem>) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        item.selected
          ? "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
          : "border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/30 opacity-60"
      )}
    >
      {/* Main Row */}
      <div className="flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-3 sm:py-2.5">
        <Checkbox
          checked={item.selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${item.name}`}
        />

        {/* Image Thumbnail - hide on very small screens */}
        {item.imageUrl ? (
          <div className="shrink-0 size-8 sm:size-9 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 hidden xs:block">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="size-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="shrink-0 size-8 sm:size-9 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 items-center justify-center hidden xs:flex">
            <ImageIcon className="size-3.5 text-gray-300 dark:text-gray-700" />
          </div>
        )}

        {/* Food Type Indicator */}
        <div className="shrink-0">
          <FoodTypeDot type={item.foodType} />
        </div>

        {/* Name + Price */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Input
              value={item.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-5 sm:h-6 border-0 bg-transparent p-0 text-xs sm:text-sm font-bold focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none min-w-0"
            />
            {item.spicyLevel > 0 && (
              <span className="text-[10px] shrink-0">
                {"🌶️".repeat(item.spicyLevel)}
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-[10px] sm:text-[11px] text-gray-400 truncate mt-0.5 max-w-[180px] sm:max-w-[280px]">
              {item.description}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="shrink-0 w-16 sm:w-20">
          <Input
            type="number"
            min="0"
            step="1"
            value={item.price}
            onChange={(e) =>
              onUpdate({ price: parseFloat(e.target.value) || 0 })
            }
            className="h-5 sm:h-6 border-0 bg-transparent p-0 text-xs sm:text-sm font-bold text-right focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
          />
        </div>

        {/* Category Badge - hidden on mobile */}
        <div className="shrink-0 hidden md:block">
          {item.categoryId ? (
            <Badge className="text-[9px] font-bold px-1.5 py-0 bg-blue-50 text-blue-600 border-0">
              {item.categoryName || categories.find((c) => c.id === item.categoryId)?.name || "Set"}
            </Badge>
          ) : (
            <Badge className="text-[9px] font-bold px-1.5 py-0 bg-amber-50 text-amber-600 border-0">
              No category
            </Badge>
          )}
        </div>

        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 size-7 sm:size-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {expanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-2.5 pb-3 pt-1 border-t border-gray-50 dark:border-gray-900 space-y-2.5 sm:px-3">
          {/* Image Section */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Image
            </label>
            {item.imageUrl ? (
              <div className="relative size-16 sm:size-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="size-full object-cover"
                />
                <button
                  onClick={() => onUpdate({ imageUrl: null })}
                  className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/50 text-white flex items-center justify-center text-[10px] hover:bg-black/70"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="size-16 sm:size-20 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <ImageIcon className="size-5 text-gray-300 dark:text-gray-700" />
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Description
            </label>
            <Input
              value={item.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Short dish description"
              className="h-7 text-xs border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/50"
            />
          </div>

          {/* Food Type + Spicy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Food Type
              </label>
              <FoodTypeSelect
                value={item.foodType}
                onChange={(foodType) => onUpdate({ foodType })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Spicy Level
              </label>
              <SpicySelect
                value={item.spicyLevel}
                onChange={(spicyLevel) => onUpdate({ spicyLevel })}
              />
            </div>
          </div>

          {/* Ingredients + Allergens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Ingredients
              </label>
              <Input
                value={item.ingredients.join(", ")}
                onChange={(e) =>
                  onUpdate({
                    ingredients: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Tomato, Cheese..."
                className="h-7 text-xs border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Allergens
              </label>
              <Input
                value={item.allergens.join(", ")}
                onChange={(e) =>
                  onUpdate({
                    allergens: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Dairy, Gluten..."
                className="h-7 text-xs border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/50"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Category
              {item.categoryName && item.categoryId && (
                <span className="text-blue-500 ml-1 normal-case">
                  (AI: {item.categoryName})
                </span>
              )}
            </label>
            <select
              value={item.categoryId}
              onChange={(e) => {
                const newId = e.target.value;
                const matchedCat = categories.find((c) => c.id === newId);
                onUpdate({
                  categoryId: newId,
                  categoryName: matchedCat?.name || "",
                });
              }}
              className={cn(
                "h-7 w-full rounded-lg border px-2 text-xs outline-none cursor-pointer bg-gray-50/50 dark:bg-gray-900/50",
                item.categoryId
                  ? "border-gray-200 dark:border-gray-800"
                  : "border-dashed border-amber-300 text-gray-400"
              )}
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function FoodTypeDot({ type }: { type: FoodType }) {
  const colors: Record<FoodType, { bg: string; ring: string }> = {
    VEG: { bg: "bg-green-500", ring: "ring-green-200 dark:ring-green-900" },
    NON_VEG: { bg: "bg-red-500", ring: "ring-red-200 dark:ring-red-900" },
    VEGAN: { bg: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-900" },
  };
  const c = colors[type];
  return (
    <div
      className={cn(
        "size-4 rounded-sm border-2 flex items-center justify-center ring-2",
        type === "VEG" && "border-green-600",
        type === "NON_VEG" && "border-red-600",
        type === "VEGAN" && "border-emerald-500",
        c.ring
      )}
    >
      <div className={cn("size-1.5 rounded-full", c.bg)} />
    </div>
  );
}

function FoodTypeSelect({
  value,
  onChange,
}: {
  value: FoodType;
  onChange: (v: FoodType) => void;
}) {
  const options: { value: FoodType; label: string; dot: string; active: string }[] = [
    {
      value: "VEG",
      label: "Veg",
      dot: "border-green-600",
      active: "bg-green-50 border-green-500 text-green-700 dark:bg-green-950/40 dark:text-green-400",
    },
    {
      value: "NON_VEG",
      label: "Non-Veg",
      dot: "border-red-600",
      active: "bg-red-50 border-red-500 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    },
    {
      value: "VEGAN",
      label: "Vegan",
      dot: "border-emerald-500",
      active: "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    },
  ];

  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-lg border-2 py-1.5 text-[11px] font-bold transition-colors",
            value === opt.value
              ? opt.active
              : "border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-300"
          )}
        >
          <span
            className={cn(
              "size-2 rounded-sm border-[1.5px] flex items-center justify-center",
              opt.dot
            )}
          >
            <span
              className={cn(
                "size-1 rounded-full",
                value === opt.value
                  ? opt.dot.replace("border-", "bg-")
                  : "bg-gray-400"
              )}
            />
          </span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SpicySelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3].map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-colors",
            value === level
              ? level === 0
                ? "bg-gray-50 border-gray-400 text-gray-600 dark:bg-gray-800 dark:border-gray-600"
                : level === 1
                ? "bg-yellow-50 border-yellow-400 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400"
                : level === 2
                ? "bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                : "bg-red-50 border-red-400 text-red-700 dark:bg-red-950/40 dark:text-red-400"
              : "border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-300"
          )}
        >
          {level === 0 ? "None" : "🌶️".repeat(level)}
        </button>
      ))}
    </div>
  );
}
