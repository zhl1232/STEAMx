import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-shell py-8">
      <section className="surface-panel overflow-hidden">
        <div className="border-b border-border/60 px-5 py-6 sm:px-6">
          <div className="h-3 w-16 rounded-full bg-muted">
            <Skeleton className="h-full w-full rounded-full" />
          </div>
          <div className="mt-4 h-10 w-48 rounded-2xl bg-muted">
            <Skeleton className="h-full w-full rounded-2xl" />
          </div>
          <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-muted">
            <Skeleton className="h-full w-full rounded-full" />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_220px]">
            <div className="h-11 rounded-2xl bg-muted">
              <Skeleton className="h-full w-full rounded-2xl" />
            </div>
            <div className="h-11 rounded-2xl bg-muted">
              <Skeleton className="h-full w-full rounded-2xl" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="surface-panel overflow-hidden rounded-[24px]">
              <div className="aspect-[16/10] bg-muted">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-4/5 rounded-full" />
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-4 w-3/4 rounded-full" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
                <div className="flex items-center gap-4 border-t border-border/60 pt-3">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
