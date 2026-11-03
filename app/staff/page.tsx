import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getCurrentUser, signOut } from "@/actions/auth";
import { getDefaultRouteForRole, roleLabels } from "@/lib/roles";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function signOutAndRedirect() {
  "use server";
  const result = await signOut();
  if ("error" in result) throw new Error(result.error);
  redirect("/login");
}

export default async function StaffHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/staff");

  if (
    user.role === Role.RESTAURANT_OWNER ||
    user.role === Role.CHEF_KITCHEN_STAFF ||
    user.role === Role.MANAGER ||
    user.role === Role.CASHIER ||
    user.role === Role.SERVICE_STAFF ||
    user.role === Role.INVENTORY_MANAGER ||
    user.role === Role.PURCHASE_MANAGER ||
    user.role === Role.ACCOUNTANT
  ) {
    redirect(getDefaultRouteForRole(user.role));
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <section className="w-full max-w-lg space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">DineDesk staff portal</p>
        <h1 className="text-2xl font-semibold">
          Welcome, {user.name || user.email}
        </h1>
        <p className="inline-flex rounded-full bg-muted px-3 py-1 text-sm font-medium">
          {roleLabels[user.role]}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Your account is active. Role-specific screens and permissions will be
          enabled after the responsibilities for this role are configured.
          Contact your Restaurant Owner if you need access to a task now.
        </p>
        <form action={signOutAndRedirect}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </section>
    </main>
  );
}
