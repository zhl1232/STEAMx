import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Surface } from "@/components/ui/surface"

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
    <div className="surface-card overflow-hidden rounded-[24px]">
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
      className="sticky top-0 z-50 w-full border-b border-[#dfe8f2] bg-white/92 shadow-[0_10px_36px_-28px_rgba(27,70,126,0.25)] backdrop-blur-xl pt-[env(safe-area-inset-top)] supports-[backdrop-filter]:bg-white/82 dark:border-[#243348] dark:bg-[#070b12]/94 dark:shadow-none dark:supports-[backdrop-filter]:bg-[#070b12]/84 md:hidden"
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
        <div className="mx-auto w-full min-w-0 max-w-[1840px] px-4 pt-3 min-[390px]:px-5 md:px-8 md:pt-5">
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
    <Card className="overflow-hidden rounded-[24px] border-border/70 bg-card/88 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.25)]">
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
