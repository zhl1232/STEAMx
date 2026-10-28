"use client"

import { useEffect, useRef, useState } from "react"
import { use24Game, type Card24 } from "@/hooks/playground/use-24-game"
import { GAME24_LEVELS } from "@/lib/playground/game24-levels"
import { useRaceOnline } from "@/hooks/playground/use-race-online"
import { useGamification } from '@/lib/context/gamification-context'
import { cn } from "@/lib/utils"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RaceOnlinePanel } from "@/components/features/playground/race-online-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Timer,
  Trophy,
  Zap,
  SkipForward,
  RefreshCw,
  Send,
  Eye,
  Calculator,
  Sparkles,
  Brain,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"
import confetti from "canvas-confetti"

const SUIT_SYMBOL: Record<Card24["suit"], string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
}

function PlayingCard({ card, highlight = false }: { card: Card24; highlight?: boolean }) {
  const isRed = card.suit === "hearts" || card.suit === "diamonds"
  const color = isRed ? "text-red-600 dark:text-red-400" : "text-foreground"
  const symbol = SUIT_SYMBOL[card.suit]

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center",
        "h-[132px] w-[96px] sm:h-[180px] sm:w-[130px] md:h-[210px] md:w-[150px]",
        "rounded-xl border-2 bg-card",
        "shadow-[0_18px_40px_-24px_hsl(var(--surface-shadow)/0.7)]",
        "transition-all duration-300 select-none",
        highlight
          ? "border-primary scale-105 shadow-[0_0_0_4px_hsl(var(--primary)/0.25)]"
          : "border-border hover:-translate-y-1",
      )}
    >
      <div className={cn("absolute top-2.5 left-3 flex flex-col items-center leading-none", color)}>
        <span className="text-base sm:text-xl font-black">{card.label}</span>
        <span className="text-sm sm:text-base">{symbol}</span>
      </div>
      <span className={cn("text-5xl sm:text-6xl md:text-7xl font-bold", color)}>{symbol}</span>
      <div className={cn("absolute bottom-2.5 right-3 flex flex-col items-center leading-none rotate-180", color)}>
        <span className="text-base sm:text-xl font-black">{card.label}</span>
        <span className="text-sm sm:text-base">{symbol}</span>
      </div>
    </div>
  )
}

/** 逐步点亮解法字符串，做成解题动画。 */
function SolutionAnimator({ expression, target }: { expression: string; target: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    setShown(0)
    if (!expression) return
    const tokens = expression.replace(/\s+/g, "").split("")
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setShown(i)
      if (i >= tokens.length + 1) window.clearInterval(id)
    }, 140)
    return () => window.clearInterval(id)
  }, [expression])

  const compact = expression.replace(/\s+/g, "")
  const visible = compact.slice(0, Math.min(shown, compact.length))
  const done = shown > compact.length

  return (
    <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3">
      <p className="text-sm font-bold text-foreground">解法演示</p>
      <p className="mt-2 font-mono text-lg sm:text-xl font-black tracking-wide text-primary">
        {visible}
        {!done && <span className="animate-pulse">▍</span>}
        {done && <span className="text-foreground"> = {target}</span>}
      </p>
    </div>
  )
}

