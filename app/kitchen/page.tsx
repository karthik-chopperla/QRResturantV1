import { getCurrentUser } from "@/actions/auth";
import { redirect } from "next/navigation";
import KitchenBoard from "./kitchen-board";

export default async function KitchenPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/kitchen");

  return <KitchenBoard userRole={user.role} />;
}
