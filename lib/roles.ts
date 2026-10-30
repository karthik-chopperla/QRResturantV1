import { Role } from "@prisma/client";
import { getCurrentUser } from "@/actions/auth";

export function getDefaultRouteForRole(role: Role): string {
  switch (role) {
    case Role.KITCHEN:
      return "/kitchen";
    case Role.ADMIN:
    default:
      return "/dashboard";
  }
}

export function canAccessDashboard(role: Role): boolean {
  return role === Role.ADMIN;
}

export function canAccessKitchen(role: Role): boolean {
  return role === Role.KITCHEN || role === Role.ADMIN;
}

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}

/**
 * Returns the current user if authenticated AND has ADMIN role.
 * Returns null otherwise. Use in server actions that require admin access.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== Role.ADMIN) return null;
  return user;
}

/**
 * Returns the current user if authenticated AND has ADMIN or KITCHEN role.
 * Returns null otherwise. Use in server actions accessible to all staff.
 */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== Role.ADMIN && user.role !== Role.KITCHEN) return null;
  return user;
}
