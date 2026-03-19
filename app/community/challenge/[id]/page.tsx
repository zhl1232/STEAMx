"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Trophy, ArrowLeft, CheckCircle, Play, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { CountdownTimer } from "@/components/ui/countdown-timer"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { useCommunity } from "@/context/community-context"
import { PblInfo } from "@/components/features/challenge/pbl-info"
import { StageGuide } from "@/components/features/challenge/stage-guide"
import { SubmissionGallery } from "@/components/features/challenge/submission-gallery"
import type { Challenge } from "@/lib/mappers/types"

export default function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params)
  const { joinChallenge } = useCommunity()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const router = useRouter()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const postLoginJoinRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    postLoginJoinRef.current = async () => {
      if (!challenge) return
      setChallenge(prev => prev ? { ...prev, joined: true, participants: prev.participants + 1 } : prev)
      try {
        await joinChallenge(challenge.id)
      } catch {
        setChallenge(prev => prev ? { ...prev, joined: false, participants: Math.max(0, prev.participants - 1) } : prev)
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
    fetchChallenge()
  }, [unwrappedParams.id])

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">挑战不存在</h1>
        <Button onClick={() => router.back()}>返回列表</Button>
      </div>
    )
  }

  const isTimed = challenge.challengeType === 'timed'
  const isEnded = challenge.status === 'ended'

  const handleJoin = () => {
    if (!user) {
      promptLogin(() => {
        void postLoginJoinRef.current?.()
      }, {
        title: '登录以参与挑战',
        description: '登录后即可报名参与挑战'
      })
      return
    }
    const wasJoined = challenge.joined
    setChallenge(prev => prev ? {
      ...prev,
      joined: !wasJoined,
      participants: prev.participants + (wasJoined ? -1 : 1),
    } : prev)
    void joinChallenge(challenge.id).catch(() => {
      setChallenge(prev => prev ? {
        ...prev,
        joined: wasJoined,
        participants: prev.participants + (wasJoined ? 1 : -1),
      } : prev)
    })
  }

  const handleSubmit = () => {
    router.push(`/share?challenge=${challenge.id}`)
  }

  const STEAM_LABEL: Record<string, string> = { S: '科学', T: '技术', E: '工程', A: '艺术', M: '数学' }

  return (
    <div className="container mx-auto py-8 md:py-12 max-w-5xl px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0 hover:pl-2 transition-all">
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回社区
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cover image */}
          <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg">
            <OptimizedImage src={challenge.image} alt={challenge.title} fill variant="cover" className="object-cover" />
            {isTimed && challenge.endDate && !isEnded && (
              <div className="absolute top-4 right-4">
                <CountdownTimer endDate={challenge.endDate} />
              </div>
            )}
            {isEnded && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">已结束</span>
              </div>
            )}
          </div>

          {/* Title + status + tags */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant={isTimed ? 'default' : 'secondary'}>
                {isTimed ? '限时挑战' : '长期挑战'}
              </Badge>
              {challenge.difficultyStars && (
                <Badge variant="outline">{'★'.repeat(challenge.difficultyStars)} 难度</Badge>
              )}
              {challenge.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">{tag}</span>
              ))}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">{challenge.title}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">{challenge.description}</p>
          </div>

          {/* STEAM dimension tags */}
          {challenge.steamWeights && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(challenge.steamWeights)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([dim, weight]) => (
                  <Badge key={dim} variant="outline" className="text-xs">
                    {STEAM_LABEL[dim] || dim}: {weight}
                  </Badge>
                ))}
            </div>
          )}

          {/* PBL info */}
          <PblInfo challenge={challenge} />

          {/* Stages */}
          {challenge.stages && challenge.stages.length > 0 && (
            <StageGuide stages={challenge.stages} />
          )}

          {/* Submissions gallery */}
          <SubmissionGallery
            challengeId={Number(challenge.id)}
            challengeType={challenge.challengeType}
          />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <div className="text-center mb-6">
                {isTimed ? (
                  <>
                    <div className="text-4xl font-bold mb-2">{challenge.participants}</div>
                    <div className="text-muted-foreground flex items-center justify-center gap-2">
                      <Users className="h-4 w-4" />
                      人参与
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-bold mb-2">{challenge.completionsCount || 0}</div>
                    <div className="text-muted-foreground flex items-center justify-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      人已完成
                    </div>
                  </>
                )}
              </div>

              {!isEnded && (
                <>
                  <Button
                    onClick={handleJoin}
                    className={cn(
                      "w-full h-12 text-lg font-semibold transition-all",
                      challenge.joined ? "bg-green-600 hover:bg-green-700 text-white" : ""
                    )}
                  >
                    {challenge.joined ? (
                      <>
                        <CheckCircle className="mr-2 h-5 w-5" />
                        {isTimed ? '已报名' : '已参与'}
                      </>
                    ) : (
                      <>
                        {isTimed ? <Trophy className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
                        {isTimed ? '立即报名' : '开始挑战'}
                      </>
                    )}
                  </Button>

                  {challenge.joined && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        {challenge.completed ? '你已完成此挑战，可以继续改进作品' : '准备好提交作品了吗？'}
                      </p>
                      <Button variant="outline" className="w-full" onClick={handleSubmit}>
                        {challenge.completed ? '更新作品' : '提交作品'}
                      </Button>
                    </div>
                  )}

                  {challenge.completed && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">已完成</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rewards info */}
            <div className="bg-muted/30 rounded-xl p-6 border">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                奖励
              </h3>
              {isTimed ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🥇</span>
                    <div>
                      <div className="font-semibold">第1名</div>
                      <div className="text-muted-foreground">限定徽章 + 20 硬币</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🥈</span>
                    <div>
                      <div className="font-semibold">第2名</div>
                      <div className="text-muted-foreground">限定徽章 + 10 硬币</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🥉</span>
                    <div>
                      <div className="font-semibold">第3名</div>
                      <div className="text-muted-foreground">限定徽章 + 5 硬币</div>
                    </div>
                  </div>
                  <p className="text-muted-foreground pt-2 border-t">所有参与者均可获得 +20 XP</p>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏅</span>
                    <div>
                      <div className="font-semibold">完成奖励</div>
                      <div className="text-muted-foreground">+20 XP + 完成徽章</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✨</span>
                    <div>
                      <div className="font-semibold">PBL 加分</div>
                      <div className="text-muted-foreground">填写反思和试错记录额外 +10 XP</div>
                    </div>
                  </div>
                  <p className="text-muted-foreground pt-2 border-t">STEAM 雷达图同步更新</p>
                </div>
              )}
            </div>

            {/* Timed challenge: dates */}
            {isTimed && challenge.startDate && (
              <div className="bg-card border rounded-xl p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">开始</span>
                  <span>{new Date(challenge.startDate).toLocaleDateString('zh-CN')}</span>
                </div>
                {challenge.endDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">截止</span>
                    <span>{new Date(challenge.endDate).toLocaleDateString('zh-CN')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
