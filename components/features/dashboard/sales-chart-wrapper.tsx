"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const SalesChart = dynamic(
  () => import("@/components/features/dashboard/sales-chart").then((m) => ({ default: m.SalesChart })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[340px] w-full rounded-xl" />,
  }
);

export function SalesChartWrapper({ data }: { data: { date: string; revenue: number }[] }) {
  return <SalesChart data={data} />;
}
