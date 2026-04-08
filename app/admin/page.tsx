"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth-context'
import { createClient } from '@/lib/supabase/client'
import { ProjectReviewCard } from '@/components/admin/project-review-card'
import { CompletionReviewCard } from '@/components/admin/completion-review-card'
import { ModeratorApplicationsList } from '@/components/admin/moderator-applications-list'
import { ReportsList } from '@/components/admin/reports-list'
import { ChallengeManagement } from '@/components/admin/challenge-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Eye } from 'lucide-react'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'

// ... Keep existing interfaces if needed, or refine ...
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

interface PendingCompletionRow {
  id: number
  user_id: string
  project_id: number
  completed_at: string
  proof_images: string[]
  proof_captions: string[] | null
  proof_video_url: string | null
  notes: string | null
  status: string
}

interface CompletionProfileRow {
  id: string
  display_name: string | null
  avatar_url: string | null
}

interface CompletionProjectRow {
  id: number
  title: string | null
  category: string | null
}

export default function AdminPage() {
  const { canReview, isAdmin, loading } = useAuth()
  const [pendingProjects, setPendingProjects] = useState<Project[]>([])
  const [pendingCompletions, setPendingCompletions] = useState<CompletionForReview[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  // Fetch pending projects for review
  const fetchPendingProjects = useCallback(async () => {
    // setIsLoading(true) // Don't trigger full page loader for this individual fetch if possible, or handle nicely
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        profiles:author_id (
          username,
          display_name,
          avatar_url
        ),
        project_steps (*),
        project_materials (*)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPendingProjects(data as unknown as Project[])
    }
    // setIsLoading(false)
  }, [supabase])

  const fetchPendingCompletions = useCallback(async () => {
    const { data, error } = await supabase
      .from('completed_projects')
      .select(`
        id, user_id, project_id, completed_at,
        proof_images, proof_captions, proof_video_url,
        notes, status
      `)
      .eq('status', 'pending')
      .order('completed_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch pending completions', error)
      return
    }

    const completionRows = (data || []) as PendingCompletionRow[]
    if (completionRows.length === 0) {
      setPendingCompletions([])
      return
    }

    const userIds = [...new Set(completionRows.map((row) => row.user_id))]
    const projectIds = [...new Set(completionRows.map((row) => row.project_id))]

    const [{ data: profilesData, error: profilesError }, { data: projectsData, error: projectsError }] =
      await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds),
        supabase.from('projects').select('id, title, category').in('id', projectIds),
      ])

    if (profilesError) {
      console.error('Failed to fetch completion profiles', profilesError)
    }

    if (projectsError) {
      console.error('Failed to fetch completion projects', projectsError)
    }

    const profilesById = new Map(
      ((profilesData || []) as CompletionProfileRow[]).map((profile) => [
        profile.id,
        {
          display_name: profile.display_name ?? '未知用户',
          avatar_url: profile.avatar_url,
        },
      ]),
    )

    const projectsById = new Map(
      ((projectsData || []) as CompletionProjectRow[]).map((project) => [
        project.id,
        {
          title: project.title ?? '未知项目',
          category: project.category ?? '',
        },
      ]),
    )

    setPendingCompletions(
      completionRows.map((row) => ({
        ...row,
        profiles: profilesById.get(row.user_id) ?? null,
        projects: projectsById.get(row.project_id) ?? null,
      })),
    )
  }, [supabase])

  // Fetch all projects for management
  const fetchAllProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        profiles:author_id (
          username,
          display_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setAllProjects(data as unknown as Project[])
    }
  }, [supabase])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([fetchPendingProjects(), fetchPendingCompletions(), fetchAllProjects()])
    setIsLoading(false)
  }, [fetchPendingProjects, fetchPendingCompletions, fetchAllProjects])

  useEffect(() => {
    if (!loading && canReview) {
      loadData()
    }
  }, [loading, canReview, loadData])


  if (loading || isLoading) {
    return (
      <div className="page-shell py-8">
        <section className="surface-panel px-6 py-12 text-center">
          <p className="text-center">加载中...</p>
        </section>
      </div>
    )
  }

  if (!canReview) {
    return null
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="secondary" className="bg-green-100 text-green-800">已发布</Badge>
      case 'pending': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">待审核</Badge>
      case 'rejected': return <Badge variant="secondary" className="bg-red-100 text-red-800">已拒绝</Badge>
      case 'draft': return <Badge variant="secondary" className="bg-gray-100 text-gray-800">草稿</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="page-shell pt-6 pb-24 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader title="管理员控制台" fallbackHref="/profile" />
      </div>

      <section className="surface-panel overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
        <div className="mb-8">
          <p className="section-kicker">后台管理</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">管理员控制台</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">管理和审核平台内容</p>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="segmented-control h-auto flex-wrap justify-start rounded-[24px] bg-transparent p-1">
            <TabsTrigger value="pending" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">待审核项目 ({pendingProjects.length})</TabsTrigger>
            <TabsTrigger value="pending-completions" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">待审核作品 ({pendingCompletions.length})</TabsTrigger>
            <TabsTrigger value="reports" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">举报管理</TabsTrigger>
            <TabsTrigger value="projects" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">所有项目</TabsTrigger>
            {isAdmin && <TabsTrigger value="applications" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">审核员申请</TabsTrigger>}
            <TabsTrigger value="challenges" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">挑战赛</TabsTrigger>
            <TabsTrigger value="tags" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">标签管理</TabsTrigger>
            <TabsTrigger value="users" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">用户管理</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingProjects.length === 0 ? (
              <Card className="surface-subtle shadow-none">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">暂无待审核项目</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingProjects.map((project) => (
                  <ProjectReviewCard
                    key={project.id}
                    project={project}
                    onReview={loadData}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending-completions" className="space-y-4">
            {pendingCompletions.length === 0 ? (
              <Card className="surface-subtle shadow-none">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">暂无待审核作品</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingCompletions.map((completion) => (
                  <CompletionReviewCard
                    key={completion.id}
                    completion={completion}
                    onReview={loadData}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsList />
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <Card className="surface-subtle shadow-none">
              <CardHeader>
                <CardTitle>项目管理</CardTitle>
                <CardDescription>查看和编辑所有项目</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>标题</TableHead>
                      <TableHead>作者</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.title}</TableCell>
                        <TableCell>{project.profiles?.display_name || '未知用户'}</TableCell>
                        <TableCell>{project.category}</TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>{new Date(project.created_at).toLocaleDateString('zh-CN')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/project/${project.id}`} target="_blank">
                              <Button variant="ghost" size="icon" title="查看">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/admin/projects/${project.id}`}>
                              <Button variant="ghost" size="icon" title="编辑">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {allProjects.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          暂无项目
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="applications" className="space-y-4">
              <ModeratorApplicationsList />
            </TabsContent>
          )}

          <TabsContent value="challenges" className="space-y-4">
            <ChallengeManagement />
          </TabsContent>

          <TabsContent value="tags" className="space-y-4">
            <Card className="surface-subtle shadow-none">
              <CardHeader>
                <CardTitle>标签管理</CardTitle>
                <CardDescription>创建和管理项目标签</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">标签管理功能开发中...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card className="surface-subtle shadow-none">
              <CardHeader>
                <CardTitle>用户管理</CardTitle>
                <CardDescription>管理用户角色和权限</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">用户管理功能开发中...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}
