"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/roles";
import { settingsSchema, type SettingsInput } from "@/schemas";
import { revalidatePath } from "next/cache";
import { convertDecimalsDeep } from "@/lib/decimal";

export async function getSettings() {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });
  return convertDecimalsDeep(settings);
}

export async function updateRestaurantSettings(rawData: SettingsInput) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const parsed = settingsSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const data = parsed.data;

  try {
    const settings = await prisma.settings.update({
      where: { id: "singleton" },
      data: {
        restaurantName: data.restaurantName,
        logo: data.logo || null,
        banner: data.banner || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        primaryColor: data.primaryColor ?? "#DC2626",
        currency: data.currency ?? "INR",
        timezone: data.timezone ?? "Asia/Kolkata",
        gstNumber: data.gstNumber || null,
        gstPercentage: data.gstPercentage,
        serviceChargePercentage: data.serviceChargePercentage,
        openingHours: data.openingHours != null ? (data.openingHours as Prisma.InputJsonValue) : Prisma.JsonNull,
        socialLinks: data.socialLinks != null ? (data.socialLinks as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    revalidatePath("/dashboard/settings");
    return { success: true, settings };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update settings.";
    console.error("updateRestaurantSettings error:", error);
    return { error: msg };
  }
}
