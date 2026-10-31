"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/roles";
import { createStaffAccountSchema } from "@/schemas";
import { revalidatePath } from "next/cache";

export async function getStaffAccounts() {
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" as const };

  try {
    const accounts = await prisma.adminUser.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    });

    return { accounts };
  } catch (error) {
    console.error("getStaffAccounts error:", error);
    return { error: "Failed to load staff accounts." as const };
  }
}

export async function createStaffAccount(rawData: {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "KITCHEN";
}) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" as const };

  const parsed = createStaffAccountSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error:
        "Staff account creation requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.",
    };
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { name: parsed.data.name },
    });

  if (authError || !authData.user) {
    return {
      error: authError?.message || "Supabase did not return the created staff account.",
    };
  }

  try {
    await prisma.adminUser.create({
      data: {
        id: authData.user.id,
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
      },
    });
  } catch (error) {
    console.error("createStaffAccount database error:", error);
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(
      authData.user.id
    );

    if (cleanupError) {
      console.error("createStaffAccount auth cleanup error:", cleanupError.message);
      return {
        error:
          "The auth account was created but its staff record could not be saved or rolled back. Contact support before retrying.",
      };
    }

    return {
      error:
        "Could not save the staff record. The Auth account was removed; check whether this email already exists.",
    };
  }

  revalidatePath("/dashboard/staff");
  return { success: true as const };
}
