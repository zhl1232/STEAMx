import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

export function ProjectCardSkeleton() {
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="aspect-video w-full">
        <Skeleton className="h-full w-full" />
      </div>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="flex-1">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
      <CardFooter className="flex justify-between">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardFooter>
    </Card>
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
