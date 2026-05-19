"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { Upload, Save, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Project } from "@/lib/mappers/types";
import { useProjects } from '@/lib/context/project-context';
import { useAuth } from '@/lib/context/auth-context';
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectCoverImage } from "@/lib/config/category-images";

import { CATEGORY_CONFIG } from "@/lib/config/categories";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mapDbProject } from "@/lib/mappers/types";
import { Suspense } from "react";
import { getDisplayName } from "@/lib/utils/user";
import { logger } from "@/lib/logger";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";

const CATEGORIES = Object.keys(CATEGORY_CONFIG);

interface StepFormData {
    title: string;
    description: string;
    image_url: string | null;
}

interface IterationFormData {
    description: string;
    result: string;
}

interface ChallengeInfo {
    id: number;
    title: string;
    drivingQuestion?: string;
    challengeType: 'timed' | 'evergreen';
}

interface FormData {
    title: string;
    category: string;
    subCategory: string;
    difficulty: string;
    materials: string;
    coverImage: string | null;
    steps: StepFormData[];
    tags: string[];
    problemStatement: string;
    reflection: string;
    iterations: IterationFormData[];
}

const DRAFT_KEY = "project_draft";
const SECTION_CARD_CLASS =
    "surface-subtle overflow-hidden rounded-[22px] border-border/60 shadow-none";
const SECTION_HEADER_CLASS = "px-3.5 pb-3 pt-4 sm:px-6 sm:pb-3 sm:pt-6";
const SECTION_CONTENT_CLASS = "space-y-4 px-3.5 pb-4 sm:px-6 sm:pb-6";
const SUBSECTION_CARD_CLASS =
    "rounded-[18px] bg-background/72 shadow-none ring-1 ring-inset ring-border/40 sm:rounded-[20px]";
const FIELD_CLASS = "rounded-xl border-border/60 bg-background/95 shadow-none";
const CHIP_CLASS =
    "min-h-10 rounded-full border px-3.5 py-2 text-[13px] font-medium leading-none transition-all sm:px-4 sm:text-sm";

