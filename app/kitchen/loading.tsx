import { Skeleton } from "@/components/ui/skeleton";

export default function KitchenLoading() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center gap-3 border-b border-border/60 px-6 py-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="ml-auto h-6 w-28" />
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border-t-4 border-muted bg-card p-3">
            <Skeleton className="mb-3 h-5 w-28" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="rounded-xl border border-border/60 p-4">
                  <Skeleton className="mb-2 h-5 w-24" />
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
