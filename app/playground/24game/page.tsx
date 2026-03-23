"use client"

import { useEffect, useState } from "react"
import { use24Game, type Card24 } from "@/hooks/use24Game"
import { useGamification } from "@/context/gamification-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
} from "lucide-react"
import confetti from "canvas-confetti"

const SUIT_SYMBOL: Record<Card24["suit"], string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
}

function PlayingCard({ card }: { card: Card24 }) {
  const isRed = card.suit === "hearts" || card.suit === "diamonds"
  const color = isRed ? "text-red-500" : "text-gray-900 dark:text-gray-100"
  const symbol = SUIT_SYMBOL[card.suit]

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center",
        "w-[72px] h-[100px] sm:w-[100px] sm:h-[140px] md:w-[120px] md:h-[170px]",
        "rounded-2xl border border-border/60 bg-white dark:bg-gray-50/95",
        "shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200",
        "select-none"
      )}
    >
      <div className={cn("absolute top-1.5 left-2 sm:top-2 sm:left-3 flex flex-col items-center leading-none", color)}>
        <span className="text-xs sm:text-sm md:text-base font-bold">{card.label}</span>
        <span className="text-[10px] sm:text-xs">{symbol}</span>
      </div>
      <span className={cn("text-2xl sm:text-4xl md:text-5xl", color)}>{symbol}</span>
      <div className={cn("absolute bottom-1.5 right-2 sm:bottom-2 sm:right-3 flex flex-col items-center leading-none rotate-180", color)}>
        <span className="text-xs sm:text-sm md:text-base font-bold">{card.label}</span>
        <span className="text-[10px] sm:text-xs">{symbol}</span>
      </div>
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
    cards,
    status,
    timeLeft,
    round,
    streak,
    stats,
    solutions,
    submitExpression,
    skipRound,
    newGame,
    dealNewRound,
  } = use24Game()
  const { checkBadges } = useGamification()

  const [expression, setExpression] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    newGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status === "playing") {
      setExpression("")
      setError("")
    }
  }, [status, round])

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

  const handleSubmit = () => {
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

  return (
    <div className="flex flex-col xl:flex-row h-full">
      {/* Main game area */}
      <div className="flex-1 p-2 sm:p-6 xl:p-10 flex flex-col items-center xl:justify-center w-full">
        {/* Header */}
        <div className="w-full max-w-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-primary/10 border border-primary/40 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">
                24 点 · 组合数学挑战
              </h1>
              <p className="text-[11px] sm:text-sm text-muted-foreground">
                用四则运算与括号，让 4 张牌恰好算出 24。
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
          {/* Timer */}
          <div className="flex items-center gap-3">
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
          <div className="flex justify-center gap-2 sm:gap-4">
            {cards.map((card, i) => (
              <PlayingCard key={`${card.suit}-${card.value}-${i}`} card={card} />
            ))}
          </div>

          {/* Status banners */}
          {status === "solved" && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center gap-3">
              <Trophy className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">太棒了！</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                  你成功算出了 24，点击「下一轮」继续挑战。
                </p>
              </div>
            </div>
          )}
          {status === "timeout" && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 flex items-center gap-3">
              <Timer className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">时间到！</p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70">
                  别灰心，看看下方的解法，学习新思路。
                </p>
              </div>
            </div>
          )}
          {status === "skipped" && (
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 px-4 py-3 flex items-center gap-3">
              <Eye className="w-5 h-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">已跳过，查看解法</p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                  跳过不丢人，理解解法才是关键。
                </p>
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
                  placeholder="用 +, -, *, / 和括号组出 24"
                  className={cn(
                    "flex-1 h-11 sm:h-12 rounded-xl border bg-background px-4 text-sm sm:text-base",
                    "placeholder:text-muted-foreground/60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/40",
                    "transition-colors",
                    error
                      ? "border-red-400 focus-visible:ring-red-400/50"
                      : "border-border"
                  )}
                />
                <Button
                  size="lg"
                  className="rounded-xl h-11 sm:h-12 px-4 sm:px-6 gap-2"
                  onClick={handleSubmit}
                  disabled={!expression.trim()}
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">提交</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground pl-1">
                支持直接输入 <span className="font-mono">A / J / Q / K</span>，也可写成{" "}
                <span className="font-mono">1 / 11 / 12 / 13</span>。
              </p>
              {error && (
                <p className="text-xs text-red-500 pl-1">{error}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {status === "playing" && (
              <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={skipRound}>
                <SkipForward className="w-3.5 h-3.5" />
                跳过
              </Button>
            )}
            {(status === "solved" || status === "skipped" || status === "timeout") && (
              <Button size="sm" className="rounded-full gap-1.5" onClick={dealNewRound}>
                <Zap className="w-3.5 h-3.5" />
                下一轮
              </Button>
            )}
            <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={newGame}>
              <RefreshCw className="w-3.5 h-3.5" />
              新游戏
            </Button>
          </div>

          {/* Solutions panel */}
          {(status === "solved" || status === "skipped" || status === "timeout") && solutions.length > 0 && (
            <Card className="bg-card/60 backdrop-blur-xl border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">可行解法</h3>
                <span className="text-[11px] text-muted-foreground ml-auto">共 {solutions.length} 种</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {solutions.map((sol, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono bg-muted/40 rounded-lg px-3 py-1.5 text-muted-foreground"
                  >
                    {sol} = 24
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Right knowledge panel */}
      <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-10">
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
                <h3 className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  逆运算思维
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  高手不会暴力尝试，而是倒推：24 可以拆成哪些乘法对？比如 3×8、4×6、2×12、1×24。
                  再看手上的 4 张牌能否凑出这些因子对。这种「目标分解」思维在算法设计中也很常见。
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  表达式树
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  每个合法的四则运算表达式都可以画成一棵二叉树：叶子节点是数字，内部节点是运算符。
                  4 个数字、3 个运算符恰好对应 5 种不同的满二叉树结构。理解这一点有助于你系统地搜索所有可能。
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-1.5">
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
                <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">总轮数</span>
                  <span className="text-lg font-semibold tabular-nums">{stats.totalRounds}</span>
                </div>
                <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">解出</span>
                  <span className="text-lg font-semibold tabular-nums text-emerald-500">{stats.solvedCount}</span>
                </div>
                <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">跳过</span>
                  <span className="text-lg font-semibold tabular-nums text-blue-500">{stats.skippedCount}</span>
                </div>
                <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">最长连胜</span>
                  <span className="text-lg font-semibold tabular-nums text-amber-500">{stats.bestStreak}</span>
                </div>
                <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">最快用时</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {stats.bestTime !== null ? `${stats.bestTime}s` : "—"}
                  </span>
                </div>
                <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">平均用时</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {stats.averageTime !== null ? `${stats.averageTime}s` : "—"}
                  </span>
                </div>
              </div>

              {stats.totalRounds > 0 && (
                <div className="rounded-xl bg-muted/40 px-3 py-2.5">
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
