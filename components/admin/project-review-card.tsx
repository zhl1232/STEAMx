"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CheckCircle2, Clock3, Eye, XCircle } from 'lucide-react'

// 定义与 page.tsx 对应的接口
interface Project {
  id: number
  title: string
  description: string
  category: string
  image_url: string
  status: string
  created_at: string
  difficulty: string
  sub_category?: string
  project_steps: {
    id: number
    title: string
    description: string
    image_url: string | null
    sort_order: number
  }[]
  project_materials: {
    id: number
    material: string
    sort_order: number
  }[]
  profiles: {
    username: string
    display_name: string
    avatar_url: string
  }
}

interface ProjectReviewCardProps {
  project: Project
  onReview: () => void
}

export function ProjectReviewCard({ project, onReview }: ProjectReviewCardProps) {
  const [isReviewing, setIsReviewing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const { toast } = useToast()

  const handleApprove = async () => {
    setIsReviewing(true)
    try {
      const response = await fetch(`/api/admin/projects/${project.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })

      if (!response.ok) {
        throw new Error('审核失败')
      }

      toast({
        title: '项目已批准',
        description: `项目 "${project.title}" 已成功批准并公开`,
      })
      onReview()
      setIsDetailOpen(false)
    } catch {
      toast({
        title: '操作失败',
        description: '审核项目时发生错误',
        variant: 'destructive',
      })
    } finally {
      setIsReviewing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: '请输入拒绝原因',
        variant: 'destructive',
      })
      return
    }

    setIsReviewing(true)
    try {
      const response = await fetch(`/api/admin/projects/${project.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejection_reason: rejectionReason
        }),
      })

      if (!response.ok) {
        throw new Error('拒绝失败')
      }

      toast({
        title: '项目已拒绝',
        description: `项目 "${project.title}" 已被拒绝`,
      })
      onReview()
      setShowRejectInput(false)
      setRejectionReason('')
      setIsDetailOpen(false)
    } catch {
      toast({
        title: '操作失败',
        description: '拒绝项目时发生错误',
        variant: 'destructive',
      })
    } finally {
      setIsReviewing(false)
    }
  }

  // 渲染操作区域
  const renderActions = (inDialog = false) => {
    if (showRejectInput) {
      return (
        <div className="space-y-2 mt-4">
          <Textarea
            placeholder="请输入拒绝原因..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
            className="rounded-md"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleReject}
              disabled={isReviewing}
              variant="destructive"
              shape="pill"
              className="flex-1"
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
              shape="pill"
              className="flex-1"
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
          tone="success"
          shape="pill"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          批准上线
        </Button>
        <Button
          onClick={() => setShowRejectInput(true)}
          disabled={isReviewing}
          variant="destructive"
          shape="pill"
        >
          <XCircle className="mr-2 h-4 w-4" />
          拒绝发布
        </Button>
      </div>
    )
  }

  return (
    <>
      <Card className="admin-panel-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-sm bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
                  {project.category}
                </Badge>
                <Badge variant="secondary" className="status-warning-surface rounded-[var(--radius-xs)] border text-[hsl(var(--status-warning))]">
                  待审核
                </Badge>
              </div>
              <CardTitle className="line-clamp-2 text-xl leading-snug">{project.title}</CardTitle>
              <CardDescription className="mt-2 flex flex-wrap items-center gap-2">
                <span>由 {project.profiles.display_name || project.profiles.username} 提交</span>
                <span className="hidden sm:inline">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {new Date(project.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </CardDescription>
            </div>
            <div className="status-success-surface shrink-0 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-semibold">
              低风险
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div className="relative h-40 overflow-hidden rounded-md border border-border/70 bg-muted sm:h-28">
              {project.image_url ? (
                <OptimizedImage
                  src={project.image_url}
                  alt={project.title}
                  fill
                  variant="thumbnail"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  无封面图
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">项目 ID：{project.id}</Badge>
                <Badge variant="outline">{project.difficulty}</Badge>
                {project.sub_category && <Badge variant="outline">{project.sub_category}</Badge>}
                <Badge variant="outline">{project.project_steps?.length || 0} 步</Badge>
                <Badge variant="outline">{project.project_materials?.length || 0} 项材料</Badge>
              </div>
            </div>
          </div>

          <div className="border-t border-border/70 pt-4">
            {renderActions()}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-2 w-full gap-2 sm:mt-3">
                  <Eye className="w-4 h-4" /> 查看完整详情与审核
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>{project.title} - 审核详情</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-4">
                  <div className="space-y-6 py-4">
                    {/* 基本信息 */}
                    <section className="space-y-4">
                      <h3 className="border-b border-border/70 pb-2 text-lg font-semibold">基本信息</h3>
                      {project.image_url && (
                        <div className="relative h-64 w-full overflow-hidden rounded-[var(--radius-lg)] border border-border/70">
                          <OptimizedImage
                            src={project.image_url}
                            alt={project.title}
                            fill
                            variant="cover"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <span className="text-muted-foreground">作者:</span>
                          <div className="flex items-center gap-2">
                            {project.profiles.avatar_url && (
                              <OptimizedImage src={project.profiles.avatar_url} width={20} height={20} alt="avatar" variant="avatar" className="rounded-full" />
                            )}
                            <span>{project.profiles.display_name}</span>
                          </div>
                        </div>
                        <div><span className="text-muted-foreground">提交时间:</span> {new Date(project.created_at).toLocaleString('zh-CN')}</div>
                        <div><span className="text-muted-foreground">分类:</span> {project.category} / {project.sub_category || '-'}</div>
                        <div><span className="text-muted-foreground">难度:</span> {project.difficulty}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-sm block mb-1">项目描述:</span>
                        <p className="rounded-md border border-border/70 bg-background/80 p-3 text-sm leading-relaxed">{project.description}</p>
                      </div>
                    </section>

                    {/* 材料清单 */}
                    <section className="space-y-3">
                      <h3 className="border-b border-border/70 pb-2 text-lg font-semibold">所需材料</h3>
                      {project.project_materials && project.project_materials.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {project.project_materials
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((m) => (
                              <li key={m.id} className="rounded-md border border-border/70 bg-background/80 px-3 py-2">{m.material}</li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">无材料清单</p>
                      )}
                    </section>

                    {/* 步骤 */}
                    <section className="space-y-4">
                      <h3 className="border-b border-border/70 pb-2 text-lg font-semibold">制作步骤</h3>
                      {project.project_steps && project.project_steps.length > 0 ? (
                        <div className="space-y-6">
                          {project.project_steps
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((step, index) => (
                              <div key={step.id} className="rounded-[var(--radius-lg)] border border-border/70 bg-background/80 p-4">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">{index + 1}</Badge>
                                  {step.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                                {step.image_url && (
                                  <div className="relative h-48 w-full overflow-hidden rounded-md bg-muted">
                                    <OptimizedImage
                                      src={step.image_url}
                                      alt={step.title}
                                      fill
                                      variant="cover"
                                      className="object-cover"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">无步骤详情</p>
                      )}
                    </section>
                  </div>
                </div>

                {/* Dialog 内的操作区 */}
                {renderActions(true)}
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
