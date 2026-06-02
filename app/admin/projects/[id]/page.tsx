"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUpload } from '@/components/ui/image-upload'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { useToast } from '@/hooks/use-toast'
import { CATEGORIES } from '@/lib/config/categories'
import { CreateProjectSchema } from '@/lib/schemas'
import { getApiErrorMessage } from '@/lib/utils/http'
import { Slider } from '@/components/ui/slider'
import { Loader2, Trash2, Plus, Save, ArrowLeft, Star } from 'lucide-react'
import { logger } from '@/lib/logger'
import { inferProjectSteamWeights } from '@/lib/config/project-steam-weights'
import type { SteamWeights } from '@/lib/config/subcategory-steam-weights'

interface SubCategory {
    id: number
    name: string
    category?: string
}

interface ProjectFormData {
    title: string
    description: string
    category: string
    sub_category_id: number | null
    difficulty_stars: number
    image_url: string | null
    status: 'draft' | 'pending' | 'approved' | 'rejected'
    project_steps: {
        title: string
        description: string
        image_url: string | null
        sort_order: number
    }[]
    project_materials: {
        material: string
        sort_order: number
    }[]
    steam_weights: SteamWeights | null
    sub_category_name?: string
}

const INITIAL_DATA: ProjectFormData = {
    title: '',
    description: '',
    category: '',
    sub_category_id: null,
    difficulty_stars: 2,
    image_url: null,
    status: 'draft',
    project_steps: [],
    project_materials: [],
    steam_weights: null,
    sub_category_name: undefined,
}

