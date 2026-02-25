import { ProjectCardSkeleton } from '@/components/ui/loading-skeleton'

export default function Loading() {
    return (
        <div className="container mx-auto py-4 md:py-8 px-4">
            <div className="flex flex-col gap-6 mb-6 md:mb-8">
                <div className="flex flex-col items-start gap-4 md:flex-row md:justify-between md:items-center">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">探索项目</h1>
                        <p className="text-sm md:text-base text-muted-foreground">探索社区中最酷的 STEAM 创意。</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <ProjectCardSkeleton key={`skeleton-${i}`} />
                ))}
            </div>
        </div>
    )
}
