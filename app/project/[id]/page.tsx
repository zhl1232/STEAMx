import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/features/project-card'
import { ProjectInteractions } from '@/components/features/project-interactions'
import { ProjectComments } from '@/components/features/project-comments'
import { ProjectShowcase } from '@/components/features/project-showcase'
import { getProjectById, getRelatedProjects, getProjectCompletions } from '@/lib/api/explore-data'

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

    // 获取相关项目
    const relatedProjects = project.category
        ? await getRelatedProjects(project.id, project.category, 3)
        : []

    // 获取完成记录
    const completions = await getProjectCompletions(project.id, 8)

    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="mb-8">
                <Link
                    href="/explore"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> 返回探索
                </Link>
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted relative group">
                    <Image
                        src={project.image}
                        alt={project.title}
                        fill
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
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>By {project.author}</span>
                                <span>•</span>
                                <span>{project.category}</span>
                            </div>
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
                                                        <Image
                                                            src={step.image_url}
                                                            alt={step.title}
                                                            fill
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
                        initialComments={project.comments || []}
                    />
                </div>

                <div className="space-y-8">
                    <div className="space-y-6">
                        {/* Interactions - Client Component */}
                        <ProjectInteractions
                            projectId={project.id}
                            projectTitle={project.title}
                            likes={project.likes}
                        />

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
