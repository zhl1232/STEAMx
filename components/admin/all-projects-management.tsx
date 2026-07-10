"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Edit, Eye, Loader2 } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { getApiErrorMessage } from "@/lib/utils/http"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OptimizedImage } from "@/components/ui/optimized-image"

export interface AdminProjectSummary {
  id: number
  title: string
  description: string | null
  category: string | null
  image_url: string | null
  status: string
  created_at: string
  profiles: {
    username: string | null
    display_name: string | null
    avatar_url: string | null
  } | null
}

interface AdminProjectDetail extends AdminProjectSummary {
  difficulty_stars: number | null
  sub_categories: {
    name: string | null
  } | null
  project_steps: {
    id: number
    title: string
    description: string | null
    image_url: string | null
    sort_order: number
  }[]
  project_materials: {
    id: number
    material: string
    sort_order: number
  }[]
}

interface AllProjectsManagementProps {
  projects: AdminProjectSummary[]
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge variant="secondary" className="status-success-surface border text-[hsl(var(--status-success))]">已发布</Badge>
    case "pending":
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">待审核</Badge>
    case "rejected":
      return <Badge variant="secondary" className="bg-red-100 text-red-800">已拒绝</Badge>
    case "draft":
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800">草稿</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function formatDifficulty(stars: number | null) {
  if (!stars) return "未设置"
  return `${stars} 星`
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("zh-CN")
}

