import { ArrowLeft } from 'lucide-react'

import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="relative overflow-x-hidden bg-[hsl(var(--app-canvas))]">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_16%_0%,hsl(var(--brand-blue)/0.16),transparent_38%),radial-gradient(circle_at_85%_10%,hsl(var(--brand-green)/0.1),transparent_34%)]" />
      <div className="mx-auto w-full max-w-[1840px] px-4 pb-36 pt-4 md:px-8 md:pb-14 md:pt-6">
        <MobilePageHeader
          title="项目详情"
          fallbackHref="/explore"
          className="-mx-4 -mt-4 mb-4 md:hidden"
          titleClassName="text-center text-lg"
          rightSlot={
            <div className="flex gap-1">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
          }
        />

        <div className="mb-5 hidden md:block">
          <div className="inline-flex items-center text-sm text-muted-foreground opacity-50">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回探索
          </div>
        </div>

        <div className="space-y-6">
          <main className="min-w-0 space-y-6">
            <section className="surface-panel overflow-hidden rounded-[18px]">
              <div className="lg:flex lg:items-stretch">
                <Skeleton className="min-w-0 rounded-none aspect-[16/9] sm:aspect-[16/8.6] lg:aspect-auto lg:min-h-[318px] lg:w-[42%] lg:max-w-[540px] lg:flex-none" />
                <div className="min-w-0 flex-1 p-5 sm:p-6 lg:p-8">
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-9 w-52 rounded-[10px]" />
                    <Skeleton className="h-7 w-14 rounded-[8px]" />
                    <Skeleton className="h-7 w-14 rounded-[8px]" />
                  </div>
                  <div className="mt-5 space-y-3">
                    <Skeleton className="h-4 w-full rounded-full" />
                    <Skeleton className="h-4 w-5/6 rounded-full" />
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Skeleton className="h-7 w-20 rounded-[8px]" />
                    <Skeleton className="h-7 w-24 rounded-[8px]" />
                    <Skeleton className="h-7 w-20 rounded-[8px]" />
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24 rounded-full" />
                      <Skeleton className="h-3 w-16 rounded-full" />
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-4 gap-0 border-t border-border/70 pt-5">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="border-r border-border/70 px-4 last:border-r-0">
                        <Skeleton className="h-6 w-10 rounded-full" />
                        <Skeleton className="mt-2 h-3 w-12 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <Skeleton className="h-[78px] rounded-[14px]" />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-start xl:grid-cols-[minmax(0,1.16fr)_minmax(360px,0.84fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
              <div className="min-w-0 space-y-6">
                <section className="surface-panel overflow-hidden rounded-[18px]">
                  <div className="border-b border-border/60 px-5 py-5 sm:px-6">
                    <Skeleton className="h-7 w-32 rounded-full" />
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-3 px-5 py-5 sm:px-6">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-[126px] rounded-[12px]" />
                    ))}
                  </div>
                </section>

                <section className="surface-panel overflow-hidden rounded-[18px]">
                  <div className="border-b border-border/60 px-5 py-5 sm:px-6">
                    <Skeleton className="h-7 w-40 rounded-full" />
                  </div>
                  <div className="space-y-3 px-5 py-5 sm:px-6">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-[86px] rounded-[14px]" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <section className="surface-panel rounded-[18px] p-5">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28 rounded-full" />
                        <Skeleton className="h-3 w-16 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-20 rounded-[8px]" />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border/60 py-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="space-y-2">
                        <Skeleton className="mx-auto h-3 w-14 rounded-full" />
                        <Skeleton className="mx-auto h-4 w-10 rounded-full" />
                      </div>
                    ))}
                  </div>
                  <Skeleton className="mt-4 h-4 w-full rounded-full" />
                  <Skeleton className="mt-2 h-4 w-4/5 rounded-full" />
                </section>
                <section className="surface-panel rounded-[18px] p-5">
                  <Skeleton className="h-7 w-32 rounded-full" />
                  <div className="mt-4 flex gap-3">
                    <Skeleton className="h-28 min-w-[150px] flex-1 rounded-[10px]" />
                    <Skeleton className="h-28 min-w-[150px] flex-1 rounded-[10px]" />
                  </div>
                </section>
                <section className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
                  <Skeleton className="mx-auto h-6 w-52 rounded-full" />
                  <Skeleton className="mx-auto mt-4 h-4 w-full max-w-sm rounded-full" />
                  <Skeleton className="mx-auto mt-2 h-4 w-4/5 max-w-xs rounded-full" />
                  <Skeleton className="mx-auto mt-5 h-10 w-36 rounded-[8px]" />
                </section>
                <section className="surface-panel rounded-[18px] p-5">
                  <Skeleton className="h-4 w-32 rounded-full" />
                  <Skeleton className="mt-4 aspect-[16/10] w-full rounded-[12px]" />
                  <Skeleton className="mt-4 h-5 w-3/4 rounded-full" />
                  <Skeleton className="mt-3 h-4 w-full rounded-full" />
                  <Skeleton className="mt-2 h-4 w-2/3 rounded-full" />
                  <Skeleton className="mt-4 h-9 w-32 rounded-[8px]" />
                </section>
              </div>

              <section className="surface-panel overflow-hidden rounded-[18px] px-4 pb-5 pt-8 sm:px-6 lg:col-start-1 lg:row-start-2">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-10 w-52 rounded-[8px]" />
                </div>
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="border-b border-border/60 pb-4 last:border-0">
                      <div className="flex gap-3">
                        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-36 rounded-full" />
                          <Skeleton className="h-4 w-full rounded-full" />
                          <Skeleton className="h-4 w-2/3 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
