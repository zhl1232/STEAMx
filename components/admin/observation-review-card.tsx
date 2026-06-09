"use client"

import { useState } from 'react'
import { CheckCircle2, Clock3, Eye, ImageIcon, MapPin, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { useToast } from '@/hooks/use-toast'

export interface ObservationForReview {
  id: number
  user_id: string
  observed_at: string
  created_at: string
  location_name: string
  habitat: string | null
  weather: string | null
  notes: string | null
  media_urls: string[]
  is_public: boolean
  status: string
  nature_topic: string | null
  lifecycle_stage: string | null
  sex: string | null
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
  species: {
    id: number
    common_name: string
    scientific_name: string | null
  }[]
}

interface ObservationReviewCardProps {
  observation: ObservationForReview
  onReview: () => void
}

const topicLabels: Record<string, string> = {
  birds: '鸟类',
  plants: '植物',
  insects: '昆虫',
}

const lifecycleStageLabels: Record<string, string> = {
  egg: '卵',
  larva: '幼虫',
  pupa: '蛹',
  juvenile: '幼体',
  adult: '成体',
}

const sexLabels: Record<string, string> = {
  male: '雄性',
  female: '雌性',
}

function formatLabel(value: string | null, labels: Record<string, string>, fallback: string) {
  if (!value) return fallback
  return labels[value] || value
}

function formatTrait(value: string | null, labels: Record<string, string>) {
  if (!value || value === 'unknown') return null
  return labels[value] || value
}

export function ObservationReviewCard({ observation, onReview }: ObservationReviewCardProps) {
  const { toast } = useToast()
  const [isReviewing, setIsReviewing] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const authorName = observation.profiles?.display_name || '未知用户'
  const cover = observation.media_urls[0]
  const speciesLabel = observation.species.length > 0
    ? observation.species.map((item) => item.common_name).join('、')
    : '待鉴定'

  const review = async (status: 'approved' | 'rejected') => {
    setIsReviewing(true)
    try {
      const response = await fetch(`/api/admin/observations/${observation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || '审核失败')
      }

      toast({
        title: status === 'approved' ? '自然观察已通过' : '自然观察已拒绝',
        description: status === 'approved'
          ? payload?.rewardError
            ? '记录已公开，但奖励同步失败，请稍后检查'
            : '记录已进入公开观察流，奖励会同步发放'
          : '记录已从审核队列移除',
        variant: payload?.rewardError ? 'destructive' : undefined,
      })
      onReview()
      setIsDetailOpen(false)
    } catch (error) {
      toast({
        title: '审核失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setIsReviewing(false)
    }
  }

  return (
    <article className="admin-panel-card space-y-4 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="relative h-40 overflow-hidden rounded-md border border-border/70 bg-muted sm:h-28">
          {cover ? (
            <OptimizedImage src={cover} alt={speciesLabel} fill variant="cover" className="object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
              无观察图片
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-sm bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              {formatLabel(observation.nature_topic, topicLabels, '自然观察')}
            </Badge>
            <Badge variant="secondary" className="status-warning-surface rounded-[var(--radius-xs)] border text-[hsl(var(--status-warning))]">
              待审核观察
            </Badge>
            <Badge variant="outline">{observation.is_public ? '公开' : '仅自己可见'}</Badge>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug">{speciesLabel}</h3>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>作者：{authorName}</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {new Date(observation.created_at).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{observation.location_name}</span>
          </p>
          {observation.notes ? (
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{observation.notes}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">观察 ID：{observation.id}</Badge>
            <Badge variant="outline">{observation.media_urls.length} 张图片</Badge>
            {formatTrait(observation.lifecycle_stage, lifecycleStageLabels) ? (
              <Badge variant="outline">{formatTrait(observation.lifecycle_stage, lifecycleStageLabels)}</Badge>
            ) : null}
            {formatTrait(observation.sex, sexLabels) ? (
              <Badge variant="outline">{formatTrait(observation.sex, sexLabels)}</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-2 border-t border-border/70 pt-4 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{speciesLabel}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">作者：</span>
                  {authorName}
                </div>
                <div>
                  <span className="text-muted-foreground">主题：</span>
                  {formatLabel(observation.nature_topic, topicLabels, '自然观察')}
                </div>
                <div>
                  <span className="text-muted-foreground">观察时间：</span>
                  {new Date(observation.observed_at).toLocaleString('zh-CN')}
                </div>
                <div>
                  <span className="text-muted-foreground">提交时间：</span>
                  {new Date(observation.created_at).toLocaleString('zh-CN')}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">地点：</span>
                  {observation.location_name}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {observation.media_urls.map((image, index) => (
                  <div key={`${image}-${index}`} className="relative aspect-video overflow-hidden rounded-md border border-border/70 bg-muted">
                    <OptimizedImage src={image} alt={`${speciesLabel}-${index + 1}`} fill variant="cover" className="object-cover" />
                  </div>
                ))}
              </div>

              {observation.notes || observation.habitat || observation.weather ? (
                <div className="space-y-3 rounded-md border border-border/70 bg-background/70 p-4 text-sm leading-7">
                  {observation.notes ? <p>{observation.notes}</p> : null}
                  {observation.habitat ? <p className="text-muted-foreground">生境：{observation.habitat}</p> : null}
                  {observation.weather ? <p className="text-muted-foreground">天气：{observation.weather}</p> : null}
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Button tone="success" shape="pill" onClick={() => void review('approved')} disabled={isReviewing}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          通过观察
        </Button>
        <Button variant="destructive" shape="pill" onClick={() => void review('rejected')} disabled={isReviewing}>
          <XCircle className="mr-2 h-4 w-4" />
          拒绝
        </Button>
      </div>
    </article>
  )
}
