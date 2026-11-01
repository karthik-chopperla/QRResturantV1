import { Role } from "@prisma/client";
import { getCurrentUser } from "@/actions/auth";

export function getDefaultRouteForRole(role: Role): string {
  switch (role) {
    case Role.CHEF_KITCHEN_STAFF:
      return "/kitchen";
    case Role.RESTAURANT_OWNER:
      return "/dashboard";
    case Role.MANAGER:
      return "/manager";
    case Role.SERVICE_STAFF:
      return "/service";
    case Role.CASHIER:
      return "/cashier";
    case Role.INVENTORY_MANAGER:
      return "/inventory";
    case Role.PURCHASE_MANAGER:
      return "/purchasing";
    case Role.ACCOUNTANT:
      return "/accountant";
  }
}

export function canAccessDashboard(role: Role): boolean {
  return role === Role.RESTAURANT_OWNER;
}

export function canAccessKitchen(role: Role): boolean {
  return (
    role === Role.CHEF_KITCHEN_STAFF ||
    role === Role.RESTAURANT_OWNER ||
    role === Role.MANAGER
  );
}

export function isOwner(role: Role): boolean {
  return role === Role.RESTAURANT_OWNER;
}

/**
 * Returns the current user if authenticated and has the restaurant-owner role.
 * Use in server actions reserved for the owner.
 */
export async function requireOwner() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== Role.RESTAURANT_OWNER) return null;
  return user;
}

/**
 * Existing order-board permissions remain limited to the owner and kitchen role.
 * Other roles receive no feature permissions until their responsibilities are defined.
 */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (
    user.role !== Role.RESTAURANT_OWNER &&
    user.role !== Role.CHEF_KITCHEN_STAFF
  ) {
    return null;
  }
  return user;
}

export async function requireOrdersViewer() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (
    user.role !== Role.RESTAURANT_OWNER &&
    user.role !== Role.MANAGER &&
    user.role !== Role.CASHIER &&
    user.role !== Role.SERVICE_STAFF &&
    user.role !== Role.CHEF_KITCHEN_STAFF
  ) {
    return null;
  }
  return user;
}

export async function requireOrderStatusAccess(status: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === Role.RESTAURANT_OWNER || user.role === Role.MANAGER) {
    return user;
  }
  if (
    user.role === Role.CHEF_KITCHEN_STAFF &&
    ["PREPARING", "PREPARED", "READY"].includes(status)
  ) {
    return user;
  }
  if (
    user.role === Role.SERVICE_STAFF &&
    ["SERVED", "COLLECTED"].includes(status)
  ) {
    return user;
  }
  return null;
}

export async function requireCashier() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== Role.RESTAURANT_OWNER && user.role !== Role.CASHIER) {
    return null;
  }
  return user;
}

export async function requireServiceStaff() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (
    user.role !== Role.RESTAURANT_OWNER &&
    user.role !== Role.MANAGER &&
    user.role !== Role.SERVICE_STAFF
  ) {
    return null;
  }
  return user;
}

export async function requireInventoryAccess() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (
    user.role !== Role.RESTAURANT_OWNER &&
    user.role !== Role.INVENTORY_MANAGER
  ) {
    return null;
  }
  return user;
}

export async function requirePurchaseAccess() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (
    user.role !== Role.RESTAURANT_OWNER &&
    user.role !== Role.PURCHASE_MANAGER
  ) {
    return null;
  }
  return user;
}

export async function requireAccountingAccess() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (
    user.role !== Role.RESTAURANT_OWNER &&
    user.role !== Role.ACCOUNTANT
  ) {
    return null;
  }
  return user;
}

export const requireAdmin = requireOwner;

export const roleLabels: Record<Role, string> = {
  [Role.RESTAURANT_OWNER]: "Restaurant Owner",
  [Role.MANAGER]: "Manager",
  [Role.CASHIER]: "Cashier",
  [Role.SERVICE_STAFF]: "Service Staff",
  [Role.CHEF_KITCHEN_STAFF]: "Chef / Kitchen Staff",
  [Role.INVENTORY_MANAGER]: "Inventory Manager",
  [Role.PURCHASE_MANAGER]: "Purchase Manager",
  [Role.ACCOUNTANT]: "Accountant",
};
