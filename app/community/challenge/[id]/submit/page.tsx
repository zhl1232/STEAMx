"use client"

import * as React from 'react'

import { ChallengeSubmissionForm } from '@/components/features/challenge/challenge-submission-form'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'

export default function ChallengeSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const challengeId = Number.parseInt(id, 10)

  if (Number.isNaN(challengeId)) {
    return (
      <div className="page-shell py-10">
        <section className="surface-panel px-6 py-12 text-center text-muted-foreground">
          无效的挑战编号。
        </section>
      </div>
    )
  }

  return (
    <div className="page-shell pt-6 pb-24 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader title="挑战作品" fallbackHref={`/community/challenge/${challengeId}`} />
      </div>

      <ChallengeSubmissionForm challengeId={challengeId} />
    </div>
  )
}
