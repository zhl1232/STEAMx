import { ArrowLeft } from 'lucide-react'

import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="relative overflow-x-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(166,193,238,0.2),transparent_42%),radial-gradient(circle_at_top_right,rgba(251,194,235,0.12),transparent_36%)]" />
      <div className="page-shell pt-8 pb-24 md:pb-10">
        <MobilePageHeader
          title="项目详情"
          fallbackHref="/explore"
          className="-mx-4 -mt-8 mb-4 md:hidden"
        />

        <div className="mb-5">
          <div className="hidden items-center text-sm text-muted-foreground opacity-50 md:inline-flex">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回探索
          </div>
        </div>

        <section className="surface-panel overflow-hidden rounded-[30px]">
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,420px)]">
            <div className="relative min-h-[260px] sm:min-h-[360px] lg:min-h-[540px]">
              <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            </div>
            <div className="border-t border-border/60 p-5 sm:p-7 lg:border-l lg:border-t-0">
              <Skeleton className="hidden h-3 w-24 rounded-full lg:block" />
              <Skeleton className="mt-3 hidden h-12 w-4/5 rounded-2xl lg:block" />

              <div className="mt-5 flex flex-wrap gap-2">
                <Skeleton className="h-7 w-16 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-14 rounded-full" />
              </div>

              <div className="mt-5 space-y-3">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
              </div>

              <div className="surface-subtle rounded-[24px] p-4">
                <Skeleton className="h-3 w-12 rounded-full" />
                <Skeleton className="mt-3 h-6 w-28 rounded-full" />
                <Skeleton className="mt-2 h-4 w-36 rounded-full" />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-border/70 p-4">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="mt-3 h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_320px]">
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, index) => (
              <section key={index} className="surface-panel overflow-hidden">
                <div className="border-b border-border/60 px-5 py-5 sm:px-7">
                  <Skeleton className="h-3 w-16 rounded-full" />
                  <Skeleton className="mt-3 h-8 w-40 rounded-full" />
                  <Skeleton className="mt-3 h-4 w-4/5 rounded-full" />
                </div>
                <div className="space-y-4 px-5 py-6 sm:px-7 sm:py-7">
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                  {index === 2 ? null : <Skeleton className="h-48 w-full rounded-[24px]" />}
                </div>
              </section>
            ))}
          </div>

          <aside className="hidden xl:block">
            <div className="space-y-6">
              {Array.from({ length: 2 }).map((_, index) => (
                <section key={index} className="surface-panel overflow-hidden">
                  <div className="border-b border-border/60 px-5 py-5">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="mt-3 h-8 w-32 rounded-full" />
                  </div>
                  <div className="space-y-3 px-5 py-6">
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  </div>
                </section>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