function ShareForm() {
    const { addProject, updateProject } = useProjects();
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit');
    const challengeParam = searchParams.get('challenge');
    const supabase = createClient();
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const originalRef = useRef<{
        title: string;
        image: string | null;
        category: string;
        steps: string;
        materials: string;
        reflection: string;
    } | null>(null);
    const [challengeInfo, setChallengeInfo] = useState<ChallengeInfo | null>(null);
    const [formData, setFormData] = useState<FormData>({
        title: "",
        category: "科学",
        subCategory: "",
        difficulty: "easy",
        materials: "",
        coverImage: null,
        steps: [{ title: "步骤 1", description: "", image_url: null }],
        tags: [],
        problemStatement: "",
        reflection: "",
        iterations: [],
    });

    // Load challenge info when challenge param is present
    useEffect(() => {
        if (!challengeParam || !user) return;
        const loadChallenge = async () => {
            const res = await fetch(`/api/challenges/${challengeParam}`);
            if (!res.ok) return;
            const data = await res.json();
            const ch = data.challenge;
            if (ch) {
                setChallengeInfo({
                    id: Number(ch.id),
                    title: ch.title,
                    drivingQuestion: ch.drivingQuestion,
                    challengeType: ch.challengeType,
                });

                // For evergreen challenges, check if user already has a submission
                if (ch.challengeType === 'evergreen') {
                    const { data: existing } = await supabase
                        .from('projects')
                        .select(`*, project_materials (*), project_steps (*), sub_categories (name)`)
                        .eq('challenge_id', Number(ch.id))
                        .eq('author_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (existing) {
                        type ProjectRow = Parameters<typeof mapDbProject>[0];
                        const project = mapDbProject(existing as unknown as ProjectRow);
                        const proj = existing as Record<string, unknown>;
                        originalRef.current = {
                            title: project.title,
                            image: project.image,
                            category: project.category,
                            steps: JSON.stringify(project.steps),
                            materials: project.materials?.join('\n') || "",
                            reflection: (proj.reflection as string) || "",
                        };
                        setFormData(prev => ({
                            ...prev,
                            title: project.title,
                            category: project.category,
                            subCategory: project.sub_category || "",
                            difficulty: project.difficulty || "easy",
                            materials: project.materials?.join('\n') || "",
                            coverImage: project.image,
                            steps: project.steps?.map(s => ({ title: s.title, description: s.description, image_url: s.image_url || null })) || prev.steps,
                            tags: project.tags || [],
                            problemStatement: (proj.problem_statement as string) || "",
                            reflection: (proj.reflection as string) || "",
                            iterations: (proj.iterations as IterationFormData[]) || [],
                        }));
                        // Use editId-like behavior for existing submission
                        router.replace(`/project?edit=${existing.id}&challenge=${challengeParam}`);
                        toast({ title: "已加载你之前的作品", description: "你可以继续改进" });
                    }
                }
            }
        };
        loadChallenge();
    }, [challengeParam, user, supabase, toast, router]);

    // 加载编辑数据
    useEffect(() => {
        const loadProjectToEdit = async () => {
            if (!editId || !user) return;

            // setIsLoading(true); // Don't block whole UI, just maybe show loading state
            const { data, error: _error } = await supabase
                .from('projects')
                .select(`
                    *,
                    project_materials (*),
                    project_steps (*),
                    sub_categories (name)
                `)
                .eq('id', Number(editId))
                .maybeSingle();

            if (!data) {
                toast({ title: "项目不存在或已不可编辑", variant: "destructive" });
                router.replace('/profile');
                return;
            }

            type ProjectRow = Parameters<typeof mapDbProject>[0];
            const projectData = data as unknown as ProjectRow;
            // Check if user is author
            if (projectData.author_id && projectData.author_id !== user.id) {
                toast({ title: "无权编辑", variant: "destructive" });
                router.replace('/share');
                return;
            }

            const project = mapDbProject(projectData);
            originalRef.current = {
                title: project.title,
                image: project.image,
                category: project.category,
                steps: JSON.stringify(project.steps),
                materials: project.materials?.join('\n') || "",
                reflection: project.reflection || "",
            };
            setFormData({
                title: project.title,
                category: project.category,
                subCategory: project.sub_category || "",
                difficulty: project.difficulty || "easy",
                materials: project.materials?.join('\n') || "",
                coverImage: project.image,
                steps: project.steps?.map(s => ({
                    title: s.title,
                    description: s.description,
                    image_url: s.image_url || null
                })) || [{ title: "步骤 1", description: "", image_url: null }],
                tags: project.tags || [],
                problemStatement: project.problem_statement || "",
                reflection: project.reflection || "",
                iterations: (project.iterations || []).map(it => ({ description: it.description, result: it.result })),
            });

            toast({ title: "已加载项目数据", description: "您可以修改并重新提交审核" });
        };

        if (editId) {
            loadProjectToEdit();
        }
    }, [editId, user, supabase, toast, router]);

    // 加载草稿 (仅在不是编辑模式时)
    useEffect(() => {
        if (user && !editId) {
            const savedDraft = localStorage.getItem(`${DRAFT_KEY}_${user.id}`);
            if (savedDraft) {
                try {
                    const draft = JSON.parse(savedDraft);
                    // 兼容旧格式的草稿，确保必需字段存在
                    // 兼容旧格式的草稿
                    const difficultyMap: Record<string, string> = {
                        "beginner": "easy",
                        "intermediate": "medium",
                        "advanced": "hard"
                    };

                    setFormData({
                        ...draft,
                        difficulty: difficultyMap[draft.difficulty] || draft.difficulty || "easy",
                        subCategory: draft.subCategory || "",
                        tags: draft.tags || [],
                        coverImage: draft.coverImage || null,
                        steps: draft.steps || [{ title: "步骤 1", description: "", image_url: null }],
                        problemStatement: draft.problemStatement || "",
                        reflection: draft.reflection || "",
                        iterations: draft.iterations || [],
                    });
                    toast({
                        title: "已恢复草稿",
                        description: "自动恢复了您上次保存的内容",
                    });
                } catch (e) {
                    logger.error("Failed to load draft", { error: e });
                }
            }
        }
    }, [user, toast, editId]);

    // 自动保存草稿（防抖）
    useEffect(() => {
        if (!user) return;

        const timer = setTimeout(() => {
            localStorage.setItem(`${DRAFT_KEY}_${user.id}`, JSON.stringify(formData));
        }, 2000); // 2秒防抖

        return () => clearTimeout(timer);
    }, [formData, user]);

    const handleInputChange = (field: keyof Omit<FormData, 'steps' | 'coverImage' | 'tags'>, value: string) => {
        if (field === 'category') {
            setFormData(prev => ({ ...prev, category: value, subCategory: "" }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };



    const handleCoverImageChange = (url: string | null) => {
        setFormData(prev => ({ ...prev, coverImage: url }));
    };

    const handleStepChange = (index: number, field: keyof StepFormData, value: string | null) => {
        setFormData(prev => {
            const newSteps = [...prev.steps];
            newSteps[index] = { ...newSteps[index], [field]: value };
            return { ...prev, steps: newSteps };
        });
    };

    const addStep = () => {
        setFormData(prev => ({
            ...prev,
            steps: [...prev.steps, { title: `步骤 ${prev.steps.length + 1}`, description: "", image_url: null }]
        }));
    };

    const removeStep = (index: number) => {
        if (formData.steps.length <= 1) {
            toast({
                title: "至少需要一个步骤",
                variant: "destructive"
            });
            return;
        }
        setFormData(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== index)
        }));
    };

    const handleSaveDraft = () => {
        if (!user) return;
        setIsSavingDraft(true);
        localStorage.setItem(`${DRAFT_KEY}_${user.id}`, JSON.stringify(formData));

        toast({
            title: "草稿已保存",
            description: "您可以稍后继续编辑",
        });

        setTimeout(() => setIsSavingDraft(false), 800);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // 表单验证
        if (!formData.title.trim()) {
            toast({
                title: "请填写项目标题",
                variant: "destructive",
            });
            return;
        }

        if (formData.steps.length === 0 || !formData.steps.some(step => step.description.trim())) {
            toast({
                title: "请至少添加一个步骤说明",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 获取封面图片（用户上传的或类别主题图）
            const coverImage = getProjectCoverImage(formData.category, formData.coverImage);

            // 默认值 - 改由管理员设置
            const defaultDifficulty = 'easy';
            const defaultStars = 3;
            const firstStepDescription = formData.steps.find(step => step.description.trim())?.description.trim() || "";

            const newProject: Project = {
                id: Date.now(),
                title: formData.title,
                author: getDisplayName({
                    profileName: null,
                    metadataFullName: user?.user_metadata?.display_name,
                    metadataName: user?.user_metadata?.username,
                    phone: user?.phone ?? null,
                    email: user?.email,
                    fallback: "匿名用户",
                }),
                author_id: user!.id,
                image: coverImage,
                category: formData.category,
                sub_category: formData.subCategory,
                difficulty: defaultDifficulty,
                difficulty_stars: defaultStars,
                likes: 0,
                description: firstStepDescription.length > 100
                    ? `${firstStepDescription.slice(0, 100)}...`
                    : firstStepDescription,
                materials: formData.materials.split("\n").filter(item => item.trim() !== ""),
                steps: formData.steps.map((step, index) => ({
                    title: step.title || `步骤 ${index + 1}`,
                    description: step.description,
                    image_url: step.image_url || undefined
                })),
                tags: [],
                status: 'pending',
                challenge_id: challengeInfo?.id || null,
                problem_statement: formData.problemStatement || undefined,
                reflection: formData.reflection || undefined,
                iterations: formData.iterations.filter(it => it.description.trim()).map(it => ({
                    ...it,
                    created_at: new Date().toISOString(),
                })),
            };



            if (editId) {
                const orig = originalRef.current;
                const currentSteps = JSON.stringify(formData.steps.map((s, i) => ({
                    title: s.title || `步骤 ${i + 1}`,
                    description: s.description,
                    image_url: s.image_url || undefined,
                })));
                const isMajorEdit = !orig
                    || formData.title !== orig.title
                    || coverImage !== orig.image
                    || formData.category !== orig.category
                    || currentSteps !== orig.steps
                    || formData.materials !== orig.materials
                    || formData.reflection !== orig.reflection;
                await updateProject(editId, newProject, isMajorEdit);
            } else {
                await addProject(newProject);
                // 清除草稿
                if (user) {
                    localStorage.removeItem(`${DRAFT_KEY}_${user.id}`);
                }

                toast({
                    title: "项目已提交审核！",
                    description: "您的项目将在审核通过后公开展示，请在个人中心查看审核状态",
                    duration: 5000,
                });
            }

            setTimeout(() => {
                router.push("/profile");  // 跳转到个人中心页面
            }, 1500);
        } catch (error) {
            logger.error('Project submission error', { error });
            toast({
                title: "提交失败",
                description: "请稍后再试",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const completedSteps = formData.steps.filter((step) => step.description.trim()).length;
    const completionChecks = [
        { label: "项目标题", done: Boolean(formData.title.trim()) },
        { label: "项目分类", done: Boolean(formData.category) },
        { label: "制作步骤", done: completedSteps > 0 },
        { label: "材料清单", done: Boolean(formData.materials.trim()) },
        { label: "封面图片", done: Boolean(formData.coverImage) },
    ];
    const requiredDoneCount = completionChecks.filter((item) => item.done).length;

    // 未登录时不显示内容(将重定向)
    if (!user) {
        return null;
    }

    return (
        <div className="page-shell px-3 pt-4 pb-24 sm:px-4 sm:pt-6 md:px-6 md:py-8">
            <div className="md:hidden">
                <MobilePageHeader title={editId ? "编辑项目" : "分享项目"} fallbackHref="/profile" />
            </div>

            <section className="surface-panel overflow-visible rounded-none border-0 bg-transparent px-0 py-4 shadow-none sm:overflow-hidden sm:rounded-[28px] sm:border sm:bg-card/88 sm:px-7 sm:py-7 sm:shadow-[0_24px_60px_-36px_rgba(15,23,42,0.28)] lg:px-8">
                <div className="mb-6 px-1 sm:mb-8 sm:px-0">
                    <p className="section-kicker">{editId ? "项目修改" : "项目发布"}</p>
                    <h1 className="mb-2 mt-3 text-[1.9rem] font-semibold tracking-tight sm:text-3xl">{editId ? "编辑项目" : "分享你的创意"}</h1>
                    <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                        {editId ? "修改已发布或被拒绝的项目内容" : "把你的 STEAM 项目整理成清晰作品，提交到平台中继续展示和审核。"}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="min-w-0 space-y-6">

                    {/* 挑战关联横幅 */}
                    {challengeInfo && (
                        <Card className="surface-subtle rounded-[22px] border-primary/35 bg-primary/5 shadow-none">
                            <CardContent className="px-3.5 py-4 sm:px-6">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                        🏆
                                    </div>
                                    <div>
                                        <p className="font-semibold text-primary">
                                            {challengeInfo.challengeType === 'timed' ? '限时挑战' : '长期挑战'}：{challengeInfo.title}
                                        </p>
                                        {challengeInfo.drivingQuestion && (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                驱动问题：{challengeInfo.drivingQuestion}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                {/* 基本信息卡片 */}
                <Card className={SECTION_CARD_CLASS}>
                    <CardHeader className={SECTION_HEADER_CLASS}>
                        <CardTitle className="text-xl sm:text-2xl">基本信息</CardTitle>
                        <CardDescription>填写项目的基本信息</CardDescription>
                    </CardHeader>
                    <CardContent className={SECTION_CONTENT_CLASS}>
                        {/* 项目标题 */}
                        <div className="space-y-2">
                            <Label htmlFor="title">项目标题 *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => handleInputChange("title", e.target.value)}
                                placeholder="例如：自制水火箭"
                                required
                                className={FIELD_CLASS}
                            />
                        </div>

                        {/* 项目分类 */}
                        <div className="space-y-2">
                            <Label>项目分类 *</Label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => handleInputChange("category", cat)}
                                        className={`${CHIP_CLASS} filter-chip-base ${formData.category === cat
                                            ? "filter-chip-active-solid"
                                            : "filter-chip-idle border-border/70"
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 子分类 */}
                        <div className="space-y-2">
                            <Label>子分类</Label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORY_CONFIG[formData.category]?.map((sub) => (
                                    <button
                                        key={sub}
                                        type="button"
                                        onClick={() => handleInputChange("subCategory", sub)}
                                        className={`${CHIP_CLASS} filter-chip-base ${formData.subCategory === sub
                                            ? "filter-chip-active-solid"
                                            : "filter-chip-idle border-border/70"
                                            }`}
                                    >
                                        {sub}
                                    </button>
                                ))}
                                {(!CATEGORY_CONFIG[formData.category] || CATEGORY_CONFIG[formData.category].length === 0) && (
                                    <span className="text-sm text-muted-foreground">该分类下暂无子分类</span>
                                )}
                            </div>
                        </div>

                        {/* 项目封面图片 */}
                        <div className="space-y-2">
                            <Label>项目封面图片（可选）</Label>
                            <p className="text-sm text-muted-foreground mb-2">
                                未上传时将使用&ldquo;{formData.category}&rdquo;类别的默认主题图
                            </p>
                            <ImageUpload
                                value={formData.coverImage}
                                onChange={handleCoverImageChange}
                                bucket="project-images"
                                pathPrefix="covers"
                                placeholder="点击上传项目封面图片"
                            />
                        </div>

                        {/* 难度等级 - Removed as per user request to be handled by admin */}
                        {/* 标签 - Removed as per user request to be handled by admin */}
                    </CardContent>
                </Card>

                {/* 项目详情卡片 */}
                <Card className={SECTION_CARD_CLASS}>
                    <CardHeader className={SECTION_HEADER_CLASS}>
                        <CardTitle className="text-xl sm:text-2xl">项目详情</CardTitle>
                        <CardDescription>详细描述你的项目</CardDescription>
                    </CardHeader>
                    <CardContent className={SECTION_CONTENT_CLASS}>
                        {/* 所需材料 */}
                        <div className="space-y-2">
                            <Label htmlFor="materials">所需材料</Label>
                            <Textarea
                                id="materials"
                                value={formData.materials}
                                onChange={(e) => handleInputChange("materials", e.target.value)}
                                placeholder="每行一个材料，例如：&#10;塑料瓶 x1&#10;气球 x2&#10;胶带"
                                rows={5}
                                className={FIELD_CLASS}
                            />
                        </div>

                        {/* 制作步骤 */}
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <Label>制作步骤 *</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addStep}
                                    className="w-full gap-2 rounded-full sm:w-auto"
                                >
                                    <Plus className="h-4 w-4" />
                                    添加步骤
                                </Button>
                            </div>

                            {formData.steps.map((step, index) => (
                                <Card key={index} className={SUBSECTION_CARD_CLASS}>
                                    <CardHeader className="px-3.5 pb-2.5 pt-3.5 sm:px-5 sm:pb-3 sm:pt-5">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base">步骤 {index + 1}</CardTitle>
                                            {formData.steps.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeStep(index)}
                                                    className="h-9 w-9 rounded-full p-0 text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 px-3.5 pb-3.5 sm:px-5 sm:pb-5">
                                        <div className="space-y-2">
                                            <Label htmlFor={`step-title-${index}`}>步骤标题</Label>
                                            <Input
                                                id={`step-title-${index}`}
                                                value={step.title}
                                                onChange={(e) => handleStepChange(index, "title", e.target.value)}
                                                placeholder={`例如：准备材料`}
                                                className={FIELD_CLASS}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`step-desc-${index}`}>步骤说明 *</Label>
                                            <Textarea
                                                id={`step-desc-${index}`}
                                                value={step.description}
                                                onChange={(e) => handleStepChange(index, "description", e.target.value)}
                                                placeholder="详细描述这一步需要做什么..."
                                                rows={3}
                                                required
                                                className={FIELD_CLASS}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>步骤图片（可选）</Label>
                                            <ImageUpload
                                                value={step.image_url}
                                                onChange={(url) => handleStepChange(index, "image_url", url)}
                                                bucket="project-images"
                                                pathPrefix="steps"
                                                aspectRatio="aspect-video"
                                                placeholder="上传步骤示意图"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* PBL 反思区域（仅挑战关联时显示） */}
                {challengeInfo && (
                    <Card className={SECTION_CARD_CLASS}>
                        <CardHeader className={SECTION_HEADER_CLASS}>
                            <CardTitle className="text-xl sm:text-2xl">PBL 反思</CardTitle>
                            <CardDescription>记录你的探究过程和思考</CardDescription>
                        </CardHeader>
                        <CardContent className={SECTION_CONTENT_CLASS}>
                            <div className="space-y-2">
                                <Label htmlFor="problemStatement">问题重述</Label>
                                <Textarea
                                    id="problemStatement"
                                    value={formData.problemStatement}
                                    onChange={(e) => setFormData(prev => ({ ...prev, problemStatement: e.target.value }))}
                                    placeholder="用你自己的话描述你要解决什么问题"
                                    rows={3}
                                    className={FIELD_CLASS}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <Label>试错记录</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setFormData(prev => ({
                                            ...prev,
                                            iterations: [...prev.iterations, { description: '', result: '' }]
                                        }))}
                                        className="w-full gap-2 rounded-full sm:w-auto"
                                    >
                                        <Plus className="h-4 w-4" />
                                        添加记录
                                    </Button>
                                </div>
                                {formData.iterations.length === 0 && (
                                    <p className="text-sm text-muted-foreground">记录你的每次尝试和结果，展示探究过程</p>
                                )}
                                {formData.iterations.map((it, i) => (
                                    <div key={i} className="space-y-3 rounded-[16px] bg-background/72 p-3 ring-1 ring-inset ring-border/40 sm:rounded-2xl sm:p-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">尝试 #{i + 1}</span>
                                            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 rounded-full p-0"
                                                onClick={() => setFormData(prev => ({ ...prev, iterations: prev.iterations.filter((_, idx) => idx !== i) }))}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Input
                                            value={it.description}
                                            onChange={e => {
                                                const next = [...formData.iterations];
                                                next[i] = { ...next[i], description: e.target.value };
                                                setFormData(prev => ({ ...prev, iterations: next }));
                                            }}
                                            placeholder="做了什么"
                                            className={FIELD_CLASS}
                                        />
                                        <Input
                                            value={it.result}
                                            onChange={e => {
                                                const next = [...formData.iterations];
                                                next[i] = { ...next[i], result: e.target.value };
                                                setFormData(prev => ({ ...prev, iterations: next }));
                                            }}
                                            placeholder="结果如何"
                                            className={FIELD_CLASS}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reflection">反思总结</Label>
                                <Textarea
                                    id="reflection"
                                    value={formData.reflection}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reflection: e.target.value }))}
                                    placeholder="你从这个过程中学到了什么？哪里还可以改进？"
                                    rows={4}
                                    className={FIELD_CLASS}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                    </div>

                    <aside className="hidden lg:block">
                        <div className="sticky top-24 space-y-4">
                            <section className="surface-subtle p-4">
                                <p className="section-kicker">发布检查</p>
                                <h2 className="mt-3 text-lg font-semibold tracking-tight">提交前确认</h2>
                                <div className="mt-4 space-y-2">
                                    {completionChecks.map((item) => (
                                        <div key={item.label} className="flex items-center justify-between rounded-2xl bg-background/72 px-3 py-2.5 text-sm">
                                            <span className="text-muted-foreground">{item.label}</span>
                                            <span className={cn(
                                                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                                                item.done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                                            )}>
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                {item.done ? "完成" : "待补充"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="surface-subtle overflow-hidden">
                                <div className="border-b border-border/60 px-4 py-4">
                                    <p className="text-sm font-semibold tracking-tight">项目预览</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{requiredDoneCount}/5 项信息已完善</p>
                                </div>
                                <div className="p-4">
                                    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted/50">
                                        {formData.coverImage ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={formData.coverImage} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                                默认使用 {formData.category} 主题图
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="mt-3 line-clamp-2 text-base font-semibold tracking-tight">
                                        {formData.title.trim() || "未命名项目"}
                                    </h3>
                                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                        {formData.steps.find((step) => step.description.trim())?.description || "补充第一个制作步骤后，这里会生成项目摘要。"}
                                    </p>
                                </div>
                            </section>
                        </div>
                    </aside>

                {/* 操作按钮 */}
                <div className="sticky bottom-0 z-20 -mx-3 flex flex-col gap-3 border-t border-border/60 bg-background/92 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-0 lg:col-span-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveDraft}
                        disabled={isSavingDraft}
                        className="w-full gap-2 rounded-full sm:w-auto"
                    >
                        {isSavingDraft ? (
                            <CheckCircle2 className="h-4 w-4" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {isSavingDraft ? "已保存" : "保存草稿"}
                    </Button>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="outline" type="button" className="w-full rounded-full sm:w-auto" onClick={() => router.back()}>
                            取消
                        </Button>
                        <Button type="submit" disabled={isLoading} className="w-full gap-2 rounded-full sm:w-auto">
                            <Upload className="h-4 w-4" />
                            {isLoading ? "提交中..." : "提交审核"}
                        </Button>
                    </div>
                </div>
                </form>
            </section>
        </div>
    );
}

export function ProjectPublishPage() {
    return (
        <Suspense fallback={<div className="page-shell py-8 text-center text-muted-foreground">加载中...</div>}>
            <ShareForm />
        </Suspense>
    );
}

export default function SharePage() {
    return <ProjectPublishPage />
}