export function AllProjectsManagement({ projects }: AllProjectsManagementProps) {
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<number, boolean>>({})
  const [detailsById, setDetailsById] = useState<Record<number, AdminProjectDetail>>({})
  const [loadingById, setLoadingById] = useState<Record<number, boolean>>({})
  const [errorsById, setErrorsById] = useState<Record<number, string>>({})
  const { toast } = useToast()

  const loadProjectDetail = async (projectId: number) => {
    setLoadingById((current) => ({ ...current, [projectId]: true }))
    setErrorsById((current) => {
      const next = { ...current }
      delete next[projectId]
      return next
    })

    try {
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "加载项目详情失败"))
      }

      const payload = await response.json() as { project: AdminProjectDetail }
      setDetailsById((current) => ({ ...current, [projectId]: payload.project }))
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载项目详情失败"
      setErrorsById((current) => ({ ...current, [projectId]: message }))
      toast({
        title: "展开失败",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoadingById((current) => ({ ...current, [projectId]: false }))
    }
  }

  const toggleExpand = async (projectId: number) => {
    const isExpanded = expandedProjectIds[projectId] ?? false

    if (isExpanded) {
      setExpandedProjectIds((current) => ({ ...current, [projectId]: false }))
      return
    }

    setExpandedProjectIds((current) => ({ ...current, [projectId]: true }))

    if (!detailsById[projectId] && !loadingById[projectId]) {
      await loadProjectDetail(projectId)
    }
  }

  return (
    <Card className="surface-subtle shadow-none">
      <CardHeader>
        <CardTitle>项目管理</CardTitle>
        <CardDescription>显示封面与简介，展开后再加载步骤和材料等完整详情</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">暂无项目</div>
        ) : (
          projects.map((project) => {
            const isExpanded = expandedProjectIds[project.id] ?? false
            const detail = detailsById[project.id]
            const isLoading = loadingById[project.id] ?? false
            const error = errorsById[project.id]
            const authorName = project.profiles?.display_name || project.profiles?.username || "未知用户"

            return (
              <Card key={project.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/70 shadow-none">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-4 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="relative h-40 w-full overflow-hidden rounded-(--radius-lg) border border-border/70 bg-muted sm:h-36 lg:h-32 lg:w-48 lg:shrink-0">
                        {project.image_url ? (
                          <OptimizedImage
                            src={project.image_url}
                            alt={project.title}
                            fill
                            variant="card"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            无封面图
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold leading-tight sm:text-xl">{project.title}</h3>
                              {getStatusBadge(project.status)}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground sm:text-sm">
                              <Badge variant="outline">{project.category || "未分类"}</Badge>
                              <Badge variant="outline">作者：{authorName}</Badge>
                              <Badge variant="outline">{new Date(project.created_at).toLocaleDateString("zh-CN")}</Badge>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Link href={`/project/${project.id}`} target="_blank">
                              <Button variant="outline" size="sm">
                                <Eye className="mr-2 h-4 w-4" />
                                查看
                              </Button>
                            </Link>
                            <Link href={`/admin/projects/${project.id}`}>
                              <Button variant="outline" size="sm">
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </Button>
                            </Link>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => void toggleExpand(project.id)}
                              aria-expanded={isExpanded}
                            >
                              {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <ChevronDown
                                  className={cn("mr-2 h-4 w-4 transition-transform", isExpanded && "rotate-180")}
                                />
                              )}
                              {isExpanded ? "收起详情" : "展开详情"}
                            </Button>
                          </div>
                        </div>

                        <p className="text-sm leading-7 text-muted-foreground line-clamp-3">
                          {project.description?.trim() || "暂无项目描述"}
                        </p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="rounded-(--radius-lg) border border-border/70 bg-muted/20 p-4 sm:p-5">
                        {isLoading && !detail ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            正在加载项目详情...
                          </div>
                        ) : error && !detail ? (
                          <div className="space-y-3">
                            <p className="text-sm text-destructive">{error}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void loadProjectDetail(project.id)}
                            >
                              重试加载
                            </Button>
                          </div>
                        ) : detail ? (
                          <div className="space-y-5">
                            <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                              <div className="rounded-md border border-border/60 bg-background/80 px-4 py-3">
                                <div className="text-xs text-muted-foreground">作者</div>
                                <div className="mt-1 font-medium">{authorName}</div>
                              </div>
                              <div className="rounded-md border border-border/60 bg-background/80 px-4 py-3">
                                <div className="text-xs text-muted-foreground">提交时间</div>
                                <div className="mt-1 font-medium">{formatDate(detail.created_at)}</div>
                              </div>
                              <div className="rounded-md border border-border/60 bg-background/80 px-4 py-3">
                                <div className="text-xs text-muted-foreground">分类 / 难度</div>
                                <div className="mt-1 font-medium">
                                  {detail.category || "未分类"}
                                  {detail.sub_categories?.name ? ` / ${detail.sub_categories.name}` : ""}
                                  {` / ${formatDifficulty(detail.difficulty_stars)}`}
                                </div>
                              </div>
                            </div>

                            <section className="space-y-2">
                              <h4 className="text-sm font-semibold">完整描述</h4>
                              <div className="rounded-lg border border-border/60 bg-background/80 p-4 text-sm leading-7 text-muted-foreground">
                                {detail.description?.trim() || "暂无项目描述"}
                              </div>
                            </section>

                            <section className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">材料清单</h4>
                                <span className="text-xs text-muted-foreground">
                                  {detail.project_materials.length} 项
                                </span>
                              </div>
                              {detail.project_materials.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {[...detail.project_materials]
                                    .sort((a, b) => a.sort_order - b.sort_order)
                                    .map((material) => (
                                      <Badge
                                        key={material.id}
                                        variant="outline"
                                        className="rounded-full px-3 py-1 text-sm"
                                      >
                                        {material.material}
                                      </Badge>
                                    ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">暂无材料清单</p>
                              )}
                            </section>

                            <section className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">步骤详情</h4>
                                <span className="text-xs text-muted-foreground">
                                  {detail.project_steps.length} 步
                                </span>
                              </div>
                              {detail.project_steps.length > 0 ? (
                                <div className="space-y-3">
                                  {[...detail.project_steps]
                                    .sort((a, b) => a.sort_order - b.sort_order)
                                    .map((step, index) => (
                                      <div
                                        key={step.id}
                                        className="rounded-lg border border-border/60 bg-background/80 p-4"
                                      >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                                          <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="secondary" className="h-6 min-w-6 justify-center rounded-full px-2">
                                                {index + 1}
                                              </Badge>
                                              <h5 className="font-medium">{step.title}</h5>
                                            </div>
                                            <p className="text-sm leading-7 text-muted-foreground">
                                              {step.description?.trim() || "暂无步骤说明"}
                                            </p>
                                          </div>

                                          {step.image_url && (
                                            <div className="relative h-32 w-full overflow-hidden rounded-lg border border-border/60 bg-muted lg:h-28 lg:w-40 lg:shrink-0">
                                              <OptimizedImage
                                                src={step.image_url}
                                                alt={step.title}
                                                fill
                                                variant="thumbnail"
                                                className="object-cover"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">暂无步骤详情</p>
                              )}
                            </section>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