function TimerBar({ timeLeft, total }: { timeLeft: number; total: number }) {
  const ratio = timeLeft / total
  const barColor =
    ratio > 0.5
      ? "bg-emerald-500"
      : ratio > 0.2
        ? "bg-yellow-500"
        : "bg-red-500"

  return (
    <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-linear", barColor)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}

export default function Game24Page() {
  const {
    level,
    levelWins,
    clearWins,
    isLevelUnlocked,
    selectLevel,
    cards,
    status,
    timeLeft,
    round,
    streak,
    stats,
    solutions,
    hintLevel,
    getHintText,
    requestHint,
    submitExpression,
    skipRound,
    newGame,
    dealNewRound,
    loadRoundFromValues,
  } = use24Game()
  const race = useRaceOnline("game24", {
    durationSeconds: 60,
    cardValues: cards.map((card) => card.value),
  })
  const raceIsWaiting = race.isWaiting
  const raceIsPlaying = race.isPlaying
  const raceHasSubmitted = race.hasSubmitted
  const submitRaceResult = race.submitResult
  const { checkBadges } = useGamification()

  const { setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext()
  useEffect(() => {
    setTutorOverride({ subtitle: "正在玩 24 点", hideFabOnMobile: true })
    return clearTutorOverride
  }, [clearTutorOverride, setTutorOverride])
  const [expression, setExpression] = useState("")
  const [error, setError] = useState("")
  const [isMounted, setIsMounted] = useState(false)
  const appliedRaceRoundRef = useRef<string | null>(null)
  const prevStatusRef = useRef(status)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (status === "playing") {
      setExpression("")
      setError("")
    }
  }, [status, round])

  useEffect(() => {
    const cardValues = race.settings.cardValues
    if (!raceIsPlaying || !race.matchId || !cardValues) return
    const key = `${race.matchId}:${cardValues.join(",")}`
    if (appliedRaceRoundRef.current === key) return
    appliedRaceRoundRef.current = key
    loadRoundFromValues(cardValues)
  }, [loadRoundFromValues, race.matchId, race.settings.cardValues, raceIsPlaying])

  useEffect(() => {
    if (status !== "solved") return
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } })
    checkBadges({
      projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
      commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
      engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
      likesGiven: 0, likesReceived: 0, collectionsCount: 0,
      challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
      discussionsCreated: 0, repliesCount: 0,
      minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
      game24Solved: stats.solvedCount,
      game24BestStreak: stats.bestStreak,
      game24BestTime: stats.bestTime,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => {
    const justEnded = prevStatusRef.current === "playing" && status !== "playing"
    prevStatusRef.current = status
    if (!justEnded || !raceIsPlaying || raceHasSubmitted) return

    const cardValues = race.settings.cardValues ?? cards.map((card) => card.value)
    if (status === "solved") {
      void submitRaceResult({
        cardValues,
        durationSeconds: 60,
        timeSeconds: 60 - timeLeft,
      })
      return
    }

    if (status === "timeout" || status === "skipped") {
      void submitRaceResult({
        completed: false,
        cardValues,
        durationSeconds: 60,
        timeSeconds: status === "timeout" ? 60 : 60 - timeLeft,
      })
    }
  }, [
    cards,
    race.settings.cardValues,
    raceHasSubmitted,
    raceIsPlaying,
    status,
    submitRaceResult,
    timeLeft,
  ])

  const handleSubmit = () => {
    if (raceIsWaiting) return
    const trimmed = expression.trim()
    if (!trimmed) return
    const result = submitExpression(trimmed)
    if (result.success) {
      setExpression("")
      setError("")
    } else {
      setError(result.error ?? "未知错误")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    }
  }

  const appendToken = (token: string) => {
    setExpression((prev) => `${prev}${token}`)
    if (error) setError("")
  }

  const deleteToken = () => {
    setExpression((prev) => prev.slice(0, -1))
    if (error) setError("")
  }

  if (!isMounted) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-lg border border-border bg-[hsl(var(--surface-raised)/0.9)] p-6 shadow-[0_24px_68px_-48px_hsl(var(--surface-shadow)/0.54)] backdrop-blur-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-md bg-primary/15" />
            <div className="space-y-2">
              <div className="h-5 w-44 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-64 animate-pulse rounded-full bg-muted/70" />
            </div>
          </div>
          <div className="flex justify-center gap-2 sm:gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[132px] w-[96px] animate-pulse rounded-xl bg-muted sm:h-[180px] sm:w-[130px] md:h-[210px] md:w-[150px]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="playground-game-page">
      {/* Main game area */}
      <div className="playground-game-main xl:justify-center pb-10">
        {/* Header */}
        <div className="w-full max-w-2xl hidden sm:flex flex-row items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-primary/10 border border-primary/40 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">
                24 点 · 组合数学挑战
              </h1>
              <p className="text-sm text-muted-foreground">
                {level.rule}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto text-xs sm:text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              第 {round} 轮
            </span>
            {streak > 0 && (
              <span className="flex items-center gap-1 text-amber-500 font-semibold">
                <Zap className="w-3.5 h-3.5" />
                连胜 {streak}
              </span>
            )}
          </div>
        </div>

        <div className="w-full max-w-2xl space-y-4 sm:space-y-6">
          {/* Difficulty ladder: tier segment + stepper */}
          <div className="space-y-2.5" data-testid="game24-levels">
            <div className="grid grid-cols-3 gap-1 rounded-full bg-muted/50 p-1" role="tablist" aria-label="难度">
              {(["入门", "进阶", "挑战"] as const).map((tier) => {
                const first = GAME24_LEVELS.find((l) => l.tier === tier)!
                const active = level.tier === tier
                const unlocked = isLevelUnlocked(first) || GAME24_LEVELS.some((l) => l.tier === tier && isLevelUnlocked(l))
                return (
                  <button
                    key={tier}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={!unlocked || raceIsWaiting || raceIsPlaying}
                    onClick={() => {
                      const pick = GAME24_LEVELS.find((l) => l.tier === tier && isLevelUnlocked(l)) ?? first
                      selectLevel(pick.id)
                    }}
                    className={cn(
                      "flex min-h-11 items-center justify-center rounded-full text-[15px] font-black transition-colors",
                      active ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                      !unlocked && "opacity-50",
                    )}
                  >
                    {tier}
                  </button>
                )
              })}
            </div>
            {(() => {
              const tierLevels = GAME24_LEVELS.filter((l) => l.tier === level.tier)
              const idx = tierLevels.findIndex((l) => l.id === level.id)
              const prev = idx > 0 ? tierLevels[idx - 1] : null
              const next = idx < tierLevels.length - 1 ? tierLevels[idx + 1] : null
              const wins = Math.min(levelWins[level.id] ?? 0, clearWins)
              return (
                <div className="flex items-center gap-2" role="group" aria-label="关卡">
                  <button
                    type="button"
                    disabled={!prev || !isLevelUnlocked(prev) || raceIsWaiting || raceIsPlaying}
                    onClick={() => prev && selectLevel(prev.id)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/70 disabled:opacity-40"
                    aria-label="上一关"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <p className="text-[15px] font-black">
                      {level.name}
                      <span className="ml-1.5 text-sm font-semibold text-muted-foreground">{idx + 1}/{tierLevels.length}</span>
                      {wins >= clearWins ? <CheckCircle2 className="ml-1 inline h-4 w-4 text-primary" /> : null}
                    </p>
                    <p className="truncate text-[15px] font-semibold text-muted-foreground">{level.rule}</p>
                    <p className="text-sm font-semibold text-muted-foreground">过关 {wins}/{clearWins}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!next || !isLevelUnlocked(next) || raceIsWaiting || raceIsPlaying}
                    onClick={() => next && selectLevel(next.id)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/70 disabled:opacity-40"
                    aria-label="下一关"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Timer */}
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[15px] font-bold text-foreground sm:hidden">
              第 {round} 轮{streak > 0 ? <span className="ml-1.5 text-amber-600 dark:text-amber-400">连胜 {streak}</span> : null}
            </span>
            <Timer className={cn("w-4 h-4 shrink-0", timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-muted-foreground")} />
            <TimerBar timeLeft={timeLeft} total={60} />
            <span className={cn(
              "text-sm font-mono tabular-nums w-8 text-right shrink-0",
              timeLeft <= 10 ? "text-red-500 font-bold" : "text-muted-foreground"
            )}>
              {timeLeft}s
            </span>
          </div>

          {/* Cards row */}
          <div className="flex justify-center gap-3 sm:gap-5">
            {cards.map((card, i) => (
              <PlayingCard key={`${card.suit}-${card.value}-${i}`} card={card} highlight={status === "solved"} />
            ))}
          </div>

          {/* Status banners */}
          {status === "solved" && (
            <div className="flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3">
              <Trophy className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-foreground">太棒了！算出了 {level.target}</p>
                <p className="text-[15px] font-semibold text-muted-foreground">
                  {(levelWins[level.id] ?? 0) === clearWins ? "本关已通关，下一关已解锁！" : "点击「下一轮」继续挑战。"}
                </p>
              </div>
            </div>
          )}
          {status === "timeout" && (
            <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
              <Timer className="w-5 h-5 text-foreground shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-foreground">时间到！</p>
                <p className="text-[15px] font-semibold text-muted-foreground">看看下方解法，学习新思路。</p>
              </div>
            </div>
          )}
          {status === "skipped" && (
            <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
              <Eye className="w-5 h-5 text-foreground shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-foreground">已跳过，查看解法</p>
                <p className="text-[15px] font-semibold text-muted-foreground">跳过不丢人，理解解法才是关键。</p>
              </div>
            </div>
          )}

          {/* Expression input */}
          {status === "playing" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={expression}
                  onChange={(e) => {
                    setExpression(e.target.value)
                    if (error) setError("")
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={raceIsWaiting}
                  placeholder={level.ops.length === 2 ? `用 + - 组出 ${level.target}` : `用 + - * / 和括号组出 ${level.target}`}
                  className={cn(
                    "flex-1 h-11 sm:h-12 rounded-sm border bg-background px-4 text-sm sm:text-base",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/40",
                    "transition-colors",
                    error
                      ? "border-red-400 focus-visible:ring-red-400/50"
                      : "border-border"
                  )}
                />
                <Button
                  size="lg"
                  className="rounded-sm h-11 sm:h-12 px-4 sm:px-6 gap-2"
                  onClick={handleSubmit}
                  disabled={raceIsWaiting || !expression.trim()}
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">提交</span>
                </Button>
              </div>
              <p className="pl-1 text-[15px] text-muted-foreground">A=1　J=11　Q=12　K=13</p>
              <div className="space-y-2 sm:hidden">
                <div className="grid grid-cols-4 gap-2">
                  {cards.map((card, index) => (
                    <button
                      key={`${card.suit}-${card.value}-${index}-quick`}
                      type="button"
                      onClick={() => appendToken(card.label)}
                      disabled={raceIsWaiting}
                      className="min-h-12 rounded-xl border border-border/70 bg-muted shadow-sm text-lg font-black active:scale-95 active:shadow-none transition-transform disabled:opacity-50 text-foreground"
                      aria-label={`输入 ${card.label}`}
                    >
                      {card.label}
                    </button>
                  ))}
                </div>
                <div className={cn("grid gap-2", level.ops.length === 2 ? "grid-cols-4" : "grid-cols-6")}>
                  {(level.ops.length === 2 ? ["+", "-", "(", ")"] : ["+", "-", "×", "÷", "(", ")"]).map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => appendToken(token)}
                      disabled={raceIsWaiting}
                      className="min-h-12 rounded-xl border border-primary/25 bg-primary/12 shadow-sm text-lg font-black text-primary active:scale-95 active:shadow-none transition-transform disabled:opacity-50"
                      aria-label={`输入 ${token}`}
                    >
                      {token}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={deleteToken}
                    disabled={raceIsWaiting}
                    className="min-h-12 rounded-xl border border-border/70 bg-muted shadow-sm text-lg font-black active:scale-95 active:shadow-none transition-transform disabled:opacity-50 text-foreground"
                  >
                    删除
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExpression("")
                      if (error) setError("")
                    }}
                    disabled={raceIsWaiting}
                    className="min-h-12 rounded-xl border border-destructive/25 bg-destructive/10 text-lg font-black text-destructive active:scale-95 transition-transform disabled:opacity-50"
                  >
                    清空
                  </button>
                </div>
              </div>
              {error && (
                <p className="pl-1 text-[15px] font-semibold text-destructive">{error}</p>
              )}
            </div>
          )}

          {status === "playing" && hintLevel > 0 && getHintText() && (
            <div className="rounded-2xl bg-muted/50 px-4 py-3 text-[15px] font-semibold text-foreground">
              {getHintText()}
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            {status === "playing" && (
              <Button variant="outline" size="sm" className="min-h-12 gap-1.5 rounded-xl text-base font-bold" onClick={requestHint} disabled={raceIsWaiting || hintLevel >= 3}>
                <Lightbulb className="w-4 h-4" />
                {hintLevel === 0 ? "提示" : hintLevel >= 3 ? "已看完提示" : "再提示一下"}
              </Button>
            )}
            {status === "playing" && (
              <Button variant="outline" size="sm" className="min-h-12 gap-1.5 rounded-xl text-base font-bold" onClick={skipRound} disabled={raceIsWaiting}>
                <SkipForward className="w-3.5 h-3.5" />
                跳过
              </Button>
            )}
            {(status === "solved" || status === "skipped" || status === "timeout") && (
              <Button size="sm" className="min-h-12 gap-1.5 rounded-xl text-base font-bold" onClick={dealNewRound} disabled={raceIsWaiting}>
                <Zap className="w-3.5 h-3.5" />
                下一轮
              </Button>
            )}
            <Button variant="outline" size="sm" className="min-h-12 gap-1.5 rounded-xl text-base font-bold" onClick={newGame} disabled={raceIsWaiting}>
              <RefreshCw className="w-3.5 h-3.5" />
              新游戏
            </Button>
          </div>

          {/* Solutions panel */}
          {(status === "solved" || status === "skipped" || status === "timeout") && solutions.length > 0 && (
            <Card className="playground-info-panel space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="text-base font-bold">可行解法</h3>
                <span className="text-sm text-muted-foreground ml-auto">共 {solutions.length} 种</span>
              </div>
              <SolutionAnimator expression={solutions[0]} target={level.target} />
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {solutions.slice(1).map((sol, i) => (
                  <div
                    key={i}
                    className="text-sm font-mono bg-muted/40 rounded-sm px-3 py-2 text-foreground"
                  >
                    {sol} = {level.target}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Right knowledge panel */}
      <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-10">
        <div className="border-b border-border p-4">
          <RaceOnlinePanel collapsible online={race} gamePath="/playground/24game" />
        </div>
        <Tabs defaultValue="concepts" className="flex-1 flex flex-col">
          <div className="border-b border-border px-4 pt-3">
            <TabsList className="grid grid-cols-2 w-full bg-muted/40">
              <TabsTrigger value="concepts" className="text-xs sm:text-sm">
                概念讲解
              </TabsTrigger>
              <TabsTrigger value="stats" className="text-xs sm:text-sm">
                统计
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
            <TabsContent value="concepts" className="m-0 space-y-5">
              <div className="space-y-2">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  24 点与组合数学
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  24 点游戏的核心是「排列组合 + 运算搜索」。4 张牌有 4! = 24
                  种排列方式，3 个运算符位置各有 4 种选择（+−×÷），再加上 5
                  种不同的括号结构，总共需要搜索 24 × 64 × 5 = 7680 种组合。
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  逆运算思维
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  高手不会暴力尝试，而是倒推：24 可以拆成哪些乘法对？比如 3×8、4×6、2×12、1×24。
                  再看手上的 4 张牌能否凑出这些因子对。这种「目标分解」思维在算法设计中也很常见。
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  表达式树
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  每个合法的四则运算表达式都可以画成一棵二叉树：叶子节点是数字，内部节点是运算符。
                  4 个数字、3 个运算符恰好对应 5 种不同的满二叉树结构。理解这一点有助于你系统地搜索所有可能。
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  为什么它能训练数学思维？
                </h3>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
                  <li>强化对运算优先级和括号的直觉</li>
                  <li>培养「逆向推理」的习惯——从结果反推过程</li>
                  <li>在限时压力下提升心算速度</li>
                  <li>学会穷举与剪枝的平衡——这正是算法的基本功</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="m-0 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-semibold">游戏统计</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col rounded-sm bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">总轮数</span>
                  <span className="text-lg font-semibold tabular-nums">{stats.totalRounds}</span>
                </div>
                <div className="flex flex-col rounded-sm bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">解出</span>
                  <span className="text-lg font-semibold tabular-nums text-emerald-500">{stats.solvedCount}</span>
                </div>
                <div className="flex flex-col rounded-sm bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">跳过</span>
                  <span className="text-lg font-semibold tabular-nums text-blue-500">{stats.skippedCount}</span>
                </div>
                <div className="flex flex-col rounded-sm bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">最长连胜</span>
                  <span className="text-lg font-semibold tabular-nums text-amber-500">{stats.bestStreak}</span>
                </div>
                <div className="flex flex-col rounded-sm bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">最快用时</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {stats.bestTime !== null ? `${stats.bestTime}s` : "—"}
                  </span>
                </div>
                <div className="flex flex-col rounded-sm bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">平均用时</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {stats.averageTime !== null ? `${stats.averageTime}s` : "—"}
                  </span>
                </div>
              </div>

              {stats.totalRounds > 0 && (
                <div className="rounded-sm bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">解出率</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${(stats.solvedCount / stats.totalRounds) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums">
                      {Math.round((stats.solvedCount / stats.totalRounds) * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
