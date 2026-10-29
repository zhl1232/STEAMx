import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCardSkeleton } from "@/components/ui/loading-skeleton";

function MobileLikedProjectsSkeleton() {
  return (
    <div className="app-shell-wide pb-24 pt-6 md:hidden">
      <MobilePageHeader title="获赞" fallbackHref="/profile" />

      <div className="space-y-6">
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
      <div className="app-shell-wide pb-24 pt-6 md:py-8">
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
