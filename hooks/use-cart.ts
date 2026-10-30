import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  notes?: string;
  foodType: "VEG" | "NON_VEG" | "VEGAN";
  customizations?: {
    variant?: {
      id: string;
      name: string;
      price: number;
    } | null;
    addons?: Array<{
      id: string;
      name: string;
      price: number;
    }>;
  } | null;
}

interface Coupon {
  code: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  minOrderAmount: number;
}

interface CartStore {
  items: CartItem[];
  tableId: string;
  tableNumber: string;
  notes: string;
  coupon: Coupon | null;

  setTable: (tableId: string, tableNumber: string) => void;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setNotes: (notes: string) => void;
  applyCoupon: (coupon: Coupon) => void;
  removeCoupon: () => void;
  clearCart: () => void;

  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getGstAmount: (gstPercentage: number) => number;
  getServiceChargeAmount: (serviceChargePercentage: number) => number;
  getTotalAmount: (gstPercentage: number, serviceChargePercentage: number) => number;
}

const generateCompositeId = (
  menuItemId: string,
  customizations?: CartItem["customizations"]
) => {
  const variantPart = customizations?.variant?.id || "novariant";
  const addonsPart = (customizations?.addons || [])
    .map((a) => a.id)
    .sort()
    .join("-") || "noaddons";
  return `${menuItemId}-${variantPart}-${addonsPart}`;
};

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      tableId: "",
      tableNumber: "",
      notes: "",
      coupon: null,

      setTable: (tableId, tableNumber) =>
        set({ tableId, tableNumber }),

      addItem: (newItem) => {
        const id = generateCompositeId(newItem.menuItemId, newItem.customizations);
        const items = get().items;
        const existingItemIndex = items.findIndex((item) => item.id === id);

        if (existingItemIndex > -1) {
          const updatedItems = [...items];
          updatedItems[existingItemIndex].quantity += newItem.quantity;
          set({ items: updatedItems });
        } else {
          set({ items: [...items, { ...newItem, id }] });
        }
      },

      removeItem: (id) =>
        set({ items: get().items.filter((item) => item.id !== id) }),

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        });
      },

      setNotes: (notes) => set({ notes }),

      applyCoupon: (coupon) => set({ coupon }),
      removeCoupon: () => set({ coupon: null }),
      clearCart: () => set({ items: [], notes: "", coupon: null }),

      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          const basePrice = item.price;
          const addonsPrice = (item.customizations?.addons || []).reduce(
            (sum, a) => sum + a.price,
            0
          );
          return total + (basePrice + addonsPrice) * item.quantity;
        }, 0);
      },

      getDiscountAmount: () => {
        const coupon = get().coupon;
        if (!coupon) return 0;
        const subtotal = get().getSubtotal();
        if (subtotal < coupon.minOrderAmount) return 0;

        if (coupon.discountType === "PERCENTAGE") {
          return Math.round((subtotal * coupon.discountValue) / 100 * 100) / 100;
        } else {
          return Math.min(coupon.discountValue, subtotal);
        }
      },

      getGstAmount: (gstPercentage) => {
        const taxableAmount = Math.max(0, get().getSubtotal() - get().getDiscountAmount());
        return Math.round((taxableAmount * gstPercentage) / 100 * 100) / 100;
      },

      getServiceChargeAmount: (serviceChargePercentage) => {
        const taxableAmount = Math.max(0, get().getSubtotal() - get().getDiscountAmount());
        return Math.round((taxableAmount * serviceChargePercentage) / 100 * 100) / 100;
      },

      getTotalAmount: (gstPercentage, serviceChargePercentage) => {
        const subtotal = get().getSubtotal();
        const discount = get().getDiscountAmount();
        const taxableAmount = Math.max(0, subtotal - discount);
        const gst = get().getGstAmount(gstPercentage);
        const serviceCharge = get().getServiceChargeAmount(serviceChargePercentage);
        return Math.round((taxableAmount + gst + serviceCharge) * 100) / 100;
      },
    }),
    {
      name: "qr-ordering-cart-store",
    }
  )
);
