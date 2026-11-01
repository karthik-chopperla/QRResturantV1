import { OrderTrackingClient } from "@/components/features/order/order-tracking";
import prisma from "@/lib/prisma";
import { generateTableToken } from "@/lib/table-token";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: Props) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { table: { select: { id: true } } },
  });

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { primaryColor: true },
  });

  const tableParam = order
    ? order.table
      ? generateTableToken(order.table.id)
      : undefined
    : undefined;
  const primaryColor = settings?.primaryColor ?? "#E11D48";

  return (
    <OrderTrackingClient
      orderId={id}
      tableParam={tableParam}
      primaryColor={primaryColor}
    />
  );
}
