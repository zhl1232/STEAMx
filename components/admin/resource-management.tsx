"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/utils/http'
import { Plus, Trash2, ArrowUpRight, Eye, EyeOff } from 'lucide-react'
import {
  LEARNING_RESOURCE_CATEGORIES,
  LEARNING_RESOURCE_CATEGORY_LABELS,
  learningResourcePath,
  type LearningResourceCategory,
  type LearningResourceStatus,
} from '@/lib/learning-resources'

interface AdminLearningResource {
  id: number
  title: string
  summary: string | null
  content_md: string
  category: LearningResourceCategory
  cover_image_url: string | null
  status: LearningResourceStatus
  created_at: string
  updated_at: string
}

const EMPTY_FORM = {
  title: '',
  summary: '',
  content_md: '',
  category: 'principle' as LearningResourceCategory,
  cover_image_url: '',
}

const STATUS_LABELS: Record<LearningResourceStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
  published: { label: '已发布', color: 'status-success-surface border text-[hsl(var(--status-success))]' },
}

const FIELD_CLASS = 'rounded-md border-border/70 bg-background/95 shadow-none'
const SECTION_CLASS = 'admin-section'

export function ResourceManagement() {
  const [resources, setResources] = useState<AdminLearningResource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const { toast } = useToast()

  const fetchResources = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/resources')

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '加载资料卡失败'))
      }

      const data = await res.json()
      setResources(data.resources || [])
    } catch (error) {
      setResources([])
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '加载资料卡失败',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchResources() }, [fetchResources])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const openEdit = (resource: AdminLearningResource) => {
    setEditingId(resource.id)
    setForm({
      title: resource.title,
      summary: resource.summary || '',
      content_md: resource.content_md,
      category: resource.category,
      cover_image_url: resource.cover_image_url || '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    const payload = {
      title: form.title,
      summary: form.summary || null,
      content_md: form.content_md,
      category: form.category,
      cover_image_url: form.cover_image_url || null,
    }

    const url = editingId ? `/api/admin/resources/${editingId}` : '/api/admin/resources'
    const method = editingId ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '操作失败'))
      }

      toast({ title: editingId ? '资料卡已更新' : '资料卡已创建' })
      setDialogOpen(false)
      resetForm()
      fetchResources()
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      })
    }
  }

  const handleStatusChange = async (id: number, status: LearningResourceStatus) => {
    try {
      const res = await fetch(`/api/admin/resources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '操作失败'))
      }

      toast({ title: status === 'published' ? '资料卡已发布' : '资料卡已下架为草稿' })
      fetchResources()
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该资料卡？')) return
    try {
      const res = await fetch(`/api/admin/resources/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '删除失败'))
      }

      toast({ title: '资料卡已删除' })
      fetchResources()
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除失败',
        variant: 'destructive',
      })
    }
  }

  return (
    <section className="surface-subtle space-y-6 rounded-xl border border-border/70 p-5 shadow-none sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="section-kicker">PBL 脚手架</p>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">资料卡管理</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              可跨挑战复用的学习资料（原理 / 材料 / 方法 / 技能 / 案例），发布后可在挑战「相关资料」中引用
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button className="px-5"><Plus className="mr-1 h-4 w-4" />创建资料卡</Button>
          </DialogTrigger>
          <DialogContent size="lg" chrome="review" className="p-0">
            <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6 sm:px-7">
              <DialogTitle>{editingId ? '编辑资料卡' : '创建资料卡'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-6 pb-6 pt-5 sm:px-7">
              <div className={SECTION_CLASS}>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">基础信息</h3>
                  <p className="text-xs text-muted-foreground">标题和摘要会显示在资料卡页头与挑战资料区。</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="col-span-2">
                    <Label>标题</Label>
                    <Input className={FIELD_CLASS} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="如：冲击力与缓冲原理" />
                  </div>
                  <div className="col-span-2">
                    <Label>摘要（一句话说明什么时候来查这张卡）</Label>
                    <Input className={FIELD_CLASS} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="如：搞不懂为什么鸡蛋会摔碎时，先读这篇" />
                  </div>
                  <div>
                    <Label>分类</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as LearningResourceCategory }))}>
                      <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LEARNING_RESOURCE_CATEGORIES.map(category => (
                          <SelectItem key={category} value={category}>
                            {LEARNING_RESOURCE_CATEGORY_LABELS[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>封面图 URL（可选）</Label>
                    <Input className={FIELD_CLASS} value={form.cover_image_url} onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className={SECTION_CLASS}>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">正文（Markdown）</h3>
                  <p className="text-xs text-muted-foreground">支持标题（##）、列表、加粗、引用等 Markdown 语法。</p>
                </div>
                <Textarea
                  className={`${FIELD_CLASS} font-mono text-[13px]`}
                  value={form.content_md}
                  onChange={e => setForm(f => ({ ...f, content_md: e.target.value }))}
                  rows={14}
                  placeholder={'## 为什么会摔碎\n\n物体落地时…\n\n- 要点一\n- 要点二'}
                />
              </div>

              <Button onClick={handleSubmit} className="w-full py-6 text-base">{editingId ? '保存修改' : '创建资料卡'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        {isLoading ? (
          <div className="admin-panel-card py-10 text-center shadow-none">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : resources.length === 0 ? (
          <div className="admin-panel-card py-10 text-center shadow-none">
            <p className="text-muted-foreground">暂无资料卡</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-(--radius-lg) border border-border/70 bg-background/95">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>标题</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map(resource => (
                    <TableRow key={resource.id}>
                      <TableCell className="max-w-[280px] font-medium">
                        <div className="space-y-1">
                          <p className="truncate">{resource.title}</p>
                          {resource.summary && <p className="line-clamp-1 text-xs text-muted-foreground">{resource.summary}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full border-border/70 bg-background/80">
                          {LEARNING_RESOURCE_CATEGORY_LABELS[resource.category] || resource.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${STATUS_LABELS[resource.status].color} rounded-full`}>
                          {STATUS_LABELS[resource.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(resource.updated_at).toLocaleDateString('zh-CN')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {resource.status === 'draft' ? (
                            <Button size="sm" variant="outline" onClick={() => handleStatusChange(resource.id, 'published')}>
                              <Eye className="mr-1 h-3 w-3" />发布
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" asChild>
                                <Link href={learningResourcePath(resource.id)} target="_blank">
                                  <ArrowUpRight className="mr-1 h-3 w-3" />查看
                                </Link>
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleStatusChange(resource.id, 'draft')}>
                                <EyeOff className="mr-1 h-3 w-3" />下架
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openEdit(resource)}>编辑</Button>
                          {resource.status === 'draft' && (
                            <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(resource.id)} aria-label={`删除资料卡 ${resource.title}`}>
                              <Trash2 className="h-3 w-3" aria-hidden />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
