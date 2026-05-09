import { Skeleton } from "@/components/ui/skeleton"

export function LeaderboardItemSkeleton() {
    return (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-b border-border/30 px-4 py-3 sm:grid-cols-[64px_minmax(0,1fr)_96px_132px] xl:grid-cols-[72px_minmax(220px,1fr)_112px_150px_minmax(220px,0.72fr)] xl:px-5">
            <div className="flex items-center justify-center">
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="flex min-w-0 items-center gap-3 xl:gap-4">
                <Skeleton className="h-11 w-11 shrink-0 rounded-full xl:h-12 xl:w-12" />
                <div className="min-w-0 space-y-2">
                    <Skeleton className="h-4 w-24 rounded-md sm:w-32" />
                    <Skeleton className="h-3 w-20 rounded-md sm:w-28" />
                </div>
            </div>
            <div className="hidden justify-center sm:flex xl:hidden">
                <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <div className="hidden justify-center xl:flex">
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="space-y-1 text-right">
                <Skeleton className="ml-auto h-6 w-12 rounded-md sm:w-16" />
                <Skeleton className="ml-auto h-3 w-12 rounded-md" />
            </div>
            <div className="hidden justify-end gap-2 xl:flex">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>
        </div>
    )
}
