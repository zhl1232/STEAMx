"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUpload } from '@/components/ui/image-upload'
import { useToast } from '@/hooks/use-toast'
import { CATEGORIES } from '@/lib/config/categories'
import { CreateProjectSchema } from '@/lib/schemas'
import { Loader2, Trash2, Plus, Save, ArrowLeft, Star } from 'lucide-react'

type ProjectUpdate = Database['public']['Tables']['projects']['Update']
type StepInsert = Database['public']['Tables']['project_steps']['Insert']
type MaterialInsert = Database['public']['Tables']['project_materials']['Insert']

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
    duration: number
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
}

const INITIAL_DATA: ProjectFormData = {
    title: '',
    description: '',
    category: '',
    sub_category_id: null,
    difficulty_stars: 2,
    image_url: null,
    duration: 60,
    status: 'draft',
    project_steps: [],
    project_materials: []
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
    const supabase = createClient()

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
          )
        `)
                .eq('id', id)
                .single()

            if (error) throw error

            if (data) {
                // Cast data to allow access to joined arrays which might not be in the inferred type
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const project = data as any; 
                setFormData({
                    title: project.title,
                    description: project.description || '',
                    category: project.category || '',
                    sub_category_id: project.sub_category_id || null, 
                    difficulty_stars: project.difficulty_stars,
                    duration: project.duration || 60,
                    status: project.status || 'draft',
                    image_url: project.image_url,
                    project_steps: (project.project_steps || []).sort((a: any, b: any) => a.sort_order - b.sort_order), // eslint-disable-line @typescript-eslint/no-explicit-any
                    project_materials: (project.project_materials || []).sort((a: any, b: any) => a.sort_order - b.sort_order), // eslint-disable-line @typescript-eslint/no-explicit-any
                })
            }
        } catch (error) {
            console.error('Error fetching data:', error)
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
            console.error("Validation failed:", validationResult.error);
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
            // 1. Update Project Basic Info
            const updatePayload: ProjectUpdate = {
                title: formData.title,
                description: formData.description,
                category: formData.category,
                sub_category_id: formData.sub_category_id,
                difficulty_stars: formData.difficulty_stars,
                image_url: formData.image_url,
                duration: formData.duration,
                status: formData.status,
                updated_at: new Date().toISOString()
            };

            // 1. Update Project Basic Info
            const { error: projectError } = await (supabase
                .from('projects') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .update(updatePayload) 
                .eq('id', id)

            if (projectError) throw projectError

            // 2. Refresh Steps
            await supabase.from('project_steps').delete().eq('project_id', id)
            if (formData.project_steps.length > 0) {
                const stepsToInsert: StepInsert[] = formData.project_steps.map((step, index) => ({
                    project_id: Number(id), // project_id is number in schema
                    title: step.title,
                    description: step.description,
                    image_url: step.image_url,
                    sort_order: index + 1
                }))
                const { error: stepsError } = await ((supabase.from('project_steps') as any).insert(stepsToInsert)) // eslint-disable-line @typescript-eslint/no-explicit-any
                if (stepsError) throw stepsError
            }

            // 3. Refresh Materials
            await supabase.from('project_materials').delete().eq('project_id', id)
            if (formData.project_materials.length > 0) {
                const materialsToInsert: MaterialInsert[] = formData.project_materials.map((mat, index) => ({
                    project_id: Number(id),
                    material: mat.material,
                    sort_order: index + 1
                }))
                const { error: materialsError } = await ((supabase.from('project_materials') as any).insert(materialsToInsert)) // eslint-disable-line @typescript-eslint/no-explicit-any
                if (materialsError) throw materialsError
            }

            toast({
                title: '保存成功',
                description: '项目已更新',
            })

        } catch (error) {
            console.error('Error saving project:', error)
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
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
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
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-2xl font-bold">编辑项目</h1>
                </div>
                <Button onClick={handleSave} disabled={saving}>
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

            <div className="grid gap-6">
                {/* 基本信息 */}
                <Card>
                    <CardHeader>
                        <CardTitle>基本信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>项目标题</Label>
                            <Input
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="输入项目标题"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>项目简介</Label>
                            <Textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="简要描述项目内容..."
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>主分类</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={val => setFormData({ ...formData, category: val, sub_category_id: null })}
                                >
                                    <SelectTrigger>
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
                                    onValueChange={val => setFormData({ ...formData, sub_category_id: Number(val) })}
                                    disabled={!filteredSubCategories.length}
                                >
                                    <SelectTrigger>
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

                        <div className="grid grid-cols-2 gap-4">
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
                            <Select
                                value={formData.status}
                                onValueChange={(val) => setFormData({ ...formData, status: val as ProjectFormData['status'] })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择状态" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">草稿</SelectItem>
                                    <SelectItem value="pending">待审核</SelectItem>
                                    <SelectItem value="approved">已发布</SelectItem>
                                    <SelectItem value="rejected">已拒绝</SelectItem>
                                </SelectContent>
                            </Select>
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

                {/* 步骤 */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>制作步骤</CardTitle>
                            <Button size="sm" variant="outline" onClick={addStep}>
                                <Plus className="mr-2 h-4 w-4" /> 添加步骤
                            </Button>
                        </div>
                        <CardDescription>按顺序添加项目制作步骤</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {formData.project_steps.map((step, index) => (
                            <div key={index} className="relative rounded-lg border p-4">
                                <div className="absolute right-4 top-4">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive/90"
                                        onClick={() => removeStep(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
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
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>详细说明</Label>
                                        <Textarea
                                            value={step.description}
                                            onChange={e => updateStep(index, 'description', e.target.value)}
                                            placeholder="详细描述该步骤的操作方法..."
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
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>材料清单</CardTitle>
                            <Button size="sm" variant="outline" onClick={addMaterial}>
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
                                    />
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="shrink-0 text-destructive"
                                        onClick={() => removeMaterial(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
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
        </div>
    )
}
