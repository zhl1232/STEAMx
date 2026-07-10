import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCardSkeleton } from "@/components/ui/loading-skeleton";

function MobileLikedProjectsSkeleton() {
  return (
    <div className="page-shell pb-24 pt-6 md:hidden">
      <div className="sticky top-[calc(var(--mobile-global-header-height,3rem)+env(safe-area-inset-top))] z-30 border-b border-border/70 bg-background/92 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md supports-backdrop-filter:bg-background/80">
        <div className="relative min-h-12 px-4 py-1">
          <Skeleton className="absolute left-4 top-1/2 h-9 w-9 -translate-y-1/2 rounded-sm" />
          <div className="flex min-h-10 items-center pl-10">
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>

      <div className="space-y-6 pt-6">
        <section className="surface-panel overflow-hidden">
          <div className="px-6 py-5">
            <Skeleton className="h-7 w-14 rounded-full" />
            <Skeleton className="mt-3 h-4 w-52 rounded-full" />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <ProjectCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DesktopLikedProjectsSkeleton() {
  return (
    <div className="hidden md:block">
      <div className="page-shell pb-24 pt-6 md:py-8">
        <div className="space-y-6">
          <section className="surface-panel overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5">
              <Skeleton className="h-10 w-10 rounded-sm" />
              <div className="min-w-0">
                <Skeleton className="h-7 w-14 rounded-full" />
                <Skeleton className="mt-2 h-4 w-64 rounded-full" />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <ProjectCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileLikedProjectsSkeleton() {
  return (
    <>
      <MobileLikedProjectsSkeleton />
      <DesktopLikedProjectsSkeleton />
    </>
  );
}
