import { Skeleton } from "@/components/ui/skeleton";

export default function OrderLoading() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="border-b border-border/60 px-4 py-6 text-center">
        <Skeleton className="mx-auto h-7 w-40" />
        <Skeleton className="mx-auto mt-1 h-4 w-32" />
      </div>
      <div className="mx-auto max-w-lg space-y-6 p-4">
        <div className="rounded-xl border border-border/60 p-5">
          <Skeleton className="mb-4 h-5 w-28" />
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 p-5">
          <Skeleton className="mb-3 h-5 w-28" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
