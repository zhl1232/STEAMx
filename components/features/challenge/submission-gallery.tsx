"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, ExternalLink, Star, X } from 'lucide-react'

import { RatingStars } from './rating-stars'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { useAuth } from '@/lib/context/auth-context'
import type { ChallengeSubmission } from '@/lib/mappers/types'

interface SubmissionGalleryProps {
  challengeId: number
  challengeType: 'timed' | 'evergreen'
}

interface RatingDetailResponse {
  summary: ChallengeSubmission['ratingSummary']
  myRating: {
    creativeExpression: number
    completionQuality: number
    evidenceCompleteness: number
    reflectionDepth: number
  } | null
}

export function SubmissionGallery({ challengeId, challengeType }: SubmissionGalleryProps) {
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedRating, setExpandedRating] = useState<number | null>(null)
  const [ratingDetails, setRatingDetails] = useState<Record<number, RatingDetailResponse>>({})
  const [selectedSubmission, setSelectedSubmission] = useState<ChallengeSubmission | null>(null)
  const { user } = useAuth()

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true)
    const response = await fetch(`/api/challenges/${challengeId}/submissions`)
    if (response.ok) {
      const payload = await response.json()
      setSubmissions(payload.submissions || [])
    } else {
      setSubmissions([])
    }
    setIsLoading(false)
  }, [challengeId])

  useEffect(() => {
    void fetchSubmissions()
  }, [fetchSubmissions])

  const loadRatingDetail = useCallback(async (submissionId: number) => {
    if (ratingDetails[submissionId]) {
      return ratingDetails[submissionId]
    }

    const response = await fetch(`/api/challenges/submissions/ratings/${submissionId}`)
    if (!response.ok) {
      return null
    }

    const payload = await response.json() as RatingDetailResponse
    setRatingDetails((current) => ({ ...current, [submissionId]: payload }))
    return payload
  }, [ratingDetails])

  const sortedSubmissions = useMemo(() => submissions, [submissions])

  if (isLoading) {
    return <div className="surface-subtle px-6 py-10 text-center text-muted-foreground">加载作品中...</div>
  }

  if (sortedSubmissions.length === 0) {
    return (
      <div className="surface-subtle px-6 py-12 text-center text-muted-foreground">
        <p className="text-lg">还没有公开作品</p>
        <p className="mt-1 text-sm">第一份通过审核的作品会显示在这里。</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">挑战作品墙</h3>
        <div className="inline-flex w-fit flex-wrap items-center gap-2 rounded-full bg-background/72 px-3 py-1.5 text-xs text-muted-foreground">
          <span>{sortedSubmissions.length} 份作品</span>
          <span className="text-border">·</span>
          <span>仅展示公开内容</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sortedSubmissions.map((submission, index) => {
          const isMine = user?.id === submission.userId
          const ratingDetail = ratingDetails[submission.id]
          const canShowRating = !isMine && !!user

          return (
            <article
              key={submission.id}
              className="group overflow-hidden rounded-lg border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(166,193,238,0.12),rgba(251,194,235,0.08))] shadow-[0_18px_48px_-36px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_54px_-34px_rgba(59,130,246,0.3)] sm:rounded-lg dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(37,99,235,0.1),rgba(244,114,182,0.08))]"
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setSelectedSubmission(submission)}
              >
                <div className="relative overflow-hidden">
                  <div className="relative aspect-video">
                    <OptimizedImage
                      src={submission.proofImages[0]}
                      alt={submission.title}
                      fill
                      variant="cover"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.16),rgba(15,23,42,0.06)_38%,rgba(15,23,42,0.82)_100%)]" />

                  {challengeType === 'timed' && index < 3 ? (
                    <Badge className="absolute left-3 top-3 border-0 bg-black/58 text-white backdrop-blur-md">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} 第{index + 1}名
                    </Badge>
                  ) : null}

                  {challengeType === 'evergreen' && submission.ratingSummary.avgScore >= 4 ? (
                    <Badge className="absolute left-3 top-3 border-0 bg-black/58 text-white backdrop-blur-md">精选</Badge>
                  ) : null}

                  <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/52 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {submission.ratingSummary.avgScore.toFixed(2)}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                    <div className="max-w-[88%] rounded-lg bg-black/42 px-3 py-2.5 text-white backdrop-blur-md sm:max-w-[85%] sm:px-3.5 sm:py-3">
                      <div className="line-clamp-1 text-sm font-semibold tracking-tight text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)] sm:text-base">
                        {submission.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
                        <Clock3 className="h-3.5 w-3.5" />
                        {new Date(submission.updatedAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              <div className="space-y-2.5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AvatarWithFrame
                      src={submission.avatar}
                      fallback={submission.author?.[0] || '?'}
                      avatarFrameId={submission.avatarFrameId}
                      className="h-8 w-8"
                      avatarClassName="h-8 w-8"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{submission.author}</div>
                      <div className="text-xs text-muted-foreground">{submission.ratingSummary.ratingCount} 个评分</div>
                    </div>
                  </div>
                  {isMine ? (
                    <span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
                      我的作品
                    </span>
                  ) : null}
                </div>

                {submission.notes ? (
                  <p className="line-clamp-2 text-sm leading-6 text-foreground/80 dark:text-slate-300/80">{submission.notes}</p>
                ) : null}

                {submission.referenceProjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {submission.referenceProjects.slice(0, 3).map((project) => (
                      <Link
                        key={project.id}
                        href={`/project/${project.id}`}
                        className="inline-flex items-center rounded-full bg-background/82 px-2.5 py-1 text-[11px] text-foreground/70 transition-colors hover:bg-background hover:text-foreground"
                      >
                        {project.title}
                      </Link>
                    ))}
                  </div>
                ) : null}

                {canShowRating ? (
                  <div className="pt-2">
                    {expandedRating === submission.id ? (
                      <RatingStars
                        submissionId={submission.id}
                        initialRating={ratingDetail?.myRating || null}
                        onRated={() => {
                          setExpandedRating(null)
                          void fetchSubmissions()
                          void loadRatingDetail(submission.id)
                        }}
                      />
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8.5 w-full rounded-full border-0 bg-background/76 px-4 text-sm text-primary hover:bg-background sm:w-auto"
                        onClick={async () => {
                          await loadRatingDetail(submission.id)
                          setExpandedRating(submission.id)
                        }}
                      >
                        评分作品
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto gap-0 border-0 bg-background p-0 [&>button:last-child]:hidden sm:left-[50%] sm:top-[50%] sm:h-auto sm:w-full sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-xl sm:border sm:border-border/70 sm:shadow-[0_28px_70px_-38px_rgba(15,23,42,0.45)]">
          <DialogTitle className="sr-only">{selectedSubmission?.title}</DialogTitle>
          <DialogDescription className="sr-only">查看挑战作品详情</DialogDescription>
          {selectedSubmission ? (
            <SubmissionDetail submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SubmissionDetail({
  submission,
  onClose,
}: {
  submission: ChallengeSubmission
  onClose: () => void
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    setCurrentImageIndex(0)
  }, [submission.id])

  return (
    <div className="grid min-h-full grid-cols-1 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(166,193,238,0.1),rgba(251,194,235,0.06))] md:min-h-[520px] md:grid-cols-[minmax(0,1.1fr)_360px] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(37,99,235,0.08),rgba(244,114,182,0.06))]">
      <div className="relative min-h-[52svh] bg-black sm:min-h-[420px] md:min-h-[320px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur sm:right-4 sm:top-4 sm:h-9 sm:w-9"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative h-full min-h-[320px]">
          <OptimizedImage
            src={submission.proofImages[currentImageIndex]}
            alt={submission.title}
            fill
            variant="cover"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.12),rgba(15,23,42,0.04)_30%,rgba(15,23,42,0.82)_100%)]" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 sm:hidden">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/42 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
            <span>{currentImageIndex + 1}</span>
            <span className="text-white/55">/</span>
            <span>{submission.proofImages.length}</span>
          </div>
          <div className="pr-14">
            <div className="inline-flex items-center gap-1 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              {submission.ratingSummary.avgScore.toFixed(2)}
            </div>
          </div>
        </div>

        {submission.proofCaptions?.[currentImageIndex] ? (
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <div className="rounded-lg bg-black/40 p-3.5 text-sm text-white backdrop-blur-md sm:rounded-lg sm:p-4">
              {submission.proofCaptions[currentImageIndex]}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3.5 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:p-5">
        <div className="rounded-lg bg-background/78 p-3.5 shadow-[0_18px_48px_-42px_rgba(15,23,42,0.14)] sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarWithFrame
                src={submission.avatar}
                fallback={submission.author?.[0] || '?'}
                avatarFrameId={submission.avatarFrameId}
                className="h-10 w-10"
                avatarClassName="h-10 w-10"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold">{submission.author}</p>
                <p className="text-sm text-muted-foreground">{new Date(submission.updatedAt).toLocaleString('zh-CN')}</p>
              </div>
            </div>
            <span className="hidden items-center gap-1 rounded-full bg-background/82 px-3 py-1 text-sm font-medium sm:inline-flex">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {submission.ratingSummary.avgScore.toFixed(2)}
            </span>
          </div>

          <h3 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">{submission.title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-background/84 px-2.5 py-1">
              {submission.ratingSummary.ratingCount} 个评分
            </span>
            {submission.referenceProjects.length > 0 ? (
              <span className="rounded-full bg-background/84 px-2.5 py-1">
                {submission.referenceProjects.length} 个相关项目
              </span>
            ) : null}
          </div>
        </div>

        {submission.notes ? (
          <div className="rounded-lg bg-background/76 p-3.5 shadow-[0_18px_48px_-44px_rgba(15,23,42,0.12)] sm:p-4">
            <h4 className="text-sm font-semibold">作品说明</h4>
            <p className="mt-2 text-sm leading-7 text-foreground/80 dark:text-slate-300/80">{submission.notes}</p>
          </div>
        ) : null}

        {submission.referenceProjects.length > 0 ? (
          <div className="rounded-lg bg-background/76 p-3.5 shadow-[0_18px_48px_-44px_rgba(15,23,42,0.12)] sm:p-4">
            <h4 className="text-sm font-semibold">相关项目</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {submission.referenceProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="inline-flex items-center rounded-full bg-background/84 px-3 py-1.5 text-sm transition-colors hover:bg-background"
                >
                  {project.title}
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {submission.proofImages.length > 1 ? (
          <div className="rounded-lg bg-background/76 p-3.5 shadow-[0_18px_48px_-44px_rgba(15,23,42,0.12)] sm:p-4">
            <h4 className="text-sm font-semibold">更多图片</h4>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-2.5">
              {submission.proofImages.map((image, index) => (
                <button
                  key={`${submission.id}-${image}-${index}`}
                  type="button"
                  className={`relative aspect-square overflow-hidden rounded-md border transition-all ${
                    index === currentImageIndex
                      ? 'border-primary ring-2 ring-primary/15'
                      : 'border-border/70 hover:border-primary/30'
                  }`}
                  onClick={() => setCurrentImageIndex(index)}
                >
                  <OptimizedImage src={image} alt={`${submission.title}-${index + 1}`} fill variant="grid" className="object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {submission.proofVideoUrl ? (
          <div className="rounded-lg bg-background/76 p-3.5 shadow-[0_18px_48px_-44px_rgba(15,23,42,0.12)] sm:p-4">
            <h4 className="text-sm font-semibold">作品视频</h4>
            <video controls className="mt-3 w-full rounded-lg bg-black sm:rounded-lg">
              <source src={submission.proofVideoUrl} />
            </video>
          </div>
        ) : null}
      </div>
    </div>
  )
}