export default function EditProjectPage() {
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string

    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<ProjectFormData>(INITIAL_DATA)
    const [dbSubCategories, setDbSubCategories] = useState<SubCategory[]>([])
    const [showSteamCorrection, setShowSteamCorrection] = useState(false)
    const [supabase] = useState(() => createClient())
    const suggestedSteamWeights = inferProjectSteamWeights({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        subCategory: formData.sub_category_name,
        steps: formData.project_steps,
    })

    const fetchData = useCallback(async () => {
        if (!id) return

        try {
            // 1. Fetch Sub-categories
            const { data: subCats, error: subCatsError } = await supabase
                .from('sub_categories')
                .select('*')

            if (subCatsError) throw subCatsError
            setDbSubCategories(subCats || [])

            // 2. Fetch Project
            const { data, error } = await supabase
                .from('projects')
                .select(`
          *,
          project_steps (
            title,
            description,
            image_url,
            sort_order
          ),
          project_materials (
            material,
            sort_order
          ),
          sub_categories (name)
        `)
                .eq('id', Number(id))
                .single()

            if (error) throw error

            if (data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const project = data as any; 
                const subCatName = project.sub_categories?.name || null
                setFormData({
                    title: project.title,
                    description: project.description || '',
                    category: project.category || '',
                    sub_category_id: project.sub_category_id || null, 
                    difficulty_stars: project.difficulty_stars,
                    status: project.status || 'draft',
                    image_url: project.image_url,
                    project_steps: (project.project_steps || [])
                        .sort((a: any, b: any) => a.sort_order - b.sort_order) // eslint-disable-line @typescript-eslint/no-explicit-any
                        .map((step: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                            title: step.title || '',
                            description: step.description || '',
                            image_url: step.image_url || null,
                            sort_order: step.sort_order || 0,
                        })),
                    project_materials: (project.project_materials || [])
                        .sort((a: any, b: any) => a.sort_order - b.sort_order) // eslint-disable-line @typescript-eslint/no-explicit-any
                        .map((material: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                            material: material.material || '',
                            sort_order: material.sort_order || 0,
                        })),
                    steam_weights: project.steam_weights || null,
                    sub_category_name: subCatName,
                })
                if (project.steam_weights) setShowSteamCorrection(true)
            }
        } catch (error) {
            logger.error('Error fetching data', { error })
            toast({
                title: '获取数据失败',
                description: '无法加载项目详情',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }, [id, supabase, toast])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleSave = async () => {
        if (!id) return

        // Validate Form Data with Zod
        const validationPayload = {
            ...formData,
            materials: formData.project_materials.map(m => m.material),
            steps: formData.project_steps,
        };

        const validationResult = CreateProjectSchema.safeParse(validationPayload);

        if (!validationResult.success) {
            logger.error("Validation failed", { error: validationResult.error });
            const errorMessages = validationResult.error.issues.map(e => e.message).join(', ');
            toast({
                title: "表单验证失败",
                description: errorMessages,
                variant: "destructive"
            });
            return;
        }

        setSaving(true)
        try {
            const response = await fetch(`/api/admin/projects/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    category: formData.category,
                    sub_category_id: formData.sub_category_id,
                    difficulty_stars: formData.difficulty_stars,
                    image_url: formData.image_url,
                    steam_weights: showSteamCorrection ? formData.steam_weights : null,
                    project_steps: formData.project_steps,
                    project_materials: formData.project_materials,
                }),
            })

            if (!response.ok) {
                throw new Error(await getApiErrorMessage(response, '更新项目时发生错误'))
            }

            toast({
                title: '保存成功',
                description: '项目已更新',
            })

        } catch (error) {
            logger.error('Error saving project', { error })
            toast({
                title: '保存失败',
                description: (error as Error).message || '更新项目时发生错误',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    const addStep = () => {
        setFormData(prev => ({
            ...prev,
            project_steps: [
                ...prev.project_steps,
                { title: '', description: '', image_url: null, sort_order: prev.project_steps.length + 1 }
            ]
        }))
    }

    const removeStep = (index: number) => {
        setFormData(prev => ({
            ...prev,
            project_steps: prev.project_steps.filter((_, i) => i !== index)
        }))
    }

    const updateStep = (index: number, field: string, value: string | null) => {
        setFormData(prev => {
            const newSteps = [...prev.project_steps]
            newSteps[index] = { ...newSteps[index], [field]: value }
            return { ...prev, project_steps: newSteps }
        })
    }

    const addMaterial = () => {
        setFormData(prev => ({
            ...prev,
            project_materials: [
                ...prev.project_materials,
                { material: '', sort_order: prev.project_materials.length + 1 }
            ]
        }))
    }

    const removeMaterial = (index: number) => {
        setFormData(prev => ({
            ...prev,
            project_materials: prev.project_materials.filter((_, i) => i !== index)
        }))
    }

    const updateMaterial = (index: number, value: string) => {
        setFormData(prev => {
            const newMaterials = [...prev.project_materials]
            newMaterials[index] = { ...newMaterials[index], material: value }
            return { ...prev, project_materials: newMaterials }
        })
    }

    if (loading) {
        return (
            <div className="page-shell py-8">
                <section className="surface-panel flex min-h-[280px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </section>
            </div>
        )
    }

    // Filter sub-categories based on main category
    // NOTE: This assumes sub_categories table has a way to map to "Scientific", "Tech", etc.
    // If the table layout is (id, name, category_id), and we act as if we don't know the category mapping,
    // we might need to know the category IDs.
    // However, given the previous code used strings, maybe the sub_categories table HAS a 'category' string column?
    // Let's filter by checking if the sub_category item has a 'category' property that matches.
    // Or if we can't link them, show all (fallback).
    // Better: Filter if the item has `category` field matching formData.category.
    const filteredSubCategories = dbSubCategories.filter(sc =>
        // If sub_category has a 'category' field (string)
        (sc.category === formData.category) ||
        // Or if it seems to rely on ID but we don't have that map, we might just show all.
        // But let's try to match by string first. 
        (!sc.category) // If no category field, maybe just show? (Unlikely)
    )

    // Fallback: If no match found (maybe sub_categories doesn't have category string), show all or try to guess?
    // Ideally we would inspect the schema, but we can't.
    // Let's assume the table has `category` column as string based on `Tag` interface in database.ts having `category?: string`.

    return (
        <div className="page-shell pt-6 pb-24 md:py-8">
            <div className="md:hidden">
                <MobilePageHeader title="编辑项目" fallbackHref="/admin" />
            </div>

            <section className="surface-panel overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" className="hidden rounded-md md:inline-flex" aria-label="返回" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" aria-hidden />
                        </Button>
                        <div>
                            <p className="section-kicker">后台管理</p>
                            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">编辑项目</h1>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">
                                调整项目基础信息、步骤、材料和 STEAM 权重，不在这里直接处理审核状态流转。
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="rounded-full md:hidden" onClick={() => router.back()}>
                            返回
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="rounded-full">
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    保存中
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    保存更改
                                </>
                            )}
                        </Button>
                    </div>
                </div>

            <div className="grid gap-6">
                {/* 基本信息 */}
                <Card className="surface-subtle shadow-none">
                    <CardHeader>
                        <CardTitle>基本信息</CardTitle>
                        <CardDescription>维护项目标题、分类、难度、状态说明与封面图片。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>项目标题</Label>
                            <Input
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="输入项目标题"
                                className="rounded-md"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>项目简介</Label>
                            <Textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="简要描述项目内容..."
                                rows={3}
                                className="rounded-md"
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>主分类</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={val => setFormData({ ...formData, category: val, sub_category_id: null, sub_category_name: undefined })}
                                >
                                    <SelectTrigger className="h-11 rounded-md">
                                        <SelectValue placeholder="选择分类" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label>子分类</Label>
                                <Select
                                    value={formData.sub_category_id ? String(formData.sub_category_id) : ""}
                                    onValueChange={val => {
                                        const nextSubCategoryId = Number(val)
                                        const nextSubCategory = filteredSubCategories.find((item) => item.id === nextSubCategoryId)
                                        setFormData({
                                            ...formData,
                                            sub_category_id: nextSubCategoryId,
                                            sub_category_name: nextSubCategory?.name,
                                        })
                                    }}
                                    disabled={!filteredSubCategories.length}
                                >
                                    <SelectTrigger className="h-11 rounded-md">
                                        <SelectValue placeholder="选择子分类" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredSubCategories.map(sub => (
                                            <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>难度等级 (1-5星)</Label>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, difficulty_stars: star })}
                                            className="focus:outline-none transition-transform hover:scale-110"
                                        >
                                            <Star
                                                className={`h-6 w-6 ${star <= formData.difficulty_stars
                                                    ? "fill-yellow-400 text-yellow-400"
                                                    : "text-gray-300"
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                    <span className="ml-2 text-sm text-muted-foreground">
                                        {formData.difficulty_stars} 星
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>状态</Label>
                            <div className="rounded-md border border-border/70 bg-background/80 px-4 py-3 text-sm">
                                当前状态：{formData.status}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                审核状态请在审核列表中处理，避免绕过批准/拒绝流程的副作用。
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>封面图片</Label>
                            <ImageUpload
                                value={formData.image_url}
                                onChange={url => setFormData({ ...formData, image_url: url })}
                                pathPrefix="project-covers"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* STEAM 权重校正 */}
                <Card className="surface-subtle shadow-none">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>STEAM 权重</CardTitle>
                            <Button
                                size="sm"
                                variant={showSteamCorrection ? "default" : "outline"}
                                className="rounded-full"
                                onClick={() => {
                                    if (!showSteamCorrection) {
                                        setFormData(prev => ({ ...prev, steam_weights: { ...suggestedSteamWeights } }))
                                    } else {
                                        setFormData(prev => ({ ...prev, steam_weights: null }))
                                    }
                                    setShowSteamCorrection(!showSteamCorrection)
                                }}
                            >
                                {showSteamCorrection ? '取消校正' : '校正权重'}
                            </Button>
                        </div>
                        <CardDescription>
                            {showSteamCorrection
                                ? '调整各维度权重后保存。未手动校正时会采用系统按项目内容生成的建议权重。'
                                : `当前将使用系统建议权重：${formData.sub_category_name || formData.category || '其他'}`
                            }
                        </CardDescription>
                    </CardHeader>
                    {!showSteamCorrection && (
                        <CardContent>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                {Object.entries(suggestedSteamWeights).map(([dim, val]) => (
                                    <span key={dim} className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                                        {dim}: {val}
                                    </span>
                                ))}
                            </div>
                        </CardContent>
                    )}
                    {showSteamCorrection && formData.steam_weights && (
                        <CardContent className="space-y-3">
                            {(['S', 'T', 'E', 'A', 'M'] as const).map(dim => {
                                const labels: Record<string, string> = { S: '科学', T: '技术', E: '工程', A: '艺术', M: '数学' }
                                return (
                                    <div key={dim} className="flex items-center gap-3">
                                        <span className="w-16 text-sm">{labels[dim]} ({dim})</span>
                                        <Slider
                                            min={0} max={50} step={5}
                                            value={[formData.steam_weights![dim]]}
                                            onValueChange={([v]) => setFormData(prev => ({
                                                ...prev,
                                                steam_weights: { ...prev.steam_weights!, [dim]: v }
                                            }))}
                                            className="flex-1"
                                        />
                                        <span className="w-8 text-sm text-right">{formData.steam_weights![dim]}</span>
                                    </div>
                                )
                            })}
                        </CardContent>
                    )}
                </Card>

                {/* 步骤 */}
                <Card className="surface-subtle shadow-none">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>制作步骤</CardTitle>
                            <Button size="sm" variant="outline" className="rounded-full" onClick={addStep}>
                                <Plus className="mr-2 h-4 w-4" /> 添加步骤
                            </Button>
                        </div>
                        <CardDescription>按顺序添加项目制作步骤</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {formData.project_steps.map((step, index) => (
                            <div key={index} className="relative rounded-[var(--radius-lg)] border border-border/70 bg-background/80 p-4">
                                <div className="absolute right-4 top-4">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="rounded-full text-destructive hover:text-destructive/90"
                                        aria-label={`删除步骤 ${index + 1}`}
                                        onClick={() => removeStep(index)}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden />
                                    </Button>
                                </div>

                                <h4 className="mb-4 font-medium">步骤 {index + 1}</h4>

                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label>步骤标题</Label>
                                        <Input
                                            value={step.title}
                                            onChange={e => updateStep(index, 'title', e.target.value)}
                                            placeholder="例如：准备材料"
                                            className="rounded-md"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>详细说明</Label>
                                        <Textarea
                                            value={step.description}
                                            onChange={e => updateStep(index, 'description', e.target.value)}
                                            placeholder="详细描述该步骤的操作方法..."
                                            className="rounded-md"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>步骤图片 (可选)</Label>
                                        <ImageUpload
                                            value={step.image_url}
                                            onChange={url => updateStep(index, 'image_url', url)}
                                            pathPrefix={`project-steps/${params.id}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {formData.project_steps.length === 0 && (
                            <p className="py-8 text-center text-muted-foreground">暂无步骤，请点击右上角添加</p>
                        )}
                    </CardContent>
                </Card>

                {/* 材料清单 */}
                <Card className="surface-subtle shadow-none">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>材料清单</CardTitle>
                            <Button size="sm" variant="outline" className="rounded-full" onClick={addMaterial}>
                                <Plus className="mr-2 h-4 w-4" /> 添加材料
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {formData.project_materials.map((mat, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={mat.material}
                                        onChange={e => updateMaterial(index, e.target.value)}
                                        placeholder={`材料 ${index + 1}`}
                                        className="rounded-md"
                                    />
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="shrink-0 rounded-full text-destructive"
                                        aria-label={`删除材料 ${index + 1}`}
                                        onClick={() => removeMaterial(index)}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden />
                                    </Button>
                                </div>
                            ))}
                            {formData.project_materials.length === 0 && (
                                <p className="py-8 text-center text-muted-foreground">暂无材料</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            </section>
        </div>
    )
}
