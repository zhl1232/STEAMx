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

  return (
    <section className="mt-8 rounded-2xl border p-5">
      <ObservationInteractions
        observationId={observationId}
        initialLikesCount={initialLikesCount}
        initialCommentsCount={initialCommentsCount}
        onToggleComments={() => setShowComments((v) => !v)}
        commentsOpen={showComments}
      />
      {showComments && (
        <div className="mt-4 border-t pt-4">
          <ObservationComments observationId={observationId} />
        </div>
      )}
    </section>
  )
}
