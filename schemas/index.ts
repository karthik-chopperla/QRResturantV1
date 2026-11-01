import { z } from "zod";

// ─── Order ───────────────────────────────────────────────────────────────────

const addonInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  price: z.number().optional(),
});

const variantInputSchema = z.object({
  id: z.string(),
  name: z.string().max(100),
  price: z.number().nonnegative(),
});

const cartItemSchema = z.object({
  menuItemId: z.string(),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().max(500).optional(),
  customizations: z
    .object({
      variant: variantInputSchema.nullable().optional(),
      addons: z.array(addonInputSchema).optional(),
    })
    .nullable()
    .optional(),
});

export const createOrderSchema = z.object({
  tableId: z.string(),
  customerName: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .transform((v) => v.trim()),
  customerPhone: z
    .string()
    .max(20)
    .optional()
    .or(z.literal("")),
  paymentMethod: z.enum(["RAZORPAY", "CASH"]),
  items: z.array(cartItemSchema).min(1, "Order must have at least one item"),
  couponCode: z
    .string()
    .max(50)
    .optional()
    .or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ─── Menu Item ───────────────────────────────────────────────────────────────

const variantSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.coerce.number().nonnegative(),
});

const addonSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.coerce.number().nonnegative(),
  isVeg: z.boolean().optional().default(true),
});

export const menuItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  price: z.coerce.number().nonnegative("Price must be ≥ 0"),
  discountPrice: z.coerce.number().nonnegative().nullable().optional(),
  foodType: z.enum(["VEG", "NON_VEG", "VEGAN"]),
  spicyLevel: z.coerce.number().int().min(0).max(3),
  preparationTime: z.coerce.number().int().min(0).max(999),
  images: z.array(z.string().url()).optional().default([]),
  ingredients: z.array(z.string().max(100)).optional().default([]),
  allergens: z.array(z.string().max(100)).optional().default([]),
  nutrition: z.record(z.string(), z.unknown()).nullable().optional(),
  categoryId: z.string(),
  isChefSpecial: z.boolean().optional().default(false),
  isBestSeller: z.boolean().optional().default(false),
  variants: z.array(variantSchema).optional().default([]),
  addons: z.array(addonSchema).optional().default([]),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;

// ─── Category ────────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  parentId: z.string().nullable().optional().default(null),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// ─── Table ───────────────────────────────────────────────────────────────────

export const createTableSchema = z.object({
  number: z
    .string()
    .min(1)
    .max(20)
    .regex(
      /^[A-Za-z0-9\-_]+$/,
      "Table number can only contain letters, numbers, hyphens, or underscores"
    ),
});

export const createStaffAccountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email address").transform((email) => email.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum([
    "RESTAURANT_OWNER",
    "MANAGER",
    "CASHIER",
    "SERVICE_STAFF",
    "CHEF_KITCHEN_STAFF",
    "INVENTORY_MANAGER",
    "PURCHASE_MANAGER",
    "ACCOUNTANT",
  ]),
});

// ─── Offer ───────────────────────────────────────────────────────────────────

export const offerSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50),
  title: z.string().max(200).optional().or(z.literal("")),
  discountType: z.enum(["PERCENTAGE", "FLAT"]),
  discountValue: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().nonnegative().optional().default(0),
  expiryDate: z.string().min(1),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export type OfferInput = z.infer<typeof offerSchema>;

// ─── Settings ────────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  restaurantName: z.string().min(1).max(200),
  logo: z.string().nullable().optional().or(z.literal("")),
  banner: z.string().nullable().optional().or(z.literal("")),
  address: z.string().max(500).nullable().optional().or(z.literal("")),
  phone: z.string().max(20).nullable().optional().or(z.literal("")),
  email: z.string().nullable().optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional()
    .default("#DC2626"),
  currency: z.string().length(3).optional().default("INR"),
  timezone: z.string().max(100).optional().default("Asia/Kolkata"),
  gstNumber: z.string().max(20).nullable().optional().or(z.literal("")),
  gstPercentage: z.coerce.number().min(0).max(100),
  serviceChargePercentage: z.coerce.number().min(0).max(100),
  openingHours: z.record(z.string(), z.unknown()).nullable().optional(),
  socialLinks: z.record(z.string(), z.string()).nullable().optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
