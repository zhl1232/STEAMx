import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-border/70 bg-card/88 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.25)]">
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

export function ExploreToolbarSkeleton() {
  const categoryWidths = ["w-14", "w-14", "w-14", "w-14", "w-14", "w-14"]

  return (
    <div className="mobile-subnav top-0 -mx-4 mb-5 px-4 py-3 md:-mx-6 md:px-6">
      <div className="flex items-center gap-2">
        <div className="no-scrollbar flex-1 overflow-x-auto">
          <div className="inline-flex min-w-max gap-1">
            {categoryWidths.map((width, index) => (
              <Skeleton key={index} className={`h-9 shrink-0 rounded-full ${width}`} />
            ))}
          </div>
        </div>
        <Skeleton className="h-9 w-20 shrink-0 rounded-full" />
      </div>
    </div>
  )
}

export function ExplorePageSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="page-shell pb-6 md:pb-8">
      <ExploreToolbarSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, index) => (
          <ProjectCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

export function DiscussionItemSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
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
