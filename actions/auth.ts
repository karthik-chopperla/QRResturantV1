"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import prisma, { prismaWithRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getDefaultRouteForRole } from "@/lib/roles";
import { checkRateLimit, getServerActionIp } from "@/lib/rate-limit";
import { touchSession, clearSession, isSessionFresh } from "@/lib/session";
import { signUpSchema } from "@/schemas/auth";
import { Role } from "@prisma/client";

export async function signIn(data: { email: string; password: string }) {
  const ip = await getServerActionIp();
  const { allowed, retryAfterMs } = checkRateLimit(`signin:${ip}`, 5, 60_000);
  if (!allowed) {
    return { error: "Too many login attempts. Please try again later." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  let authData;
  try {
    const result = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    authData = result.data;
    if (result.error || !authData.user) {
      return { error: result.error?.message || "Invalid credentials." };
    }
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  let user;
  try {
    user = await prisma.adminUser.findUnique({
      where: { id: authData.user.id },
    });
    if (!user) {
      return { error: "Staff account not found." };
    }
  } catch {
    return { error: "Failed to load account information. Please try again." };
  }

  await touchSession();
  return { success: true, role: user.role };
}

export async function signUp(rawData: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const parsed = signUpSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  const ip = await getServerActionIp();
  const { allowed } = checkRateLimit(`signup:${ip}`, 3, 60 * 60_000);
  if (!allowed) {
    return { error: "Too many signup attempts. Please try again later." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error:
        "Initial admin signup requires SUPABASE_SERVICE_ROLE_KEY to be configured on the server.",
    };
  }

  const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let createdAuthUserId: string | undefined;

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(736284105)::text`;

      const existingAdmin = await tx.adminUser.findFirst({
        where: { role: Role.RESTAURANT_OWNER },
        select: { id: true },
      });
      if (existingAdmin) {
        return {
          error: "Initial admin account has already been created. Contact your administrator.",
        };
      }

      const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: { name: parsed.data.name },
      });
      if (error || !authData.user) {
        return { error: error?.message || "Failed to create account." };
      }
      createdAuthUserId = authData.user.id;

      await tx.adminUser.create({
        data: {
          id: authData.user.id,
          email: parsed.data.email,
          name: parsed.data.name,
          role: Role.RESTAURANT_OWNER,
        },
      });

      return { success: true as const };
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    console.error("signUp error:", error);
    if (createdAuthUserId) {
      const { error: cleanupError } =
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      if (cleanupError) {
        console.error("signUp auth cleanup error:", cleanupError.message);
        return {
          error:
            "The Auth account was created but setup could not finish or roll back. Contact support before retrying.",
        };
      }
    }
    return {
      error: "Failed to complete account setup. Please try again or contact support.",
    };
  }
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("signOut error:", error);
    return { error: "Failed to sign out. Please try again." };
  }
  await clearSession();
  revalidatePath("/");
  return { success: true };
}

export async function forgotPassword(email: string) {
  const ip = await getServerActionIp();
  const { allowed, retryAfterMs } = checkRateLimit(`forgot:${ip}`, 3, 60 * 60_000);
  if (!allowed) {
    return { error: "Too many reset requests. Please try again later." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  // Use the configured app URL — never derive from the Host header to prevent
  // host header injection attacks.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? undefined // force configuration in production
      : "http://localhost:3000");

  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not set in production.");
    return { error: "Server configuration error. Please contact support." };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });
    if (error) return { error: error.message };
  } catch {
    return { error: "Failed to send reset email. Please try again." };
  }

  return { success: true };
}

export async function resetPassword(password: string) {
  const ip = await getServerActionIp();
  const { allowed, retryAfterMs } = checkRateLimit(`reset:${ip}`, 3, 60 * 60_000);
  if (!allowed) {
    return { error: "Too many reset attempts. Please try again later." };
  }

  const session = await isSessionFresh();
  if (!session.fresh) {
    return { error: session.reason };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
  } catch {
    return { error: "Failed to reset password. Please try again." };
  }

  return { success: true };
}

const getDbUser = cache(async (userId: string) => {
  return prismaWithRetry(() =>
    prisma.adminUser.findUnique({ where: { id: userId } })
  );
});

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return null;

    const dbUser = await getDbUser(authUser.id);
    return dbUser;
  } catch (err) {
    unstable_rethrow(err);
    console.error("getCurrentUser error:", err);
    return null;
  }
}
