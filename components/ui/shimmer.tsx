import { cn } from "@/lib/utils";

interface ShimmerProps {
  className?: string;
}

export function Shimmer({ className }: ShimmerProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  );
}

export function ShimmerCard() {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <Shimmer className="mb-3 h-36 w-full" />
      <Shimmer className="mb-2 h-4 w-3/4" />
      <Shimmer className="mb-2 h-3 w-1/2" />
      <Shimmer className="h-5 w-1/3" />
    </div>
  );
}

export function ShimmerTable() {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <Shimmer className="h-4 flex-1" />
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-32" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Shimmer className="h-4 flex-1" />
          <Shimmer className="h-4 w-20" />
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ShimmerStatsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/60 p-4">
          <Shimmer className="mb-2 h-3 w-24" />
          <Shimmer className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}
