import { notFound } from "next/navigation";
import { getPublicMenu } from "@/actions/public-menu";
import { CartClient } from "@/components/features/menu/cart-client";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ tableParam: string }>;
}

export default async function CartPage({ params }: Props) {
  const { tableParam } = await params;
  const data = await getPublicMenu(tableParam);

  if (!data) notFound();

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });

  return (
    <CartClient
      tableParam={tableParam}
      gstPercentage={Number(settings?.gstPercentage ?? 5)}
      serviceChargePercentage={Number(settings?.serviceChargePercentage ?? 0)}
      primaryColor={settings?.primaryColor ?? "#E11D48"}
      restaurantName={settings?.restaurantName ?? "Restaurant"}
    />
  );
}
