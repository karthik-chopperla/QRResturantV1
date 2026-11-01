import type { Prisma } from "@prisma/client";
import { toNumber } from "@/lib/decimal";

type CartLine = {
  menuItemId: string;
  quantity: number;
  notes?: string;
  customizations?: {
    variant?: { id: string; name: string; price: number } | null;
    addons?: { id: string; name?: string; price?: number }[];
  } | null;
};

type AvailableMenuItem = Prisma.MenuItemGetPayload<{
  include: { variants: true; addons: true };
}>;

export function priceOrderItems(
  cartItems: CartLine[],
  menuItems: AvailableMenuItem[]
) {
  let subtotal = 0;
  const verifiedItems = cartItems.map((cartItem) => {
    const menuItem = menuItems.find((item) => item.id === cartItem.menuItemId);
    if (!menuItem) throw new Error("Menu item not found or unavailable.");

    let itemPrice =
      toNumber(menuItem.discountPrice) || toNumber(menuItem.price);
    let selectedVariant: { id: string; name: string; price: number } | null = null;
    const variantInput = cartItem.customizations?.variant;
    if (variantInput) {
      const variant = menuItem.variants.find(
        (item) => item.id === variantInput.id
      );
      if (!variant) throw new Error(`Selected option is unavailable for ${menuItem.name}.`);
      itemPrice = toNumber(variant.price);
      selectedVariant = {
        id: variant.id,
        name: variant.name,
        price: itemPrice,
      };
    }

    let addonsPrice = 0;
    const addonsDetails: { id: string; name: string; price: number }[] = [];
    for (const addonInput of cartItem.customizations?.addons ?? []) {
      const addon = menuItem.addons.find((item) => item.id === addonInput.id);
      if (!addon) throw new Error(`Selected add-on is unavailable for ${menuItem.name}.`);
      addonsPrice += toNumber(addon.price);
      addonsDetails.push({
        id: addon.id,
        name: addon.name,
        price: toNumber(addon.price),
      });
    }

    const unitPrice = itemPrice + addonsPrice;
    subtotal += unitPrice * cartItem.quantity;
    return {
      menuItemId: menuItem.id,
      quantity: cartItem.quantity,
      price: unitPrice,
      notes: cartItem.notes ?? null,
      customizations: {
        variant: selectedVariant,
        addons: addonsDetails,
      } satisfies Prisma.InputJsonValue,
    };
  });

  return { subtotal, verifiedItems };
}

export function calculateOrderTotals(
  subtotal: number,
  discountAmount: number,
  gstPercentage: number,
  serviceChargePercentage: number
) {
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount =
    Math.round(((taxableAmount * gstPercentage) / 100) * 100) / 100;
  const serviceChargeAmount =
    Math.round(((taxableAmount * serviceChargePercentage) / 100) * 100) / 100;
  const totalAmount =
    Math.round((taxableAmount + gstAmount + serviceChargeAmount) * 100) / 100;

  return { discountAmount, gstAmount, serviceChargeAmount, totalAmount };
}
