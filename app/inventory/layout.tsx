import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { getDefaultRouteForRole } from "@/lib/roles";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/inventory");
  if (
    user.role !== Role.INVENTORY_MANAGER &&
    user.role !== Role.RESTAURANT_OWNER
  ) {
    redirect(getDefaultRouteForRole(user.role));
  }
  return children;
}
