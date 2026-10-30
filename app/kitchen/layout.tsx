import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { canAccessKitchen } from "@/lib/roles";
import { getDefaultRouteForRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/kitchen");
  if (!canAccessKitchen(user.role)) redirect(getDefaultRouteForRole(user.role));
  return <>{children}</>;
}
