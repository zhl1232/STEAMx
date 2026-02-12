import { notFound } from 'next/navigation'
import Link from 'next/link'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { ArrowLeft, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/features/project-card'
import { ProjectInteractions } from '@/components/features/project-interactions'
import { ProjectComments } from '@/components/features/project-comments'
import { ProjectShowcase } from '@/components/features/project-showcase'
import { getProjectById, getRelatedProjects, getProjectCompletions, getProjectComments } from '@/lib/api/explore-data'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Edit, Coins } from 'lucide-react'

interface ProjectDetailPageProps {
    params: Promise<{ id: string }>
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

    // 如果项目不是已发布状态
    if (project.status && project.status !== 'approved') {
        // 如果不是作者且不是管理员(目前简化为作者判断)，则无法访问
        if (!isAuthor) {
            // 对于非作者，Rejected/Pending 项目视为不存在或审核中
            // 这里选择显示“审核中”或 404，这取决于产品策略
            // 用户反馈是 "bug"，意味这应该是私有的

            // 为了更好的体验，可以返回一个 "Project Under Review" 页面，或者直接 404
            // 这里选择 404 以保护隐私，除非是 Pending 状态可能显示 "Coming Soon"
            notFound()
        }
    }

    // 如果是作者且状态异常，显示提示条
    const showStatusAlert = isAuthor && (project.status === 'pending' || project.status === 'rejected');

    // 获取相关项目
    const relatedProjects = project.category
        ? await getRelatedProjects(project.id, project.category, 3)
        : []

    // 获取完成记录
    const completions = await getProjectCompletions(project.id, 8)

    // 获取评论 (分页)
    const { comments: initialComments, total: totalComments, hasMore: hasMoreComments } = await getProjectComments(project.id, 0, 5)

    // 该项目收到的投币总数（项目维度）
    const { data } = await callRpc(supabase, 'get_tip_received_for_resource', {
        p_resource_type: 'project',
        p_resource_id: Number(project.id)
    })
    const projectCoinsReceived = data ?? 0

    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="mb-8">
                <Link
                    href="/explore"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> 返回探索
                </Link>

                {showStatusAlert && (
                    <Alert className={`mb-6 ${project.status === 'rejected' ? 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200' : 'border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200'}`}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>
                            {project.status === 'rejected' ? '项目未通过审核' : '项目正在审核中'}
                        </AlertTitle>
                        <AlertDescription className="mt-2 flex items-center justify-between">
                            <span>
                                {project.status === 'rejected'
                                    ? '您的项目未通过审核，请根据反馈修改后重新提交。'
                                    : '您的项目正在审核中，仅即您可见。'}
                            </span>
                            <Link href={`/share?edit=${project.id}`}>
                                <Button variant={project.status === 'rejected' ? "destructive" : "outline"} size="sm" className="gap-2">
                                    <Edit className="h-4 w-4" />
                                    编辑项目
                                </Button>
                            </Link>
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
                            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                    By{" "}
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
                                <span>•</span>
                                <span>{project.category}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1" title="该项目收到的投币">
                                    <Coins className="h-4 w-4" />
                                    <span>{projectCoinsReceived} 硬币</span>
                                </span>
                            </div>
                        </div>

                        {/* 移动端：交互区紧跟标题，便于操作 */}
                        <div className="block md:hidden">
                            <ProjectInteractions
                                projectId={project.id}
                                projectTitle={project.title}
                                likes={project.likes}
                                completions={completions}
                                projectOwnerId={project.author_id}
                            />
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

                    {/* Showcase Section */}
                    {completions.length > 0 && (
                        <div className="border-t pt-8">
                            <ProjectShowcase completions={completions} />
                        </div>
                    )}

                    {/* Comments Section - Client Component */}
                    <ProjectComments
                        projectId={project.id}
                        initialComments={initialComments}
                        initialTotal={totalComments}
                        initialHasMore={hasMoreComments}
                    />
                </div>

                <div className="space-y-8">
                    <div className="space-y-6">
                        {/* 桌面端：侧边栏交互区（移动端在标题下方显示） */}
                        <div className="hidden md:block">
                            <ProjectInteractions
                                projectId={project.id}
                                projectTitle={project.title}
                                likes={project.likes}
                                completions={completions}
                                projectOwnerId={project.author_id}
                            />
                        </div>

                        <div className="rounded-lg border p-4">
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
                    </div>
                </div>
            </div>

            {/* Related Projects */}
            {
                relatedProjects.length > 0 && (
                    <div className="mt-16 border-t pt-12">
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
