"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/roles";
import { createStaffAccountSchema } from "@/schemas";
import { updateStaffAccountSchema } from "@/schemas";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";

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
        isActive: true,
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
  role: Role;
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
    await prisma.$transaction(async (tx) => {
      await tx.adminUser.create({
        data: {
          id: authData.user.id,
          email: parsed.data.email,
          name: parsed.data.name,
          role: parsed.data.role,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorEmail: admin.email,
          action: "STAFF_ACCOUNT_CREATED",
          entityType: "AdminUser",
          entityId: authData.user.id,
          details: { role: parsed.data.role },
        },
      });
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

export async function updateStaffAccount(rawData: {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}) {
  const owner = await requireAdmin();
  if (!owner) return { error: "Unauthorized" as const };

  const parsed = updateStaffAccountSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  if (parsed.data.id === owner.id && !parsed.data.isActive) {
    return { error: "You cannot deactivate your own account." as const };
  }
  if (
    parsed.data.id === owner.id &&
    parsed.data.role !== Role.RESTAURANT_OWNER
  ) {
    return { error: "You cannot change your own Restaurant Owner role." as const };
  }

  const account = await prisma.adminUser.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!account) return { error: "Staff account not found." as const };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error: "Staff account updates require the server-side Supabase service key.",
    };
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (account.email !== parsed.data.email || account.name !== parsed.data.name) {
    const { error } = await supabase.auth.admin.updateUserById(account.id, {
      email: parsed.data.email,
      email_confirm: true,
      user_metadata: { name: parsed.data.name },
    });
    if (error) return { error: error.message };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: account.id },
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          role: parsed.data.role,
          isActive: parsed.data.isActive,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: owner.id,
          actorEmail: owner.email,
          action: "STAFF_ACCOUNT_UPDATED",
          entityType: "AdminUser",
          entityId: account.id,
          details: {
            previousRole: account.role,
            role: parsed.data.role,
            previousIsActive: account.isActive,
            isActive: parsed.data.isActive,
          },
        },
      });
    });
  } catch (error) {
    console.error("updateStaffAccount database error:", error);
    if (account.email !== parsed.data.email || account.name !== parsed.data.name) {
      const { error: rollbackError } = await supabase.auth.admin.updateUserById(
        account.id,
        {
          email: account.email,
          email_confirm: true,
          user_metadata: { name: account.name },
        }
      );
      if (rollbackError) {
        console.error("updateStaffAccount auth rollback error:", rollbackError.message);
        return {
          error: "The auth profile changed but the staff record could not be updated or rolled back. Contact support.",
        };
      }
    }
    return { error: "Failed to update staff account." as const };
  }

  revalidatePath("/dashboard/staff");
  return { success: true as const };
}

export async function sendStaffPasswordReset(email: string) {
  const owner = await requireAdmin();
  if (!owner) return { error: "Unauthorized" as const };

  const normalizedEmail = email.trim().toLowerCase();
  const account = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });
  if (!account) return { error: "Staff account not found." as const };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");
  if (!supabaseUrl || !anonKey || !appUrl) {
    return {
      error: "Password reset requires Supabase public configuration and NEXT_PUBLIC_APP_URL.",
    };
  }

  const supabase = createSupabaseClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.resetPasswordForEmail(account.email, {
    redirectTo: `${appUrl}/reset-password`,
  });
  if (error) return { error: error.message };

  await prisma.auditLog.create({
    data: {
      actorId: owner.id,
      actorEmail: owner.email,
      action: "STAFF_PASSWORD_RESET_REQUESTED",
      entityType: "AdminUser",
      entityId: account.id,
    },
  });

  return { success: true as const };
}
