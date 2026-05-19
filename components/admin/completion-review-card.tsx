"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CheckCircle2, Clock3, Eye, ImageIcon, XCircle } from 'lucide-react'

interface CompletionForReview {
  id: number
  user_id: string
  project_id: number
  completed_at: string
  proof_images: string[]
  proof_captions: string[] | null
  proof_video_url: string | null
  notes: string | null
  status: string
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
  projects: {
    title: string
    category: string
  } | null
}

interface CompletionReviewCardProps {
  completion: CompletionForReview
  onReview: () => void
  readOnly?: boolean
}

export function CompletionReviewCard({ completion, onReview, readOnly = false }: CompletionReviewCardProps) {
  const [isReviewing, setIsReviewing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const { toast } = useToast()

  const authorName = completion.profiles?.display_name || '未知用户'
  const projectTitle = completion.projects?.title || '未知项目'
  const projectCategory = completion.projects?.category || ''
  const firstImage = completion.proof_images?.[0]

  const handleApprove = async () => {
    setIsReviewing(true)
    try {
      const response = await fetch(`/api/admin/completions/${completion.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '审核失败')
      }

      toast({
        title: '作品已批准',
        description: `${authorName} 的作品已通过审核，XP 已发放`,
      })
      onReview()
      setIsDetailOpen(false)
    } catch {
      toast({
        title: '操作失败',
        description: '审核作品时发生错误',
        variant: 'destructive',
      })
    } finally {
      setIsReviewing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: '请输入拒绝原因', variant: 'destructive' })
      return
    }

    setIsReviewing(true)
    try {
      const response = await fetch(`/api/admin/completions/${completion.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejection_reason: rejectionReason,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '拒绝失败')
      }

      toast({
        title: '作品已拒绝',
        description: `${authorName} 的作品已被拒绝`,
      })
      onReview()
      setShowRejectInput(false)
      setRejectionReason('')
      setIsDetailOpen(false)
    } catch {
      toast({
        title: '操作失败',
        description: '拒绝作品时发生错误',
        variant: 'destructive',
      })
    } finally {
      setIsReviewing(false)
    }
  }

  const renderActions = (inDialog = false) => {
    if (readOnly) return null
    if (showRejectInput) {
      return (
        <div className="space-y-2 mt-4">
          <Textarea
            placeholder="请输入拒绝原因..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
            className="rounded-2xl"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleReject}
              disabled={isReviewing}
              variant="destructive"
              className="flex-1 rounded-full"
            >
              确认拒绝
            </Button>
            <Button
              onClick={() => {
                setShowRejectInput(false)
                setRejectionReason('')
              }}
              disabled={isReviewing}
              variant="outline"
              className="flex-1 rounded-full"
            >
              取消
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className={`grid gap-2 sm:grid-cols-2 ${inDialog ? 'mt-6 border-t border-border/70 pt-4' : 'mt-4'}`}>
        <Button
          onClick={handleApprove}
          disabled={isReviewing}
          className="rounded-full bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:text-green-950 dark:hover:bg-green-400"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          批准通过
        </Button>
        <Button
          onClick={() => setShowRejectInput(true)}
          disabled={isReviewing}
          variant="destructive"
          className="rounded-full"
        >
          <XCircle className="mr-2 h-4 w-4" />
          拒绝
        </Button>
      </div>
    )
  }

  return (
    <Card className="surface-subtle overflow-hidden rounded-[24px] border border-border/70 bg-background/74 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {projectCategory && (
                <Badge variant="outline" className="rounded-[10px] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
                  {projectCategory}
                </Badge>
              )}
              <Badge variant="secondary" className="rounded-[10px] bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                待审核作品
              </Badge>
            </div>
            <CardTitle className="line-clamp-2 text-lg leading-snug">
              {authorName} 的作品
            </CardTitle>
            <CardDescription className="mt-2 flex flex-wrap items-center gap-2">
              <span>项目：{projectTitle}</span>
              <span className="hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {new Date(completion.completed_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </CardDescription>
          </div>
          <div className="shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
            {completion.proof_images?.length || 0} 张凭证
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div className="relative h-40 overflow-hidden rounded-2xl border border-border/70 bg-muted sm:h-28">
            {firstImage ? (
              <OptimizedImage
                src={firstImage}
                alt="作品图片"
                fill
                variant="thumbnail"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-5 w-5" />
                无图片凭证
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            {completion.notes && (
              <p className="text-sm text-muted-foreground line-clamp-3">{completion.notes}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">作品 ID：{completion.id}</Badge>
              <Badge variant="outline">{completion.proof_images?.length || 0} 张图片</Badge>
              {completion.proof_video_url && <Badge variant="outline">含视频</Badge>}
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 pt-4">
          {renderActions()}
          <Dialog open={isDetailOpen} onOpenChange={(open) => {
            setIsDetailOpen(open)
            if (!open) {
              setShowRejectInput(false)
              setRejectionReason('')
            }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-2 w-full gap-2 rounded-2xl sm:mt-3">
                  <Eye className="w-4 h-4" /> 查看完整作品与审核
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{authorName} 的作品 - 审核详情</DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto pr-4">
                <div className="space-y-6 py-4">
                  {/* 基本信息 */}
                  <section className="space-y-2">
                    <h3 className="border-b border-border/70 pb-2 text-lg font-semibold">基本信息</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">作者:</span>
                        <div className="flex items-center gap-2 mt-1">
                          {completion.profiles?.avatar_url && (
                            <OptimizedImage src={completion.profiles.avatar_url} width={20} height={20} alt="avatar" variant="avatar" className="rounded-full" />
                          )}
                          <span>{authorName}</span>
                        </div>
                      </div>
                      <div><span className="text-muted-foreground">项目:</span> {projectTitle}</div>
                      <div><span className="text-muted-foreground">分类:</span> {projectCategory || '-'}</div>
                      <div><span className="text-muted-foreground">提交时间:</span> {new Date(completion.completed_at).toLocaleString('zh-CN')}</div>
                    </div>
                  </section>

                  {/* 作品图片 */}
                  <section className="space-y-3">
                      <h3 className="border-b border-border/70 pb-2 text-lg font-semibold">
                        作品图片 ({completion.proof_images?.length || 0})
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {completion.proof_images?.map((img, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/70 bg-muted">
                              <OptimizedImage
                                src={img}
                              alt={`作品图片 ${idx + 1}`}
                              fill
                              variant="cover"
                              className="object-cover"
                            />
                          </div>
                          {completion.proof_captions?.[idx] && (
                            <p className="text-xs text-muted-foreground">{completion.proof_captions[idx]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 视频 */}
                  {completion.proof_video_url && (
                    <section className="space-y-3">
                      <h3 className="border-b border-border/70 pb-2 text-lg font-semibold">作品视频</h3>
                      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/70 bg-muted">
                        <video
                          src={completion.proof_video_url}
                          controls
                          className="w-full h-full object-contain"
                          preload="metadata"
                        >
                          <track kind="captions" />
                        </video>
                      </div>
                    </section>
                  )}

                  {/* 笔记 */}
                  {completion.notes && (
                    <section className="space-y-3">
                      <h3 className="border-b border-border/70 pb-2 text-lg font-semibold">完成笔记</h3>
                      <p className="rounded-2xl border border-border/70 bg-background/80 p-3 text-sm leading-relaxed">{completion.notes}</p>
                    </section>
                  )}
                </div>
              </div>

              {renderActions(true)}
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
