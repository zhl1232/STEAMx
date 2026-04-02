import { ProjectListSkeleton } from "@/components/features/profile/project-list-skeleton";

export function ProfileSkeleton() {
  return (
    <div className="page-shell py-8">
      <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="surface-panel overflow-hidden">
          <div className="h-36 animate-pulse bg-muted/60" />
          <div className="space-y-4 px-5 py-5">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-3 pt-2">
                <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
            <div className="h-24 animate-pulse rounded-[24px] bg-muted" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,1fr)]">
            <div className="surface-panel p-6">
              <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
              <div className="mt-5 h-12 animate-pulse rounded-2xl bg-muted" />
            </div>
            <div className="surface-panel p-6">
              <div className="h-4 w-28 animate-pulse rounded-full bg-muted" />
              <div className="mt-4 h-64 animate-pulse rounded-[24px] bg-muted" />
            </div>
          </div>

          <div className="surface-panel overflow-hidden">
            <div className="border-b border-border/60 px-6 py-5">
              <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
              <div className="mt-4 h-10 w-96 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <ProjectListSkeleton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
