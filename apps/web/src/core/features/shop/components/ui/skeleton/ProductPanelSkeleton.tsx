import { Skeleton } from "@/core/components/shadcn/ui/skeleton/skeleton";

export function ProductPanelSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="در حال بارگذاری موجودی"
      className="bg-card grid gap-8 rounded-lg p-6 sm:grid-cols-[1fr_auto] sm:p-10"
    >
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-40" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-14 w-full sm:w-56" />
    </section>
  );
}
