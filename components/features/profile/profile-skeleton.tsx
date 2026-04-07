function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[20px] bg-muted ${className}`} />
}

function MobileProfileSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-24 md:hidden">
      <div className="px-4 pt-4">
        <section className="surface-panel overflow-hidden">
          <div className="relative overflow-hidden px-4 pb-4 pt-4">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(166,193,238,0.18),transparent_60%),radial-gradient(circle_at_80%_20%,rgba(251,194,235,0.16),transparent_40%),radial-gradient(circle_at_20%_80%,rgba(166,193,238,0.08),transparent_50%)]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <SkeletonBlock className="h-9 w-24 rounded-full bg-muted/90" />
                <div className="flex gap-1.5">
                  <SkeletonBlock className="h-9 w-9 rounded-full bg-muted/90" />
                  <SkeletonBlock className="h-9 w-9 rounded-full bg-muted/90" />
                </div>
              </div>

              <div className="mt-7 flex flex-col items-center">
                <div className="relative">
                  <SkeletonBlock className="h-[88px] w-[88px] rounded-full bg-muted/90" />
                  <SkeletonBlock className="absolute -bottom-1.5 left-1/2 h-6 w-16 -translate-x-1/2 rounded-full bg-muted/95" />
                </div>

                <div className="mt-4 flex w-full flex-col items-center">
                  <SkeletonBlock className="h-6 w-32 rounded-full bg-muted/90" />
                  <SkeletonBlock className="mt-3 h-4 w-52 rounded-full bg-muted/80" />
                  <SkeletonBlock className="mt-2 h-4 w-44 rounded-full bg-muted/80" />

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <SkeletonBlock className="h-8 w-20 rounded-full bg-muted/90" />
                    <SkeletonBlock className="h-8 w-20 rounded-full bg-muted/90" />
                  </div>
                </div>

                <div className="mt-5 w-full overflow-hidden rounded-2xl border border-border/50 bg-background/60 backdrop-blur-sm">
                  <div className="grid grid-cols-4 divide-x divide-border/40">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="px-2 py-3 text-center">
                        <SkeletonBlock className="mx-auto h-5 w-10 rounded-full bg-muted/90" />
                        <SkeletonBlock className="mx-auto mt-2 h-3 w-8 rounded-full bg-muted/75" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="surface-subtle p-4">
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock className="h-4 w-24 rounded-full bg-muted/90" />
                <SkeletonBlock className="h-4 w-12 rounded-full bg-muted/80" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-8 w-8 rounded-full bg-muted/85" />
                ))}
              </div>
              <div className="mt-4 border-t border-border/60 pt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <SkeletonBlock className="h-3 w-16 rounded-full bg-muted/80" />
                  <SkeletonBlock className="h-3 w-14 rounded-full bg-muted/80" />
                </div>
                <SkeletonBlock className="h-3 w-full rounded-full bg-muted/85" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-4 px-4 py-4">
        <section className="surface-panel rounded-[28px] p-5">
          <SkeletonBlock className="h-5 w-28 rounded-full bg-muted/90" />
          <SkeletonBlock className="mt-4 h-[260px] w-full rounded-[24px] bg-muted/85" />
        </section>
      </div>
    </div>
  )
}

function DesktopProfileSkeleton() {
  return (
    <div className="hidden md:block">
      <div className="page-shell py-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
          <div className="space-y-6">
            <section className="surface-panel overflow-hidden">
              <div className="px-6 py-7 sm:px-7 sm:py-8 lg:px-8">
                <SkeletonBlock className="h-3 w-16 rounded-full" />
                <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-center">
                  <div className="relative mx-auto shrink-0 xl:mx-0">
                    <SkeletonBlock className="h-28 w-28 rounded-full md:h-32 md:w-32" />
                    <SkeletonBlock className="absolute -bottom-2 -right-1 h-9 w-20 rounded-full" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <SkeletonBlock className="h-8 w-40 rounded-full" />
                        <SkeletonBlock className="mt-4 h-4 w-full max-w-xl rounded-full" />
                        <SkeletonBlock className="mt-2 h-4 w-2/3 max-w-md rounded-full" />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <SkeletonBlock className="h-11 w-32 rounded-2xl" />
                        <SkeletonBlock className="h-11 w-28 rounded-2xl" />
                        <SkeletonBlock className="h-11 w-28 rounded-2xl" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="surface-subtle rounded-[22px] border border-transparent px-4 py-4">
                          <SkeletonBlock className="h-6 w-12 rounded-full" />
                          <SkeletonBlock className="mt-2 h-3 w-14 rounded-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="surface-panel p-6">
              <SkeletonBlock className="h-5 w-28 rounded-full" />
              <SkeletonBlock className="mt-4 h-[320px] w-full rounded-[24px]" />
            </section>
          </div>

          <aside className="space-y-6">
            <section className="surface-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-3">
                  <SkeletonBlock className="h-3 w-16 rounded-full" />
                  <SkeletonBlock className="h-8 w-36 rounded-full" />
                </div>
                <SkeletonBlock className="h-4 w-14 rounded-full" />
              </div>
              <SkeletonBlock className="mt-4 h-4 w-32 rounded-full" />
              <SkeletonBlock className="mt-6 h-3 w-full rounded-full" />
            </section>

            <section className="surface-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-3">
                  <SkeletonBlock className="h-3 w-16 rounded-full" />
                  <SkeletonBlock className="h-8 w-40 rounded-full" />
                </div>
                <SkeletonBlock className="h-4 w-12 rounded-full" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-8 w-8 rounded-full" />
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <>
      <MobileProfileSkeleton />
      <DesktopProfileSkeleton />
    </>
  )
}
