"use client"

import { useState } from 'react'
import { Eye } from 'lucide-react'

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
    <article className="surface-subtle space-y-4 rounded-[24px] border border-border/70 p-4 sm:p-5">
      <div className="flex gap-4">
        <div className="relative h-28 w-36 shrink-0 overflow-hidden rounded-2xl bg-muted">
          {cover ? (
            <OptimizedImage src={cover} alt={submission.title} fill variant="cover" className="object-cover" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">挑战作品</Badge>
            <Badge variant="outline">{submission.is_public ? '公开' : '未公开'}</Badge>
          </div>
          <h3 className="text-lg font-semibold">{submission.title}</h3>
          <p className="text-sm text-muted-foreground">挑战：{challengeTitle}</p>
          <p className="text-sm text-muted-foreground">作者：{authorName}</p>
          {submission.notes ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{submission.notes}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{submission.proof_images.length} 张图片</span>
            {submission.proof_video_url ? <span>含视频</span> : null}
            {submission.referenceProjects.length > 0 ? <span>{submission.referenceProjects.length} 个参考项目</span> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
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

        <Button onClick={() => void review('approve')} disabled={loading}>
          批准
        </Button>

        <div className="flex min-w-[280px] flex-1 gap-2">
          <Input
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="填写驳回原因"
          />
          <Button variant="destructive" onClick={() => void review('reject')} disabled={loading}>
            拒绝
          </Button>
        </div>
      </div>
    </article>
  )
}
