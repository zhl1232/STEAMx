"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Eye } from 'lucide-react'

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
          />
          <div className="flex gap-2">
            <Button
              onClick={handleReject}
              disabled={isReviewing}
              variant="destructive"
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
              className="flex-1"
            >
              取消
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className={`flex gap-2 ${inDialog ? 'mt-6 pt-4 border-t' : 'mt-4'}`}>
        <Button
          onClick={handleApprove}
          disabled={isReviewing}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          批准上线
        </Button>
        <Button
          onClick={() => setShowRejectInput(true)}
          disabled={isReviewing}
          variant="destructive"
          className="flex-1"
        >
          拒绝发布
        </Button>
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl mb-1">{project.title}</CardTitle>
              <CardDescription>
                由 {project.profiles.display_name || project.profiles.username} 提交
              </CardDescription>
            </div>
            <Badge>{project.category}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            {project.image_url && (
              <div className="relative w-32 h-24 shrink-0">
                <OptimizedImage
                  src={project.image_url}
                  alt={project.title}
                  fill
                  variant="thumbnail"
                  className="object-cover rounded-md"
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{project.difficulty}</Badge>
                {project.sub_category && <Badge variant="outline">{project.sub_category}</Badge>}
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
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
                      <h3 className="font-semibold text-lg border-b pb-2">基本信息</h3>
                      {project.image_url && (
                        <div className="relative w-full h-64 rounded-lg overflow-hidden border">
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
                        <p className="text-sm leading-relaxed bg-muted/30 p-3 rounded-md">{project.description}</p>
                      </div>
                    </section>

                    {/* 材料清单 */}
                    <section className="space-y-3">
                      <h3 className="font-semibold text-lg border-b pb-2">所需材料</h3>
                      {project.project_materials && project.project_materials.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-sm pl-2">
                          {project.project_materials
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((m) => (
                              <li key={m.id}>{m.material}</li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">无材料清单</p>
                      )}
                    </section>

                    {/* 步骤 */}
                    <section className="space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">制作步骤</h3>
                      {project.project_steps && project.project_steps.length > 0 ? (
                        <div className="space-y-6">
                          {project.project_steps
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((step, index) => (
                              <div key={step.id} className="border rounded-lg p-4 bg-card">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">{index + 1}</Badge>
                                  {step.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                                {step.image_url && (
                                  <div className="relative w-full h-48 rounded-md overflow-hidden bg-muted">
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
