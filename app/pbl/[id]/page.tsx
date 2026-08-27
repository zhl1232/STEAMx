"use client"

import * as React from "react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowUpRight, CheckCircle, Play, Trophy } from "lucide-react"

import { PblInfo } from "@/components/features/challenge/pbl-info"
import { StageWorkspace } from "@/components/features/challenge/stage-workspace"
import { SubmissionGallery } from "@/components/features/challenge/submission-gallery"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { CountdownTimer } from "@/components/ui/countdown-timer"
import { MobilePageHeader } from "@/components/ui/mobile-page-header"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { ContentClassification } from "@/components/ui/content-classification"
import { useAuth } from '@/lib/context/auth-context'
import { useChallenge } from '@/lib/context/challenge-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import type { Challenge } from "@/lib/mappers/types"

export default function PblChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params)
  const { joinChallenge } = useChallenge()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const router = useRouter()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const postLoginJoinRef = useRef<(() => Promise<void>) | null>(null)
  const stageSectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    postLoginJoinRef.current = async () => {
      if (!challenge) return
      setChallenge((prev) => (prev ? { ...prev, joined: true, participants: prev.participants + 1 } : prev))
      try {
        await joinChallenge(challenge.id, { currentlyJoined: false })
      } catch {
        setChallenge((prev) =>
          prev ? { ...prev, joined: false, participants: Math.max(0, prev.participants - 1) } : prev,
        )
      }
    }
  }, [challenge, joinChallenge])

  useEffect(() => {
    const fetchChallenge = async () => {
      const res = await fetch(`/api/challenges/${unwrappedParams.id}`)
      if (res.ok) {
        const data = await res.json()
        setChallenge(data.challenge)
      }
      setIsLoading(false)
    }
    void fetchChallenge()
  }, [unwrappedParams.id])

  if (isLoading) {
    return (
      <div className="page-shell py-10 md:py-14">
        <section className="surface-panel px-6 py-12 text-center">
          <p className="text-muted-foreground">加载中...</p>
        </section>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="page-shell py-10 md:py-14">
        <section className="surface-panel px-6 py-12 text-center">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">挑战不存在</h1>
          <Button onClick={() => router.back()}>返回上一页</Button>
        </section>
      </div>
    )
  }

  const isTimed = challenge.challengeType === "timed"
  const isEnded = challenge.status === "ended"
  const hasSubmission = Boolean(challenge.mySubmissionId)
  const canEditSubmission = challenge.canEditSubmission !== false && !isEnded
  const hasStages = (challenge.stages?.length ?? 0) > 0
  const STEAM_LABEL: Record<string, string> = { S: "科学", T: "技术", E: "工程", A: "艺术", M: "数学" }
  const steamWeights = challenge.steamWeights
    ? Object.entries(challenge.steamWeights)
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a)
    : []
  const formatCompactDate = (value: string) =>
    new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })
  const challengeStatusLabel = isEnded ? "已结束" : isTimed ? "进行中" : "长期开放"
  const participationValue = isTimed ? challenge.participants : challenge.submissionsCount || 0
  const participationLabel = isTimed ? "人已参与" : "件公开作品"
  const submissionSummary =
    challenge.mySubmissionStatus === "approved"
      ? "作品已通过审核，修改后会重新审核。"
      : challenge.mySubmissionStatus === "pending"
        ? "作品审核中，可继续补充后再提交。"
        : challenge.mySubmissionStatus === "rejected"
          ? "作品待修改后重新提交。"
          : hasSubmission
            ? "可继续补充过程和证据。"
            : "整理好过程和证据后提交。"
  const submissionStatusMeta =
    challenge.mySubmissionStatus === "approved"
      ? { label: "审核通过", status: "success" as const }
      : challenge.mySubmissionStatus === "pending"
        ? { label: "审核中", status: "warning" as const }
        : challenge.mySubmissionStatus === "rejected"
          ? { label: "待修改", status: "danger" as const }
          : null
  const heroMeta = [
    isTimed && challenge.startDate && challenge.endDate
      ? `${formatCompactDate(challenge.startDate)} – ${formatCompactDate(challenge.endDate)}`
      : isTimed && challenge.endDate
        ? `截止 ${formatCompactDate(challenge.endDate)}`
        : "长期开放，可持续补充作品",
    hasSubmission ? "已提交作品" : "作品待提交",
  ]
  const challengeMetaText = [
    ...challenge.tags.filter((tag) => tag.toLowerCase() !== "pbl"),
  ]
    .filter(Boolean)
    .join("  ·  ")
  const handleJoin = () => {
    if (!user) {
      promptLogin(
        () => {
          void postLoginJoinRef.current?.()
        },
        {
          title: "登录以参与挑战",
          description: "登录后即可记录过程并提交作品。",
        },
      )
      return
    }

    const wasJoined = challenge.joined
    setChallenge((prev) =>
      prev
        ? {
            ...prev,
            joined: !wasJoined,
            participants: prev.participants + (wasJoined ? -1 : 1),
          }
        : prev,
    )
    void joinChallenge(challenge.id, { currentlyJoined: wasJoined }).catch(() => {
      setChallenge((prev) =>
        prev
          ? {
              ...prev,
              joined: wasJoined,
              participants: prev.participants + (wasJoined ? 1 : -1),
            }
          : prev,
      )
    })
  }

  const handleSubmit = () => {
    router.push(`/pbl/${challenge.id}/submit`)
  }

  const handleScrollToStages = () => {
    stageSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
      <MobilePageHeader
        title={challenge.title}
        fallbackHref="/courses"
      />

      <div className="page-shell pt-3 pb-28 md:pt-6 md:pb-10">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="-ml-2 mb-6 hidden rounded-full px-2 text-sm hover:bg-transparent md:inline-flex"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回课程
      </Button>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_320px] lg:gap-6">
        <div className="space-y-4 sm:space-y-5">
          <section className="surface-panel overflow-hidden">
            <div className="relative min-h-[210px] overflow-hidden sm:min-h-[400px]">
              <OptimizedImage
                src={challenge.image}
                alt={challenge.title}
                fill
                variant="cover"
                loading="eager"
                fetchPriority="high"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,30,0)_0%,rgba(8,15,30,0.02)_44%,rgba(8,15,30,0.22)_76%,rgba(8,15,30,0.44)_100%)] sm:bg-[linear-gradient(180deg,rgba(8,15,30,0)_0%,rgba(8,15,30,0.05)_38%,rgba(8,15,30,0.62)_74%,rgba(8,15,30,0.92)_100%)]" />

              <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6 lg:p-7">
                <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  {isTimed ? `限时挑战 · ${challengeStatusLabel}` : "长期挑战"}
                </span>

                {isTimed && challenge.endDate && !isEnded && (
                  <>
                    <CountdownTimer
                      endDate={challenge.endDate}
                      compact
                      className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur-md md:hidden"
                    />
                    <CountdownTimer endDate={challenge.endDate} className="hidden md:flex" />
                  </>
                )}

                {isEnded && (
                  <span className="rounded-full bg-black/45 px-4 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur-md">
                    挑战已结束
                  </span>
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
                <div className="max-w-3xl">
                  <h1 className="hidden text-[1.7rem] font-bold leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)] sm:block sm:text-[2.4rem] lg:text-[2.7rem]">
                    {challenge.title}
                  </h1>
                  <p className="mt-2.5 hidden max-w-2xl text-[13px] leading-6 text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)] sm:mt-3 sm:block sm:text-[15px] sm:leading-7">
                    {challenge.description}
                  </p>
                  {challengeMetaText && (
                    <p className="inline-block max-w-full rounded-xs bg-black/24 px-2.5 py-1 text-[12px] font-semibold leading-5 text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.7)] ring-1 ring-inset ring-white/30 backdrop-blur-xl [text-shadow:0_1px_2px_rgba(0,0,0,0.65)] sm:mt-3.5 sm:bg-transparent sm:px-0 sm:py-0 sm:text-[13px] sm:font-medium sm:leading-6 sm:text-white/75 sm:shadow-none sm:ring-0 sm:backdrop-blur-0 sm:text-shadow-none">
                      {challengeMetaText}
                    </p>
                  )}
                  <ContentClassification classification={challenge.classification} compact className="mt-2" />
                </div>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--surface-border)/0.6)] px-4 py-4 sm:hidden">
              <h1 className="text-[1.45rem] font-bold leading-tight tracking-tight">
                {challenge.title}
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {challenge.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[hsl(var(--surface-border)/0.6)] px-4 py-3.5 text-[13px] text-muted-foreground sm:px-6">
              <span>
                <span className="font-semibold tabular-nums text-foreground">{participationValue}</span> {participationLabel}
              </span>
              {heroMeta.map((item) => (
                <span key={item}>{item}</span>
              ))}
              {steamWeights.length > 0 && (
                <span className="ml-auto hidden items-center gap-1.5 sm:inline-flex">
                  <span className="text-xs">STEAM 侧重</span>
                  <span className="font-medium text-foreground/75">
                    {steamWeights.map(([dim, weight]) => `${STEAM_LABEL[dim] || dim} ${weight}`).join(" · ")}
                  </span>
                </span>
              )}
            </div>
          </section>

          <section className="surface-panel p-4 sm:p-6">
            <PblInfo challenge={challenge} />
          </section>

          {hasStages && (
            <section ref={stageSectionRef} className="surface-panel scroll-mt-20 p-4 sm:p-6">
              <StageWorkspace
                challengeId={Number(challenge.id)}
                stages={challenge.stages || []}
                isActive={challenge.status === "active"}
              />
            </section>
          )}

          <section className="surface-panel p-4 sm:p-6">
            <SubmissionGallery challengeId={Number(challenge.id)} challengeType={challenge.challengeType} />
          </section>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <section className="surface-panel hidden p-4 md:block">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold tracking-tight">完成挑战</h2>
                {challenge.joined && !isEnded && !submissionStatusMeta && (
                  <StatusBadge status="success" className="rounded-full px-2.5 py-0.5">
                    {isTimed ? "已报名" : "已参与"}
                  </StatusBadge>
                )}
                {submissionStatusMeta && (
                  <StatusBadge status={submissionStatusMeta.status} className="rounded-full px-2.5 py-0.5">
                    {submissionStatusMeta.label}
                  </StatusBadge>
                )}
              </div>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isEnded
                  ? hasSubmission
                    ? "挑战已结束，你的挑战作品会继续保留在作品墙中。"
                    : "挑战已结束，作品提交通道已关闭。"
                  : submissionSummary}
              </p>

              {challenge.completed && !submissionStatusMeta && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[hsl(var(--brand-green))]">
                  <CheckCircle className="h-3.5 w-3.5" />
                  已有审核通过的挑战作品
                </p>
              )}

              {!isEnded && (
                <div className="mt-3.5 space-y-2.5">
                  <Button className="h-10 w-full text-sm font-semibold" onClick={handleSubmit} disabled={!canEditSubmission}>
                    {hasSubmission ? "更新作品" : "提交作品"}
                  </Button>
                  {!challenge.joined ? (
                    <Button
                      onClick={handleJoin}
                      variant="outline"
                      shape="soft"
                      className="h-10 w-full text-sm font-semibold"
                    >
                      {isTimed ? <Trophy className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                      {isTimed ? "报名挑战" : "开始挑战"}
                    </Button>
                  ) : (
                    <p className="flex items-center gap-1.5 rounded-sm bg-[hsl(var(--status-success-surface)/0.65)] px-3 py-2 text-xs font-medium text-[hsl(var(--brand-green))]">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {isTimed ? "已报名，可继续记录过程" : "已加入，可继续记录过程"}
                    </p>
                  )}
                </div>
              )}

              {challenge.tags.includes("鸟类") && (
                <Link
                  href="/nature/submit"
                  className="community-nature-cta mt-3"
                >
                  <span>补充观察记录</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              )}
            </section>
          </div>
        </aside>
      </div>
      </div>

      {!isEnded && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--surface-border)/0.72)] bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-20px_50px_-36px_hsl(var(--surface-shadow)/0.55)] backdrop-blur-xl md:hidden">
          <div className="mx-auto max-w-(--shell-standard)">
            <div className={hasStages ? "grid grid-cols-[0.92fr_1.08fr] gap-2" : "grid grid-cols-1"}>
              {hasStages && (
                <Button
                  type="button"
                  variant="outline"
                  shape="soft"
                  className="h-11 text-sm font-semibold"
                  onClick={handleScrollToStages}
                >
                  记录过程
                </Button>
              )}
              <Button
                type="button"
                className="h-11 text-sm font-semibold"
                onClick={handleSubmit}
                disabled={!canEditSubmission}
              >
                {hasSubmission ? "更新作品" : "提交作品"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
