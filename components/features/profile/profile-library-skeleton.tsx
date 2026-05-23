import { ProjectListSkeleton } from "@/components/features/profile/project-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

function MobileProfileLibrarySkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-24 md:hidden">
      <div className="sticky top-[calc(var(--mobile-global-header-height,3rem)+env(safe-area-inset-top))] z-30 border-b border-border/70 bg-background/92 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="relative min-h-12 px-4 py-1">
          <Skeleton className="absolute left-4 top-1/2 h-9 w-9 -translate-y-1/2 rounded-xl" />
          <div className="flex min-h-10 items-center pl-10">
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mobile-subnav top-0 z-20">
        <div className="px-4 py-3">
          <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
            <div className="segmented-control inline-flex min-w-max gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-20 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="sr-only">加载内容库中...</p>
        <div className="space-y-4">
          <ProjectListSkeleton />
        </div>
      </div>
    </div>
  );
}

function DesktopProfileLibrarySkeleton() {
  return (
    <div className="hidden md:block">
      <div className="app-shell-wide py-8 min-[390px]:px-5 md:px-8">
        <div className="space-y-6">
          <section className="surface-panel min-h-[254px] overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 xl:px-8">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
          </section>

          <section className="surface-panel overflow-hidden">
            <div className="border-b border-border/60 px-6 py-5">
              <div className="mt-1 -mx-1 overflow-x-auto px-1 no-scrollbar">
                <div className="segmented-control inline-flex min-w-max gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-24 rounded-full" />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                <ProjectListSkeleton />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function ProfileLibrarySkeleton() {
  return (
    <>
      <MobileProfileLibrarySkeleton />
      <DesktopProfileLibrarySkeleton />
    </>
  );
}
