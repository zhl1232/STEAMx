import { notFound } from 'next/navigation'
import Link from 'next/link'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { ArrowLeft, Play, AlertTriangle, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/features/project-card'
import { ProjectInteractions } from '@/components/features/project-interactions'
import { ProjectComments } from '@/components/features/project-comments'
import { ProjectShowcase } from '@/components/features/project-showcase'
import { CompletionCTA } from '@/components/features/project/completion-cta'
import { getProjectById, getProjectTotalCoinsReceived, getRelatedProjects, getProjectCompletions, getProjectComments } from '@/lib/api/explore-data'
import { getCuratedProjectSpecies } from '@/lib/api/nature-observation-data'
import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { MobilePageHeader } from '@/components/ui/mobile-page-header'

import { Metadata, ResolvingMetadata } from 'next'

interface ProjectDetailPageProps {
    params: Promise<{ id: string }>
}

function canAccessProject(project: Awaited<ReturnType<typeof getProjectById>>, viewerId?: string) {
    if (!project) return false
    if (!project.status || project.status === 'approved') return true
    return viewerId === project.author_id
}

export async function generateMetadata(
    { params }: ProjectDetailPageProps,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { id } = await params
    const project = await getProjectById(id)
    if (!project) return { title: '项目未找到' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!canAccessProject(project, user?.id)) {
        return { title: '项目未找到' }
    }
    
    const previousImages = (await parent).openGraph?.images || []

    return {
        title: `${project.title} | Steam Explore & Share`,
        description: project.description?.substring(0, 160) || 'Steam Explore & Share 上的探索与分享项目。',
        openGraph: {
            title: project.title,
            description: project.description?.substring(0, 160) || 'Steam Explore & Share 上的探索与分享项目。',
            url: `/project/${id}`,
            siteName: 'Steam Explore & Share',
            images: project.image
                ? [{ url: project.image, width: 1200, height: 630, alt: project.title }, ...previousImages]
                : previousImages,
            type: 'article',
            ...(project.author ? { authors: [project.author] } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: project.title,
            description: project.description?.substring(0, 160) || 'Steam Explore & Share 上的探索与分享项目。',
            ...(project.image ? { images: [project.image] } : {}),
        },
    }
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
    const { id } = await params

    // 服务端获取项目数据
    const project = await getProjectById(id)

    if (!project) {
        notFound()
    }

    // 访问控制
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const isAuthor = user?.id === project.author_id

    if (!canAccessProject(project, user?.id)) {
        notFound()
    }

    // 如果是作者且状态异常，显示提示条
    const showStatusAlert = isAuthor && (project.status === 'pending' || project.status === 'rejected');

    // 获取相关项目
    const relatedProjects = project.category
        ? await getRelatedProjects(project.id, project.category, 3)
        : []
    const curatedSpecies = await getCuratedProjectSpecies(Number(project.id))

    // 获取完成记录
    const completions = await getProjectCompletions(project.id, 8)

    // 获取评论 (分页)
    const {
        comments: initialComments,
        total: totalComments,
        hasMore: hasMoreComments,
        likedCommentIds: initialLikedCommentIds,
    } = await getProjectComments(project.id, 0, 5, { userId: user?.id })

    // 底部栏显示项目总投币数：项目本身 + 所有完成作品
    const projectCoinsReceived = await getProjectTotalCoinsReceived(project.id, project.coins_count ?? 0)

    return (
        <div className="container mx-auto pt-8 pb-24 md:pb-10 max-w-4xl">
            <MobilePageHeader
                title={project.title}
                fallbackHref="/explore"
                className="-mx-4 -mt-8 mb-4 md:hidden"
            />

            <div className="mb-8">
                <Link
                    href="/explore"
                    className="hidden items-center text-sm text-muted-foreground hover:text-foreground mb-4 md:inline-flex"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> 返回探索
                </Link>

                {showStatusAlert && (
                    <Alert className={`mb-6 ${project.status === 'rejected' ? 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200' : 'border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200'}`}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>
                            {project.status === 'rejected' ? '项目未通过审核' : '项目正在审核中'}
                        </AlertTitle>
                        <AlertDescription className="mt-2 space-y-3">
                            <span className="block">
                                {project.status === 'rejected'
                                    ? '您的项目未通过审核，请根据反馈修改后重新提交。'
                                    : '您的项目正在审核中，仅您可见。'}
                            </span>
                            {project.status === 'rejected' && project.rejection_reason && (
                                <div className="rounded-md bg-red-100 dark:bg-red-900/30 p-3 text-sm">
                                    <span className="font-medium">拒绝原因：</span>
                                    {project.rejection_reason}
                                </div>
                            )}
                            <div className="flex justify-end">
                                <Link href={`/share?edit=${project.id}`}>
                                    <Button variant={project.status === 'rejected' ? "destructive" : "outline"} size="sm" className="gap-2">
                                        <Edit className="h-4 w-4" />
                                        编辑项目
                                    </Button>
                                </Link>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted relative group">
                    <OptimizedImage
                        src={project.image}
                        alt={project.title}
                        fill
                        variant="cover"
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            size="icon"
                            className="h-16 w-16 rounded-full bg-white/90 text-black hover:bg-white"
                        >
                            <Play className="h-8 w-8 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
                <div className="space-y-12">
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <span className="text-sm text-muted-foreground">
                                    {project.author_id ? (
                                        <Link
                                            href={`/users/${project.author_id}`}
                                            className="hover:text-primary hover:underline transition-colors font-medium"
                                        >
                                            {project.author}
                                        </Link>
                                    ) : (
                                        project.author
                                    )}
                                </span>
                                {project.category && (
                                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary shrink-0">
                                        {project.category}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 移动端：所需材料放在介绍和步骤之间 */}
                        <div className="block md:hidden rounded-lg border p-4">
                            <h3 className="font-semibold mb-3">所需材料</h3>
                            {project.materials && project.materials.length > 0 ? (
                                <ul className="space-y-2 text-sm">
                                    {project.materials.map((material, index) => (
                                        <li
                                            key={index}
                                            className="flex justify-between border-b last:border-0 pb-2 last:pb-0 border-dashed"
                                        >
                                            <span>{material}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">暂无材料清单</p>
                            )}
                        </div>

                        <div className="prose max-w-none">
                            <h3>项目介绍</h3>
                            <p>{project.description || "暂无介绍"}</p>

                            {project.steps && project.steps.length > 0 && (
                                <>
                                    <h3>制作步骤</h3>
                                    <div className="not-prose space-y-6">
                                        {project.steps.map((step, index) => (
                                            <div
                                                key={index}
                                                className="rounded-lg border bg-card overflow-hidden"
                                            >
                                                {/* 步骤图片 - 图上 */}
                                                {step.image_url && (
                                                    <div className="aspect-video w-full relative bg-muted">
                                                        <OptimizedImage
                                                            src={step.image_url}
                                                            alt={step.title}
                                                            fill
                                                            variant="cover"
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                )}

                                                {/* 步骤内容 - 文下 */}
                                                <div className="p-4 space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                                                            {index + 1}
                                                        </div>
                                                        <h4 className="font-semibold text-lg">{step.title}</h4>
                                                    </div>
                                                    <p className="text-muted-foreground pl-11">{step.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {curatedSpecies.length > 0 && (
                        <div className="rounded-2xl border p-5">
                            <h3 className="text-xl font-semibold mb-3">你可能会看到哪些鸟</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                这些物种是这个项目当前推荐你重点观察和记录的对象。
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {curatedSpecies.map((species) => (
                                    <Link
                                        key={species.id}
                                        href={`/explore/species/${species.slug}`}
                                        className="rounded-xl border bg-muted/20 p-4 hover:bg-muted/40"
                                    >
                                        <div className="font-semibold">{species.commonName}</div>
                                        {species.scientificName && (
                                            <div className="mt-1 text-xs italic text-muted-foreground">{species.scientificName}</div>
                                        )}
                                        {species.habitatNotes && (
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{species.habitatNotes}</p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CTA: 上传作品引导（完成后自动隐藏） */}
                    <CompletionCTA
                        projectId={project.id}
                        projectTitle={project.title}
                        challengeId={project.challenge_id}
                        mode={project.tags?.includes('鸟类') ? 'observation' : 'project'}
                    />

                    {/* Showcase Section */}
                    <div className="border-t pt-8">
                        <ProjectShowcase completions={completions} projectId={project.id} projectTitle={project.title} />
                    </div>

                    {/* Comments Section - 回复框与操作（点赞/收藏/评论数/投币）同行，参考社交应用底部栏 */}
                    <ProjectComments
                        projectId={project.id}
                        initialComments={initialComments}
                        initialTotal={totalComments}
                        initialHasMore={hasMoreComments}
                        initialLikedCommentIds={initialLikedCommentIds}
                        actionsSlot={
                            <ProjectInteractions
                                projectId={project.id}
                                projectTitle={project.title}
                                likes={project.likes}
                                completions={completions}
                                projectOwnerId={project.author_id}
                                embedded
                                commentsCount={totalComments}
                                projectCoinsReceived={projectCoinsReceived}
                                challengeId={project.challenge_id}
                            />
                        }
                    />
                </div>

                <div className="space-y-8">
                    <div className="space-y-6">
                        {/* 桌面端：侧边栏所需材料（移动端在介绍下方显示） */}
                        <div className="hidden md:block rounded-lg border p-4">
                            <h3 className="font-semibold mb-3">所需材料</h3>
                            {project.materials && project.materials.length > 0 ? (
                                <ul className="space-y-2 text-sm">
                                    {project.materials.map((material, index) => (
                                        <li
                                            key={index}
                                            className="flex justify-between border-b last:border-0 pb-2 last:pb-0 border-dashed"
                                        >
                                            <span>{material}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">暂无材料清单</p>
                            )}
                        </div>

                        {project.tags?.includes('鸟类') && (
                            <div className="rounded-lg border bg-emerald-50/60 p-4 dark:bg-emerald-950/10">
                                <h3 className="font-semibold mb-2">这个任务的完成动作</h3>
                                <p className="text-sm text-muted-foreground mb-3">
                                    在自然观察里，真正的完成不是“上传一个作品”，而是留下至少一条结构化的观察记录，写清时间、地点、物种和行为。
                                </p>
                                <Link href={`/bird-observation/submit?project=${project.id}${project.challenge_id ? `&challenge=${project.challenge_id}` : ''}`}>
                                    <Button variant="outline" className="w-full">
                                        去完成一条观察记录
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Related Projects */}
            {
                relatedProjects.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-2xl font-bold mb-6">你可能也喜欢</h2>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {relatedProjects.map((p) => (
                                <ProjectCard key={p.id} project={p} />
                            ))}
                        </div>
                    </div>
                )
            }
        </div >
    )
}
