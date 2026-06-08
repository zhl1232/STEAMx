"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useObservationInteractions } from "@/hooks/use-observation-interactions"
import { ObservationInteractions } from "./observation-interactions"
import { ObservationComments } from "./observation-comments"

interface ObservationSocialSectionProps {
  observationId: number
  initialLikesCount: number
  initialCommentsCount: number
  submitHref?: string
}

export function ObservationSocialSection({
  observationId,
  initialLikesCount,
  initialCommentsCount,
  submitHref,
}: ObservationSocialSectionProps) {
  const {
    liked,
    likesCount,
    commentsCount,
    isLiking,
    commentsOpen,
    toggleLike,
    toggleComments,
    increaseCommentsCount,
  } = useObservationInteractions({
    observationId,
    initialLikesCount,
    initialCommentsCount,
  })

  return (
    <>
      <section id="observation-social" className="border-t border-border/60 pt-6">
        {commentsOpen ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">评论</h2>
            <ObservationComments observationId={observationId} onCommentCreated={increaseCommentsCount} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">点击底部评论按钮查看与参与讨论。</p>
        )}
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/88">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5">
          <ObservationInteractions
            liked={liked}
            likesCount={likesCount}
            commentsCount={commentsCount}
            isLiking={isLiking}
            onLike={() => void toggleLike()}
            onToggleComments={toggleComments}
            commentsOpen={commentsOpen}
            bar
            className="flex-1 justify-start"
          />
          {submitHref ? (
            <Button asChild tone="brand" shape="pill" size="default" className="shrink-0 px-4">
              <Link href={submitHref}>再记一条</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </>
  )
}
