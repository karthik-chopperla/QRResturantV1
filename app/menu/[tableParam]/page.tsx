import { notFound } from "next/navigation";
import { getPublicMenu } from "@/actions/public-menu";
import { MenuClient } from "@/components/features/menu/menu-client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ tableParam: string }>;
}

export default async function MenuPage({ params }: Props) {
  const { tableParam } = await params;
  const data = await getPublicMenu(tableParam);

  if (!data) notFound();

  return <MenuClient data={data} tableParam={tableParam} />;
}
