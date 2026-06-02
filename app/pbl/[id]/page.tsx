"use client"

import * as React from "react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowUpRight, CheckCircle, Play, Sparkles, Trophy, Users } from "lucide-react"

import { PblInfo } from "@/components/features/challenge/pbl-info"
import { StageGuide } from "@/components/features/challenge/stage-guide"
import { SubmissionGallery } from "@/components/features/challenge/submission-gallery"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { CountdownTimer } from "@/components/ui/countdown-timer"
import { MobilePageHeader } from "@/components/ui/mobile-page-header"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { useAuth } from '@/lib/context/auth-context'
import { useChallenge } from '@/lib/context/challenge-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import type { Challenge } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"

export default function PblChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params)
  const { joinChallenge } = useChallenge()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const router = useRouter()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const postLoginJoinRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    postLoginJoinRef.current = async () => {
      if (!challenge) return
      setChallenge((prev) => (prev ? { ...prev, joined: true, participants: prev.participants + 1 } : prev))
      try {
        await joinChallenge(challenge.id)
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
  const relatedProjects = challenge.recommendedProjects || []
  const STEAM_LABEL: Record<string, string> = { S: "科学", T: "技术", E: "工程", A: "艺术", M: "数学" }
  const PRIMARY_SECTION_GLOW = "pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/10 via-primary/4 to-transparent sm:h-20"
  const SECONDARY_SECTION_GLOW = "pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-secondary/30 via-secondary/12 to-transparent sm:h-20"
  const steamWeights = challenge.steamWeights
    ? Object.entries(challenge.steamWeights)
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a)
    : []
  const formatDate = (value: string) => new Date(value).toLocaleDateString("zh-CN")
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
  const progressCards = [
    {
      label: isTimed ? "参与情况" : "作品情况",
      value: `${participationValue}`,
      helper: participationLabel,
    },
    {
      label: "当前状态",
      value: challengeStatusLabel,
      helper: hasSubmission ? "已提交作品" : "未提交作品",
    },
    {
      label: isTimed && challenge.endDate ? "挑战周期" : "挑战类型",
      value:
        isTimed && challenge.startDate && challenge.endDate
          ? `${formatCompactDate(challenge.startDate)} - ${formatCompactDate(challenge.endDate)}`
          : isTimed && challenge.endDate
            ? `截止 ${formatCompactDate(challenge.endDate)}`
            : "长期挑战",
      helper: isTimed ? "结束后统一结算" : "可持续补充作品",
    },
  ]
  const rewardItems = isTimed
    ? [
        {
          icon: "🥇",
          title: "第 1 名",
          description: "徽章 + 20 硬币",
          className: "border-amber-200/80 bg-amber-50/75 dark:border-amber-900/70 dark:bg-amber-950/20",
        },
        {
          icon: "🥈",
          title: "第 2 名",
          description: "徽章 + 10 硬币",
          className: "border-slate-200/80 bg-slate-50/75 dark:border-slate-800/70 dark:bg-slate-900/30",
        },
        {
          icon: "🥉",
          title: "第 3 名",
          description: "徽章 + 5 硬币",
          className: "border-orange-200/80 bg-orange-50/75 dark:border-orange-900/70 dark:bg-orange-950/20",
        },
        {
          icon: "✨",
          title: "参与奖励",
          description: "参与即可获得 +20 XP",
          className: "border-primary/20 bg-primary/5",
        },
      ]
    : [
        {
          icon: "🏅",
          title: "完成奖励",
          description: "审核通过后计入完成",
          className: "border-primary/20 bg-primary/5",
        },
        {
          icon: "🧾",
          title: "持续沉淀",
          description: "结束前都可继续补材料",
          className: "border-sky-200/80 bg-sky-50/75 dark:border-sky-900/70 dark:bg-sky-950/20",
        },
        {
          icon: "🪄",
          title: "公开展示",
          description: "通过审核后进入作品墙",
          className: "border-pink-200/80 bg-pink-50/75 dark:border-pink-900/70 dark:bg-pink-950/20",
        },
      ]

  const handleJoin = () => {
    if (!user) {
      promptLogin(
        () => {
          void postLoginJoinRef.current?.()
        },
        {
          title: "登录以参与挑战",
          description: "登录后即可报名参与挑战",
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
    void joinChallenge(challenge.id).catch(() => {
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

  return (
    <div className="page-shell pt-4 pb-24 md:pt-6 md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader
          title={challenge.title}
          fallbackHref="/create"
        />
      </div>

      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="-ml-2 mb-6 hidden rounded-full px-2 text-sm hover:bg-transparent md:inline-flex"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回创造
      </Button>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_320px] lg:gap-6">
        <div className="space-y-4 sm:space-y-5">
          <section className="surface-panel overflow-hidden">
            <div className="relative min-h-[300px] overflow-hidden sm:min-h-[420px]">
              <OptimizedImage src={challenge.image} alt={challenge.title} fill variant="cover" className="object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.28),rgba(15,23,42,0.22)_32%,rgba(15,23,42,0.9)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(166,193,238,0.32),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(251,194,235,0.22),transparent_26%)]" />

              <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-black/42 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                    {isTimed ? "限时挑战" : "长期挑战"}
                  </span>
                  <span className="rounded-full bg-black/42 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                    {challengeStatusLabel}
                  </span>
                </div>

                {isTimed && challenge.endDate && !isEnded && (
                  <>
                    <CountdownTimer
                      endDate={challenge.endDate}
                      compact
                      className="rounded-full bg-black/42 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md md:hidden"
                    />
                    <CountdownTimer endDate={challenge.endDate} className="hidden md:flex" />
                  </>
                )}

                {isEnded && (
                  <span className="rounded-full bg-black/35 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-md">
                    挑战已结束
                  </span>
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
                <div className="max-w-3xl rounded-[var(--radius-lg)] bg-black/28 px-4 py-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.7)] backdrop-blur-md sm:rounded-xl sm:px-6 sm:py-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/76">PBL 挑战</p>
                  <h1 className="mt-3 text-[1.85rem] font-semibold leading-tight tracking-tight text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.55)] sm:mt-4 sm:text-4xl lg:text-[2.7rem]">
                    {challenge.title}
                  </h1>
                  <p className="mt-2.5 text-[13px] leading-6 text-white/92 sm:mt-3 sm:text-base sm:leading-8">
                    {challenge.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                    {challenge.difficultyStars && (
                      <span className="rounded-full bg-white/14 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm sm:px-3 sm:text-xs">
                        {"★".repeat(challenge.difficultyStars)} 难度
                      </span>
                    )}
                    {challenge.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/14 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm sm:px-3 sm:text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.7),rgba(166,193,238,0.12),rgba(251,194,235,0.1))] px-4 py-3 sm:px-6 lg:px-8 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(37,99,235,0.1),rgba(244,114,182,0.08))]">
              {progressCards.map((card, index) => (
                <div
                  key={card.label}
                  className={cn(
                    "min-w-0 rounded-md bg-white/82 px-3 py-2.5 text-left shadow-[0_18px_48px_-42px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:rounded-lg sm:px-3.5 dark:bg-slate-950/58",
                    index === 1 ? "bg-white/90 dark:bg-slate-950/68" : "",
                  )}
                >
                  <div className="text-[10px] font-medium tracking-[0.14em] text-foreground/56 sm:tracking-[0.16em]">
                    {card.label}
                  </div>
                  <div className="mt-1 truncate text-[13px] font-semibold tracking-tight text-foreground sm:text-[15px]">
                    {card.value}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    {card.helper}
                  </div>
                </div>
              ))}
            </div>

            {steamWeights.length > 0 && (
              <div className="border-t border-border/60 px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="section-kicker">STEAM 侧重</p>
                  <div className="flex flex-wrap gap-2">
                    {steamWeights.map(([dim, weight]) => (
                      <Badge key={dim} variant="secondary" className="rounded-full border-0 bg-background/72 text-xs">
                        {STEAM_LABEL[dim] || dim}: {weight}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="surface-panel relative overflow-hidden p-3.5 md:hidden">
            <div className={SECONDARY_SECTION_GLOW} />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">加入后提交作品</h2>
                <div className="inline-flex items-center gap-2 rounded-full bg-background/82 px-3 py-2 text-sm shadow-[0_18px_48px_-40px_rgba(15,23,42,0.12)]">
                  {isTimed ? <Users className="h-4 w-4 text-primary" /> : <CheckCircle className="h-4 w-4 text-primary" />}
                  <span className="font-semibold tracking-tight">{participationValue}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full border-0 bg-background/76">
                  {challengeStatusLabel}
                </Badge>
                {challenge.joined && !isEnded && (
                  <StatusBadge status="success" className="rounded-full px-3 py-1">
                    {isTimed ? "已报名" : "已参与"}
                  </StatusBadge>
                )}
                {submissionStatusMeta && (
                  <StatusBadge status={submissionStatusMeta.status} className="rounded-full px-3 py-1">
                    {submissionStatusMeta.label}
                  </StatusBadge>
                )}
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {isEnded
                  ? hasSubmission
                    ? '挑战已结束，你的挑战作品会继续保留在作品墙中。'
                    : '挑战已结束，作品提交通道已关闭。'
                  : hasSubmission
                    ? '已提交，可继续补充材料。'
                    : challenge.joined
                      ? '已加入，准备好后可直接提交。'
                      : '先加入，再提交作品。'}
              </p>

              {!isEnded && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button className="h-10 rounded-sm text-sm font-semibold" onClick={handleSubmit} disabled={!canEditSubmission}>
                    {hasSubmission ? '更新作品' : '提交作品'}
                  </Button>
                  <Button
                    onClick={handleJoin}
                    tone={challenge.joined ? "success" : undefined}
                    variant={challenge.joined ? undefined : "outline"}
                    shape="soft"
                    className="h-10 text-sm font-semibold"
                  >
                    {challenge.joined ? (isTimed ? '已报名' : '已加入') : (isTimed ? '报名挑战' : '加入挑战')}
                  </Button>
                </div>
              )}

              {challenge.tags.includes("鸟类") && (
                <Link
                  href="/nature/submit?topic=birds"
                  className="community-nature-cta mt-3"
                >
                  <span>补充观察记录</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </section>

          <section className="surface-panel relative overflow-hidden p-3.5 sm:p-6">
            <div className={PRIMARY_SECTION_GLOW} />
            <div className="relative">
              <PblInfo challenge={challenge} />
            </div>
          </section>

          {challenge.stages && challenge.stages.length > 0 && (
            <section className="surface-panel relative overflow-hidden p-3.5 sm:p-6">
              <div className={SECONDARY_SECTION_GLOW} />
              <div className="relative">
                <StageGuide stages={challenge.stages} />
              </div>
            </section>
          )}

          {relatedProjects.length > 0 && (
            <section className="surface-panel relative overflow-hidden p-3.5 sm:p-6">
              <div className={PRIMARY_SECTION_GLOW} />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">相关项目</h2>
                  <span className="hidden text-xs text-muted-foreground md:inline-flex">
                    {relatedProjects.length} 个项目
                  </span>
                </div>
                <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                  {relatedProjects.map((project, index) => (
                    <Link
                      key={project.id}
                      href={`/project/${project.id}`}
                      className="group community-related-project-link"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-background/82 px-2 text-[11px] font-semibold text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight transition-colors group-hover:text-primary sm:text-[15px]">
                          {project.title}
                        </h3>
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/82 text-muted-foreground transition-all group-hover:text-primary">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="surface-panel relative overflow-hidden p-3.5 sm:p-6">
            <div className={PRIMARY_SECTION_GLOW} />
            <div className="relative">
              <SubmissionGallery challengeId={Number(challenge.id)} challengeType={challenge.challengeType} />
            </div>
          </section>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <section className="surface-panel hidden overflow-hidden p-0 md:block">
              <div className="bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(166,193,238,0.14),rgba(251,194,235,0.12))] px-4 py-4 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(37,99,235,0.12),rgba(244,114,182,0.1))]">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold tracking-tight">提交挑战作品</h2>
                  <div className="inline-flex items-center gap-2 rounded-full bg-background/84 px-3.5 py-2 text-sm shadow-[0_18px_48px_-42px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                    {isTimed ? <Users className="h-4 w-4 text-primary" /> : <CheckCircle className="h-4 w-4 text-primary" />}
                    <span className="font-semibold tracking-tight">{participationValue}</span>
                    <span className="text-[11px] text-muted-foreground">{participationLabel}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="rounded-lg bg-background/76 px-3.5 py-3.5 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.12)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full border-0 bg-background/78">
                      {challengeStatusLabel}
                    </Badge>
                    {challenge.joined && !isEnded && (
                      <StatusBadge status="success" className="rounded-full px-3 py-1">
                        {isTimed ? "已报名" : "已参与"}
                      </StatusBadge>
                    )}
                    {submissionStatusMeta && (
                      <StatusBadge status={submissionStatusMeta.status} className="rounded-full px-3 py-1">
                        {submissionStatusMeta.label}
                      </StatusBadge>
                    )}
                  </div>

                  <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                    {isEnded
                      ? hasSubmission
                        ? "挑战已结束，你的挑战作品会继续保留在作品墙中。"
                        : "挑战已结束，作品提交通道已关闭。"
                      : submissionSummary}
                  </p>

                                    {challenge.completed && !submissionStatusMeta && (
                    <StatusBadge status="success" className="mt-2.5 inline-flex items-center gap-2 rounded-full px-3 py-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      已有审核通过的挑战作品
                    </StatusBadge>
                  )}
                </div>

                {!isEnded && (
                  <div className="space-y-2.5">
                    <Button className="h-10 w-full rounded-sm text-sm font-semibold" onClick={handleSubmit} disabled={!canEditSubmission}>
                      {hasSubmission ? "更新作品" : "提交作品"}
                    </Button>
                    <Button
                      onClick={handleJoin}
                      tone={challenge.joined ? "success" : undefined}
                      variant={challenge.joined ? undefined : "outline"}
                      shape="soft"
                      className="h-10 w-full text-sm font-semibold"
                    >
                      {challenge.joined ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {isTimed ? "已报名挑战" : "已加入挑战"}
                        </>
                      ) : (
                        <>
                          {isTimed ? <Trophy className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                          {isTimed ? "报名挑战" : "加入挑战"}
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {challenge.tags.includes("鸟类") && (
                  <Link
                    href="/nature/submit?topic=birds"
                    className="community-nature-cta"
                  >
                    <span>补充观察记录</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </section>

            <section className="surface-panel overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  奖励说明
                </h3>
                <Badge variant="secondary" className="rounded-full border-0 bg-background/76">
                  {isTimed ? "按排名结算" : "完成后解锁"}
                </Badge>
              </div>

              <div className="grid gap-2 p-4">
                {rewardItems.map((item) => (
                  <div key={item.title} className={cn("rounded-lg px-3 py-2.5 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.1)]", item.className)}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background/82 text-base shadow-sm">
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold">{item.title}</div>
                        <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {isTimed && challenge.startDate && (
                <div className="border-t border-border/60 px-4 py-3.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">开始</span>
                    <span>{formatDate(challenge.startDate)}</span>
                  </div>
                  {challenge.endDate && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-muted-foreground">截止</span>
                      <span>{formatDate(challenge.endDate)}</span>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}
