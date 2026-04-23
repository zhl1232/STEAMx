"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"
import { useObservationInteractions } from "@/hooks/use-observation-interactions"
import { ObservationInteractions } from "./observation-interactions"
import { ObservationComments } from "./observation-comments"

interface ObservationSocialSectionProps {
  observationId: number
  initialLikesCount: number
  initialCommentsCount: number
  className?: string
  commentsClassName?: string
  mobileFloatingBar?: boolean
  submitHref?: string
}

export function ObservationSocialSection({
  observationId,
  initialLikesCount,
  initialCommentsCount,
  className,
  commentsClassName,
  mobileFloatingBar = false,
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
    <section id="observation-social" className={cn("surface-subtle mt-8 p-5", className)}>
      <ObservationInteractions
        liked={liked}
        likesCount={likesCount}
        commentsCount={commentsCount}
        isLiking={isLiking}
        onLike={() => void toggleLike()}
        onToggleComments={toggleComments}
        commentsOpen={commentsOpen}
      />
      {commentsOpen && (
        <div className={cn("mt-4 border-t border-border/70 pt-4", commentsClassName)}>
          <ObservationComments
            observationId={observationId}
            onCommentCreated={increaseCommentsCount}
          />
        </div>
      )}

      {mobileFloatingBar ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/95 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2">
            <ObservationInteractions
              liked={liked}
              likesCount={likesCount}
              commentsCount={commentsCount}
              isLiking={isLiking}
              onLike={() => void toggleLike()}
              onToggleComments={toggleComments}
              commentsOpen={commentsOpen}
              className="min-w-0 flex-1 gap-2"
              compact
            />
            {submitHref ? (
              <Link
                href={submitHref}
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                再次记录
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
