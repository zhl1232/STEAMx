"use client"

import { useState } from "react"
import { ObservationInteractions } from "./observation-interactions"
import { ObservationComments } from "./observation-comments"

interface ObservationSocialSectionProps {
  observationId: number
  initialLikesCount: number
  initialCommentsCount: number
}

export function ObservationSocialSection({
  observationId,
  initialLikesCount,
  initialCommentsCount,
}: ObservationSocialSectionProps) {
  const [showComments, setShowComments] = useState(false)
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount)

  return (
    <section className="surface-subtle mt-8 p-5">
      <ObservationInteractions
        observationId={observationId}
        initialLikesCount={initialLikesCount}
        initialCommentsCount={commentsCount}
        onToggleComments={() => setShowComments((v) => !v)}
        commentsOpen={showComments}
      />
      {showComments && (
        <div className="mt-4 border-t border-border/70 pt-4">
          <ObservationComments
            observationId={observationId}
            onCommentCreated={() => setCommentsCount((count) => count + 1)}
          />
        </div>
      )}
    </section>
  )
}
