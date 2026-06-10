"use client"

import * as React from 'react'

import { ChallengeSubmissionForm } from '@/components/features/challenge/challenge-submission-form'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'

export default function PblChallengeSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
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
    <>
      <MobilePageHeader title="挑战作品" fallbackHref={`/pbl/${challengeId}`} />

      <div className="page-shell pt-3 pb-24 md:py-8">
        <ChallengeSubmissionForm challengeId={challengeId} />
      </div>
    </>
  )
}
