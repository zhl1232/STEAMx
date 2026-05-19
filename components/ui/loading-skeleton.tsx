import { ArrowLeft } from "lucide-react"

import { MobilePageHeader } from "@/components/ui/mobile-page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Surface } from "@/components/ui/surface"
import { cn } from "@/lib/utils"

export function ProjectCardSkeleton({ variant = "featured" }: { variant?: "featured" | "compact" } = {}) {
  if (variant === "compact") {
    return (
      <div className="h-full">
        <div className="surface-card surface-card-interactive relative grid h-full grid-cols-[128px_minmax(0,1fr)] gap-3 overflow-hidden rounded-[16px] p-2.5 sm:flex sm:flex-col sm:gap-0 sm:p-0">
          <div className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-muted sm:aspect-[16/8.5] sm:rounded-none">
            <Skeleton className="h-full w-full rounded-none" />
            <div className="pointer-events-none absolute bottom-1.5 right-1.5">
              <Skeleton className="h-4 w-12 rounded-full bg-black/35" />
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-2 py-0.5 sm:flex-1 sm:p-3.5">
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-5 w-[88%] rounded-md sm:h-6 sm:w-3/4" />
              <Skeleton className="h-5 w-[65%] rounded-md sm:hidden" />
              <div className="flex min-w-0 items-center gap-1.5">
                <Skeleton className="h-5 w-10 shrink-0 rounded-md" />
                <Skeleton className="h-3 min-w-0 flex-1 max-w-[6.5rem] rounded-full" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-[92%] rounded-full" />
              <Skeleton className="h-3 w-[70%] rounded-full" />
            </div>

            <div className="flex items-center gap-3 sm:mt-auto">
              <Skeleton className="h-3 w-7 rounded-full" />
              <Skeleton className="h-3 w-7 rounded-full" />
              <Skeleton className="h-3.5 w-8 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="surface-card overflow-hidden rounded-[var(--radius-lg)]">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        <Skeleton className="h-full w-full rounded-none" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="flex min-w-0 flex-wrap gap-2">
            <Skeleton className="h-6 w-14 rounded-full bg-white/20" />
            <Skeleton className="h-6 w-20 rounded-full bg-white/15" />
          </div>
          <Skeleton className="h-7 w-16 shrink-0 rounded-full bg-black/25" />
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-4/5 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-3/4 rounded-full" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        <div className="flex items-center gap-4 border-t border-border/60 pt-3">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/**
 * 与 `ExploreClient` 主面板顶部一致：搜索 / 排序 / 筛选 + 类别条 + 移动端难度条。
 * 外层需包在 `surface-panel` 内（含 `border-b` 容器）。
 */
export function ExploreToolbarSkeleton() {
  const categoryWidths = ["w-[76px]", "w-[76px]", "w-[76px]", "w-[76px]", "w-[76px]", "w-[76px]", "w-[76px]"]

  return (
    <div className="border-b border-[hsl(var(--surface-border))] p-3.5 md:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 md:grid-cols-[minmax(0,1fr)_176px_auto] md:gap-3">
        <Skeleton className="hidden h-11 w-full rounded-[12px] md:block" />
        <Skeleton className="h-9 w-full rounded-[12px] md:h-11 md:rounded-[12px]" />
        <Skeleton className="h-9 w-[100px] shrink-0 rounded-[12px] md:h-11 md:w-[100px]" />
      </div>
      <div className="no-scrollbar mt-4 overflow-x-auto md:mt-4">
        <div className="flex min-w-max items-center gap-2 pb-3 md:min-w-0 md:flex-wrap md:gap-3 md:border-b-0 md:pb-0">
          {categoryWidths.map((width, index) => (
            <Skeleton
              key={index}
              className={`h-9 shrink-0 rounded-full md:rounded-[10px] ${width}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-3 md:mt-4 md:border-t md:border-[hsl(var(--surface-border))] md:pt-4">
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-8 rounded-full" />
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-8 shrink-0 rounded-full" />
              ))}
            </div>
          </div>
          <Skeleton className="h-3 w-10 rounded-full" />
        </div>
        <div className="md:hidden">
          <Skeleton className="h-9 w-[8.5rem] rounded-[12px]" />
        </div>
      </div>
    </div>
  )
}

function ExploreSidebarSkeleton() {
  return (
    <aside className="hidden min-w-0 xl:block">
      <div className="sticky top-24 flex h-full min-h-0 flex-col gap-4">
        <Surface className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-4 w-14 rounded-md" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-[4.5rem] rounded-[9px]" />
            ))}
          </div>
        </Surface>
        <Surface className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
            <Skeleton className="min-h-[92px] rounded-[10px]" />
            <div className="flex min-w-0 flex-col gap-2 pt-0.5">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-4/5 rounded-full" />
              <Skeleton className="mt-2 h-8 w-24 rounded-[10px]" />
            </div>
          </div>
        </Surface>
        <Surface className="p-4">
          <Skeleton className="h-14 w-full rounded-xl" />
        </Surface>
      </div>
    </aside>
  )
}

/**
 * 与 `ExploreClient` 内 `MobileGlobalHeader variant="search"` 一致（探索路由在壳层不挂全局移动头）。
 * 仅 `md:hidden`，桌面端由 `ConditionalAppShell` 的顶栏承担。
 */
function ExploreMobileSearchHeaderSkeleton() {
  return (
    <header
      aria-hidden="true"
      className="app-mobile-header"
    >
      <div className="flex h-[3.75rem] items-center px-4 min-[390px]:px-5">
        <div className="mr-2 shrink-0">
          <Skeleton className="h-8 w-8 rounded-xl" />
        </div>
        <div className="min-w-0 flex-1">
          <Skeleton className="h-10 w-full rounded-[14px]" />
        </div>
        <nav className="ml-2 flex shrink-0 items-center justify-end gap-1.5 min-[390px]:gap-2">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        </nav>
      </div>
    </header>
  )
}

/** 与 `ExploreClient` 画布、max-w-[1840px]、双栏与项目网格（含 ≥1400px 四列）对齐 */
export function ExplorePageSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="app-canvas-explore relative min-h-[calc(100vh-var(--mobile-global-header-height,4rem))] overflow-hidden pb-3 md:min-h-[calc(100vh-4rem)] md:pb-8">
      <ExploreMobileSearchHeaderSkeleton />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,hsl(var(--app-canvas)/0.98)_0%,hsl(var(--app-canvas-soft)/0.72)_56%,hsl(var(--app-canvas-soft)/0)_100%)] md:h-[560px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-95 dark:hidden md:h-[560px]"
        style={{
          backgroundImage: "url('/assets/explore-page-bg-light.webp')",
          backgroundPosition: "right top",
          backgroundRepeat: "no-repeat",
          backgroundSize: "max(100%, 1840px) auto",
          maskImage: "linear-gradient(180deg, black 0%, black 72%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, black 72%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[420px] opacity-95 dark:block md:h-[560px]"
        style={{
          backgroundImage: "url('/assets/explore-page-bg-dark.webp')",
          backgroundPosition: "right top",
          backgroundRepeat: "no-repeat",
          backgroundSize: "max(100%, 1840px) auto",
          maskImage: "linear-gradient(180deg, black 0%, black 72%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, black 72%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[260px] h-[460px] bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--brand-blue)/0.16),hsl(var(--app-canvas-soft)/0)_64%)] md:top-[300px] md:h-[560px]"
      />

      <div className="relative z-10">
        <div className="app-shell-wide min-w-0 pt-3 min-[390px]:px-5 md:px-8 md:pt-5">
          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <main className="surface-panel relative min-w-0 overflow-hidden rounded-[22px] md:rounded-[20px]">
              <h1 className="sr-only">探索项目</h1>
              <ExploreToolbarSkeleton />
              <div className="p-4 md:p-5">
                <div className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1400px]:grid-cols-4">
                  {Array.from({ length: count }).map((_, index) => (
                    <ProjectCardSkeleton key={index} variant="compact" />
                  ))}
                </div>
              </div>
            </main>
            <ExploreSidebarSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

/** 与 `ExplorationRecordCard`（详情页横向卡片）一致 */
export function ExplorationRecordCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "min-w-[178px] shrink-0 snap-start overflow-hidden rounded-[12px] border border-[hsl(var(--surface-border)/0.86)] bg-background/86 shadow-sm",
        className,
      )}
    >
      <div className="p-2.5">
        <div className="mb-2 flex items-center gap-2">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16 rounded-full" />
            <Skeleton className="h-2.5 w-12 rounded-full" />
          </div>
        </div>
        <Skeleton className="aspect-[4/3] w-full rounded-[10px]" />
        <Skeleton className="mt-2 h-3 w-full rounded-full" />
        <Skeleton className="mt-1.5 h-3 w-[88%] rounded-full" />
        <Skeleton className="mt-2 h-3.5 w-10 rounded-full" />
      </div>
    </div>
  )
}

/** 与 `ProjectExplorationRecordsBlock` 横向列表 +「查看全部」链接一致 */
export function ProjectExplorationRecordsBlockSkeleton({ cardCount = 3 }: { cardCount?: number }) {
  return (
    <div>
      <div className="-mx-4 flex snap-x gap-3 overflow-hidden px-4 pb-1">
        {Array.from({ length: cardCount }).map((_, index) => (
          <ExplorationRecordCardSkeleton key={index} />
        ))}
      </div>
      <Skeleton className="mx-auto mt-3 h-4 w-36 rounded-full" />
    </div>
  )
}

/** 与 `ExplorationRecordFeedCard` standalone 一致 */
export function ExplorationRecordFeedCardSkeleton({ nested = false }: { nested?: boolean }) {
  return (
    <article
      className={cn(
        nested
          ? "bg-transparent p-3.5"
          : "rounded-[14px] border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] p-3.5 shadow-sm",
      )}
    >
      {nested ? (
        <div className="mb-2 flex gap-2">
          <Skeleton className="h-3 w-14 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-full" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </div>
      ) : (
        <header className="flex items-start gap-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-3 w-36 rounded-full" />
          </div>
        </header>
      )}
      <Skeleton className={cn("h-4 w-full rounded-full", nested ? "mt-2" : "mt-3")} />
      <Skeleton className="mt-2 h-4 w-4/5 rounded-full" />
      <Skeleton className="mt-3 h-44 w-full rounded-[10px]" />
      <div className="mt-3 flex gap-5 border-t border-[hsl(var(--surface-border)/0.7)] pt-2.5">
        <Skeleton className="h-4 w-10 rounded-full" />
        <Skeleton className="h-4 w-10 rounded-full" />
      </div>
    </article>
  )
}

/** 与 `ExplorationRecordGroupCard` 一致 */
export function ExplorationRecordGroupCardSkeleton() {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] shadow-sm">
      <header className="flex items-center gap-2.5 border-b border-[hsl(var(--surface-border)/0.7)] px-3.5 py-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-3 w-32 rounded-full" />
        </div>
      </header>
      <ExplorationRecordFeedCardSkeleton nested />
    </section>
  )
}

function ProjectDetailMobileSectionSkeleton({ titleWidth = "w-24" }: { titleWidth?: string }) {
  return (
    <section className="rounded-[14px] border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
      <Skeleton className={cn("mb-3 h-5 rounded-full", titleWidth)} />
      <Skeleton className="h-4 w-full rounded-full" />
      <Skeleton className="mt-2 h-4 w-5/6 rounded-full" />
    </section>
  )
}

function ProjectDetailMaterialsSkeleton() {
  return (
    <section className="surface-panel overflow-hidden rounded-[18px]">
      <div className="border-b border-border/60 px-5 py-5 sm:px-6">
        <Skeleton className="h-7 w-40 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-2 px-5 py-5 min-[380px]:grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:px-6 xl:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="min-h-[60px] rounded-[10px] sm:min-h-[64px]" />
        ))}
      </div>
    </section>
  )
}

function ProjectDetailStepsSkeleton() {
  return (
    <section className="surface-panel overflow-hidden rounded-[18px]">
      <div className="border-b border-border/60 px-5 py-5 sm:px-6">
        <Skeleton className="h-7 w-44 rounded-full" />
      </div>
      <div className="space-y-3 px-5 py-5 sm:px-6 sm:py-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[32px_minmax(0,1fr)] gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-[88px] rounded-[12px] sm:h-20" />
          </div>
        ))}
      </div>
    </section>
  )
}

function ProjectAuthorCardSkeleton() {
  return (
    <section className="surface-panel overflow-hidden rounded-[18px] px-5 py-5 sm:px-6">
      <Skeleton className="h-5 w-20 rounded-full" />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-[86px] rounded-[8px]" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border/60 py-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2 text-center">
            <Skeleton className="mx-auto h-3 w-14 rounded-full" />
            <Skeleton className="mx-auto h-4 w-10 rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-4 w-full rounded-full" />
      <Skeleton className="mt-2 h-4 w-4/5 rounded-full" />
    </section>
  )
}

function ProjectCommentsSectionSkeleton() {
  return (
    <section className="surface-panel hidden overflow-hidden rounded-[18px] px-4 pb-5 sm:px-6 lg:col-start-1 lg:row-start-2 lg:block">
      <div className="border-t pt-8 md:px-2 lg:px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-9 w-40 rounded-[8px]" />
        </div>
        <div className="space-y-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="border-b border-border/60 py-4 last:border-0">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 rounded-full" />
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** 与 `app/project/[id]/page.tsx` 桌面 + 移动布局一致 */
export function ProjectDetailPageSkeleton() {
  return (
    <div className="relative overflow-x-hidden bg-[hsl(var(--app-canvas))]">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_16%_0%,hsl(var(--brand-blue)/0.18),transparent_38%),radial-gradient(circle_at_85%_10%,hsl(var(--brand-green)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--app-canvas))_0%,transparent_100%)]"
      />
      <div className="app-shell-wide pb-28 pt-0 md:px-8 md:pb-14 md:pt-6">
        <div className="mb-5 hidden md:block">
          <div className="inline-flex items-center text-sm text-muted-foreground opacity-50">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回探索
          </div>
        </div>

        <div className="-mx-4 md:hidden">
          <section className="overflow-hidden rounded-b-[22px] bg-[hsl(var(--surface-raised))] shadow-[0_24px_64px_-48px_hsl(var(--surface-shadow)/0.42)]">
            <div className="relative h-[40vh] min-h-[260px] max-h-[360px] overflow-hidden bg-muted">
              <Skeleton className="h-full w-full rounded-none" />
              <div className="absolute left-4 right-4 top-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
              </div>
              <Skeleton className="absolute bottom-3 right-4 h-6 w-10 rounded-full" />
            </div>
            <div className="space-y-4 px-4 pb-5 pt-4">
              <Skeleton className="h-8 w-[88%] rounded-md" />
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="min-h-8 rounded-[8px]" />
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--surface-border)/0.72)] pt-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </div>
          </section>

          <div className="space-y-3 px-4 pb-28 pt-3">
            <ProjectDetailMobileSectionSkeleton titleWidth="w-20" />
            <section className="rounded-[14px] border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
              <Skeleton className="mb-3 h-5 w-36 rounded-full" />
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="mb-2 h-[54px] rounded-[10px] last:mb-0" />
              ))}
            </section>
            <section className="rounded-[14px] border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
              <Skeleton className="mb-3 h-5 w-24 rounded-full" />
              <ProjectExplorationRecordsBlockSkeleton />
            </section>
            <section className="rounded-[14px] border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-3 w-14 rounded-full" />
              </div>
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-[12px] border border-[hsl(var(--surface-border)/0.84)] p-2.5">
                <Skeleton className="aspect-[4/3] rounded-[10px]" />
                <div className="space-y-2 py-0.5">
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-3 w-5/6 rounded-full" />
                  <Skeleton className="h-3 w-1/2 rounded-full" />
                </div>
              </div>
            </section>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--surface-border)/0.86)] bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-10 flex-1 rounded-[10px]" />
              <Skeleton className="h-10 w-24 rounded-[10px]" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <main className="min-w-0 space-y-6">
            <section className="surface-panel hidden overflow-hidden rounded-[18px] md:block">
              <div className="lg:flex lg:items-stretch">
                <Skeleton className="min-w-0 rounded-none aspect-[16/9] sm:aspect-[16/8.6] lg:aspect-auto lg:min-h-[318px] lg:w-[42%] lg:max-w-[540px] lg:flex-none" />
                <div className="min-w-0 flex-1 p-5 sm:p-6 lg:p-8">
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-9 w-52 rounded-[10px]" />
                    <Skeleton className="h-7 w-14 rounded-[8px]" />
                    <Skeleton className="h-7 w-14 rounded-[8px]" />
                    <Skeleton className="ml-auto h-7 w-24 rounded-[8px]" />
                  </div>
                  <div className="mt-5 space-y-3">
                    <Skeleton className="h-4 w-full rounded-full" />
                    <Skeleton className="h-4 w-5/6 rounded-full" />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Skeleton className="h-7 w-20 rounded-[8px]" />
                    <Skeleton className="h-7 w-24 rounded-[8px]" />
                    <Skeleton className="h-7 w-20 rounded-[8px]" />
                  </div>
                  <div className="mt-6 grid grid-cols-4 border-t border-border/70 pt-5">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="flex justify-center gap-3 border-r border-border/70 px-4 last:border-r-0">
                        <div className="space-y-2 text-center">
                          <Skeleton className="mx-auto h-5 w-10 rounded-full" />
                          <Skeleton className="mx-auto h-3 w-12 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="hidden items-start gap-3 rounded-[10px] border border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--brand-blue)/0.045)] px-3 py-2.5 sm:px-5 sm:py-4 md:flex">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-3 w-full rounded-full sm:h-4" />
              </div>
            </section>

            <div className="hidden gap-6 md:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-start xl:grid-cols-[minmax(0,1.16fr)_minmax(360px,0.84fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
              <div className="min-w-0 space-y-6">
                <ProjectDetailMaterialsSkeleton />
                <ProjectDetailStepsSkeleton />
              </div>

              <aside className="hidden min-w-0 space-y-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block">
                <ProjectAuthorCardSkeleton />
                <section className="surface-panel overflow-hidden rounded-[18px] px-5 py-5 sm:px-6">
                  <Skeleton className="mb-4 h-7 w-28 rounded-full" />
                  <ProjectExplorationRecordsBlockSkeleton />
                </section>
                <section className="surface-panel overflow-hidden rounded-[18px] p-4">
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                    <Skeleton className="aspect-[4/3] rounded-[10px]" />
                    <div className="space-y-2 py-0.5">
                      <Skeleton className="h-4 w-full rounded-full" />
                      <Skeleton className="h-3 w-5/6 rounded-full" />
                      <Skeleton className="h-8 w-20 rounded-[8px]" />
                    </div>
                  </div>
                </section>
              </aside>

              <ProjectCommentsSectionSkeleton />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

/** 与 `ProjectRecordsClient` / `RecordsPageShell` 一致 */
export function ProjectRecordsPageSkeleton() {
  return (
    <div className="relative min-h-[100dvh] bg-[hsl(var(--app-canvas))] pb-12">
      <MobilePageHeader
        title={<Skeleton className="h-5 w-48 max-w-[70vw] rounded-full" />}
        fallbackHref="/explore"
        className="sticky top-0 z-30 border-b border-[hsl(var(--surface-border)/0.7)] bg-[hsl(var(--app-canvas)/0.96)] backdrop-blur-md"
        rightSlot={<Skeleton className="h-8 w-14 rounded-full" />}
      />
      <div className="mx-auto w-full max-w-lg px-4 pt-3 md:max-w-2xl">
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="ml-auto h-8 w-[108px] rounded-full" />
        </div>
        <section className="mb-4 flex items-center gap-3 rounded-[14px] border border-[hsl(var(--brand-green)/0.22)] bg-[hsl(var(--brand-green)/0.08)] px-3.5 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36 rounded-full" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
        </section>
        <div className="space-y-3">
          <ExplorationRecordFeedCardSkeleton />
          <ExplorationRecordGroupCardSkeleton />
          <ExplorationRecordFeedCardSkeleton />
        </div>
      </div>
    </div>
  )
}

export function DiscussionItemSkeleton() {
  return (
    <div className="surface-card grid grid-cols-[112px_minmax(0,1fr)] gap-3 p-3 md:grid-cols-[220px_minmax(0,1fr)] md:gap-5 md:p-4">
      <Skeleton className="h-28 rounded-[14px] md:h-32" />
      <div className="flex min-w-0 flex-col justify-center space-y-3">
        <Skeleton className="h-5 w-4/5 rounded-full" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-2/3 rounded-full" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function ChallengeCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-[var(--radius-lg)] border-border/70 bg-card/88 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.25)]">
      <div className="aspect-[16/10] w-full">
        <Skeleton className="h-full w-full" />
      </div>
      <CardHeader className="space-y-3">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex justify-between items-center border-t border-border/60 pt-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}
