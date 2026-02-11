import { Skeleton } from "@/components/ui/skeleton"

export function LeaderboardItemSkeleton() {
    return (
        <div className="flex items-center justify-between py-3 px-4 rounded-lg border-b border-border/30">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex items-center justify-center w-8 shrink-0">
                    <Skeleton className="h-6 w-6 rounded-md" />
                </div>
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="space-y-2 min-w-0">
                    <Skeleton className="h-4 w-20 sm:w-24 rounded-md" />
                    <Skeleton className="h-3 w-14 sm:w-20 rounded-md" />
                </div>
            </div>
            <div className="text-right space-y-1 shrink-0">
                <Skeleton className="h-6 w-12 sm:w-14 rounded-md ml-auto" />
                <Skeleton className="h-3 w-12 rounded-md ml-auto" />
            </div>
        </div>
    )
}
