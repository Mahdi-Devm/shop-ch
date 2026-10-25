import { Skeleton } from "@/core/components/shadcn/ui/skeleton/skeleton";

export function OrderTrackerSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="در حال بارگذاری سفارش"
      className="bg-card space-y-6 rounded-lg p-6 sm:p-10"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-72" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </section>
  );
}
