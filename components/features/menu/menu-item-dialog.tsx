"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Minus, Plus, Leaf, Flame, Clock } from "lucide-react";
import { toast } from "sonner";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  foodType: "VEG" | "NON_VEG" | "VEGAN";
  spicyLevel: number;
  preparationTime: number;
  images: string[];
  ingredients: string[];
  allergens: string[];
  variants: { id: string; name: string; price: number }[];
  addons: { id: string; name: string; price: number; isVeg: boolean }[];
};

interface Props {
  item: MenuItem;
  primaryColor: string;
  onClose: () => void;
}

export function MenuItemDialog({ item, primaryColor, onClose }: Props) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(item.variants[0] || null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const basePrice = selectedVariant?.price ?? (item.discountPrice || item.price);
  const addonsTotal = item.addons
    .filter((a) => selectedAddons.includes(a.id))
    .reduce((s, a) => s + a.price, 0);
  const unitPrice = basePrice;
  const totalPrice = (unitPrice + addonsTotal) * quantity;

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleAdd = () => {
    addItem({
      menuItemId: item.id,
      name: item.name,
      image: item.images[0],
      price: unitPrice,
      quantity,
      notes: notes || undefined,
      foodType: item.foodType,
      customizations: {
        variant: selectedVariant
          ? { id: selectedVariant.id, name: selectedVariant.name, price: selectedVariant.price }
          : null,
        addons: item.addons
          .filter((a) => selectedAddons.includes(a.id))
          .map((a) => ({ id: a.id, name: a.name, price: a.price })),
      },
    });
    toast.success(`${item.name} added to cart`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto max-w-lg p-0 rounded-none sm:rounded-2xl">
        {item.images[0] && (
          <div className="relative h-48 w-full">
            <Image src={item.images[0]} alt={item.name} fill className="object-cover rounded-t-lg" />
          </div>
        )}
        <div className="p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {item.name}
              {item.foodType === "VEGAN" ? (
        <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold leading-none text-emerald-700">🌱 Vegan</span>
      ) : item.foodType === "VEG" ? (
        <Leaf className="size-4 text-green-600" />
      ) : (
        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border-2 border-red-600"><span className="size-2 rounded-full bg-red-600" /></span>
      )}
              {item.spicyLevel > 0 && <Flame className="size-4 text-orange-500" />}
            </DialogTitle>
          </DialogHeader>

          {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-3.5" />{item.preparationTime} min</span>
            <span className="text-lg font-bold" style={{ color: primaryColor }}>{formatCurrency(basePrice)}</span>
          </div>

          {item.variants.length > 0 && (
            <div className="space-y-2">
              <Label>Size</Label>
              <div className="flex flex-wrap gap-2">
                {item.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${selectedVariant?.id === v.id ? "border-primary bg-primary/10 font-medium" : "border-border"}`}
                  >
                    {v.name} — {formatCurrency(v.price)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.addons.length > 0 && (
            <div className="space-y-2">
              <Label>Add-ons</Label>
              {item.addons.map((addon) => (
                <label key={addon.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedAddons.includes(addon.id)}
                      onCheckedChange={() => toggleAddon(addon.id)}
                    />
                    <span className="text-sm">{addon.name}</span>
                  </div>
                  <span className="text-sm font-medium">+{formatCurrency(addon.price)}</span>
                </label>
              ))}
            </div>
          )}

          {item.ingredients.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Ingredients</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {item.ingredients.map((ing) => (
                  <Badge key={ing} variant="secondary" className="text-xs">{ing}</Badge>
                ))}
              </div>
            </div>
          )}

          {item.allergens.length > 0 && (
            <p className="text-xs text-amber-600">⚠️ Contains: {item.allergens.join(", ")}</p>
          )}

          <div className="space-y-2">
            <Label>Special Instructions</Label>
            <Textarea placeholder="No onions, extra spicy..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-3 sm:justify-start">
              <Button variant="outline" size="icon" className="size-11" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                <Minus className="size-5" />
              </Button>
              <span className="w-8 text-center font-semibold text-lg">{quantity}</span>
              <Button variant="outline" size="icon" className="size-11" onClick={() => setQuantity(quantity + 1)}>
                <Plus className="size-5" />
              </Button>
            </div>
            <Button onClick={handleAdd} className="h-12 w-full px-6 text-base font-semibold sm:w-auto" style={{ backgroundColor: primaryColor }}>
              Add · {formatCurrency(totalPrice)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
