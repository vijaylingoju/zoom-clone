import { Shimmer } from "@/components/ui/Shimmer";

/** Zoom-style home dashboard loading placeholder (image 1). */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10 px-4 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 rounded-2xl border border-black/5 bg-[#f4f4f5] p-10">
        <Shimmer className="h-10 w-48" />
        <div className="flex gap-4">
          <Shimmer className="h-16 w-16 rounded-2xl" />
          <Shimmer className="h-16 w-16 rounded-2xl" />
          <Shimmer className="h-16 w-16 rounded-2xl" />
        </div>

        <div className="mt-4 w-full space-y-6">
          <div className="space-y-3">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-full" />
          </div>
          <div className="space-y-3">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
