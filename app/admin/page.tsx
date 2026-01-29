"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth-context'
import { createClient } from '@/lib/supabase/client'
import { ProjectReviewCard } from '@/components/admin/project-review-card'
import { ModeratorApplicationsList } from '@/components/admin/moderator-applications-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Eye } from 'lucide-react'

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

export default function AdminPage() {
  const router = useRouter()
  const { canReview, loading } = useAuth()
  const [pendingProjects, setPendingProjects] = useState<Project[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

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
      setPendingProjects(data as Project[])
    }
    // setIsLoading(false)
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
      setAllProjects(data as any[]) // Type casting as simplified Project
    }
  }, [supabase])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([fetchPendingProjects(), fetchAllProjects()])
    setIsLoading(false)
  }, [fetchPendingProjects, fetchAllProjects])

  useEffect(() => {
    if (!loading && !canReview) {
      router.push('/')
      return
    }

    if (!loading && canReview) {
      loadData()
    }
  }, [loading, canReview, router, loadData])


  if (loading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center">加载中...</p>
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">管理员控制台</h1>
        <p className="text-muted-foreground">管理和审核平台内容</p>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">待审核项目 ({pendingProjects.length})</TabsTrigger>
          <TabsTrigger value="projects">所有项目</TabsTrigger>
          <TabsTrigger value="applications">审核员申请</TabsTrigger>
          <TabsTrigger value="tags">标签管理</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingProjects.length === 0 ? (
            <Card>
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

        <TabsContent value="projects" className="space-y-4">
          <Card>
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
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无项目
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <ModeratorApplicationsList />
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <Card>
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
          <Card>
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
    </div>
  )
}
