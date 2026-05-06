"use client"

import { useState } from 'react'
import { CheckCircle2, Clock3, Eye, ImageIcon, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { useToast } from '@/hooks/use-toast'

interface ChallengeSubmissionForReview {
  id: number
  challenge_id: number
  user_id: string
  title: string
  notes: string | null
  proof_images: string[]
  proof_captions: string[] | null
  proof_video_url: string | null
  is_public: boolean
  status: string
  challenges: {
    title: string
  } | null
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
  referenceProjects: {
    id: number
    title: string
  }[]
}

export function ChallengeSubmissionReviewCard({
  submission,
  onReview,
}: {
  submission: ChallengeSubmissionForReview
  onReview: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const authorName = submission.profiles?.display_name || '未知用户'
  const challengeTitle = submission.challenges?.title || '未知挑战'
  const cover = submission.proof_images[0]

  const review = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) {
      toast({ title: '请填写驳回原因', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/challenge-submissions/${submission.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejection_reason: action === 'reject' ? rejectReason.trim() : undefined,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || '审核失败')
      }

      toast({ title: action === 'approve' ? '挑战作品已批准' : '挑战作品已拒绝' })
      onReview()
    } catch (error) {
      toast({
        title: '审核失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className="surface-subtle space-y-4 rounded-[24px] border border-border/70 bg-background/74 p-4 shadow-none sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="relative h-40 overflow-hidden rounded-2xl border border-border/70 bg-muted sm:h-28">
          {cover ? (
            <OptimizedImage src={cover} alt={submission.title} fill variant="cover" className="object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
              无图片凭证
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-[10px] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">挑战作品</Badge>
            <Badge variant="secondary" className="rounded-[10px] bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">待审核</Badge>
            <Badge variant="outline">{submission.is_public ? '公开' : '未公开'}</Badge>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug">{submission.title}</h3>
          <p className="text-sm text-muted-foreground">挑战：{challengeTitle}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>作者：{authorName}</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              作品 ID：{submission.id}
            </span>
          </p>
          {submission.notes ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{submission.notes}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{submission.proof_images.length} 张图片</Badge>
            {submission.proof_video_url ? <Badge variant="outline">含视频</Badge> : null}
            {submission.referenceProjects.length > 0 ? <Badge variant="outline">{submission.referenceProjects.length} 个参考项目</Badge> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-2 border-t border-border/70 pt-4 md:grid-cols-[auto_auto_minmax(0,1fr)] md:items-center">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="rounded-full">
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{submission.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                {submission.proof_images.map((image, index) => (
                  <div key={`${image}-${index}`} className="space-y-2">
                    <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
                      <OptimizedImage src={image} alt={`${submission.title}-${index + 1}`} fill variant="cover" className="object-cover" />
                    </div>
                    {submission.proof_captions?.[index] ? (
                      <p className="text-xs text-muted-foreground">{submission.proof_captions[index]}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              {submission.proof_video_url ? (
                <video controls className="w-full rounded-2xl border border-border/70 bg-black">
                  <source src={submission.proof_video_url} />
                </video>
              ) : null}

              {submission.notes ? (
                <div className="space-y-2">
                  <h4 className="font-semibold">作品说明</h4>
                  <p className="text-sm leading-7 text-muted-foreground">{submission.notes}</p>
                </div>
              ) : null}

              {submission.referenceProjects.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-semibold">参考项目</h4>
                  <div className="flex flex-wrap gap-2">
                    {submission.referenceProjects.map((project) => (
                      <Badge key={project.id} variant="outline">{project.title}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Button className="rounded-full bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:text-green-950 dark:hover:bg-green-400" onClick={() => void review('approve')} disabled={loading}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          批准
        </Button>

        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="填写驳回原因"
            className="rounded-full"
          />
          <Button variant="destructive" className="rounded-full" onClick={() => void review('reject')} disabled={loading}>
            <XCircle className="mr-2 h-4 w-4" />
            拒绝
          </Button>
        </div>
      </div>
    </article>
  )
}
