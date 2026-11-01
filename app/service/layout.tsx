import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { getDefaultRouteForRole } from "@/lib/roles";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/service");
  if (
    user.role !== Role.SERVICE_STAFF &&
    user.role !== Role.MANAGER &&
    user.role !== Role.RESTAURANT_OWNER
  ) {
    redirect(getDefaultRouteForRole(user.role));
  }
  return children;
}
