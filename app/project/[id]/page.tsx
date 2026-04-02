import type { ReactNode } from 'react'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata, ResolvingMetadata } from 'next'
import {
  AlertTriangle,
  ArrowLeft,
  Edit,
  FolderKanban,
  Layers3,
  Package2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import { ProjectCard } from '@/components/features/project-card'
import { ProjectComments } from '@/components/features/project-comments'
import { ProjectInteractions } from '@/components/features/project-interactions'
import { CompletionCTA } from '@/components/features/project/completion-cta'
import { ProjectShowcase } from '@/components/features/project-showcase'
import { Button } from '@/components/ui/button'
import { DifficultyStars } from '@/components/ui/difficulty-stars'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  getProjectById,
  getProjectComments,
  getProjectCompletions,
  getProjectTotalCoinsReceived,
  getRelatedProjects,
} from '@/lib/api/explore-data'
import { createClient } from '@/lib/supabase/server'

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
}

function canAccessProject(project: Awaited<ReturnType<typeof getProjectById>>, viewerId?: string) {
  if (!project) return false
  if (!project.status || project.status === 'approved') return true
  return viewerId === project.author_id
}

function DetailChip({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
}) {
  return (
    <div className="surface-subtle rounded-[24px] p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-3 text-base font-semibold text-foreground">{value}</div>
    </div>
  )
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/8 via-background to-secondary/20 px-5 py-5 sm:px-7">
        <p className="section-kicker">{eyebrow}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="px-5 py-6 sm:px-7 sm:py-7">{children}</div>
    </section>
  )
}

export async function generateMetadata(
  { params }: ProjectDetailPageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return { title: '项目未找到' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!canAccessProject(project, user?.id)) {
    return { title: '项目未找到' }
  }

  const previousImages = (await parent).openGraph?.images || []

  return {
    title: `${project.title} | STEAM 探索`,
    description: project.description?.substring(0, 160) || 'STEAM 探索上的实践项目详情页。',
    openGraph: {
      title: project.title,
      description: project.description?.substring(0, 160) || 'STEAM 探索上的实践项目详情页。',
      url: `/project/${id}`,
      siteName: 'STEAM 探索',
      images: project.image
        ? [{ url: project.image, width: 1200, height: 630, alt: project.title }, ...previousImages]
        : previousImages,
      type: 'article',
      ...(project.author ? { authors: [project.author] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description: project.description?.substring(0, 160) || 'STEAM 探索上的实践项目详情页。',
      ...(project.image ? { images: [project.image] } : {}),
    },
  }
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params

  const project = await getProjectById(id)
  if (!project) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthor = user?.id === project.author_id

  if (!canAccessProject(project, user?.id)) {
    notFound()
  }

  const showStatusAlert = isAuthor && (project.status === 'pending' || project.status === 'rejected')

  const relatedProjects = project.category
    ? await getRelatedProjects(project.id, project.category, 3)
    : []

  const completions = await getProjectCompletions(project.id, 8)

  const {
    comments: initialComments,
    total: totalComments,
    hasMore: hasMoreComments,
    likedCommentIds: initialLikedCommentIds,
  } = await getProjectComments(project.id, 0, 5, { userId: user?.id })

  const projectCoinsReceived = await getProjectTotalCoinsReceived(project.id, project.coins_count ?? 0)

  const materials = project.materials ?? []
  const steps = project.steps ?? []
  const tags = project.tags ?? []
  const isObservationProject = tags.includes('鸟类')

  return (
    <div className="relative overflow-x-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(166,193,238,0.26),transparent_42%),radial-gradient(circle_at_top_right,rgba(251,194,235,0.16),transparent_36%)]" />
      <div className="page-shell pt-8 pb-24 md:pb-10">
        <MobilePageHeader
          title={project.title}
          fallbackHref="/explore"
          className="-mx-4 -mt-8 mb-4 md:hidden"
        />

        <div className="mb-5">
          <Link
            href="/explore"
            className="hidden items-center text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回探索
          </Link>
        </div>

        {showStatusAlert && (
          <Alert
            className={`mb-6 ${project.status === 'rejected' ? 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200' : 'border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200'}`}
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{project.status === 'rejected' ? '项目未通过审核' : '项目正在审核中'}</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <span className="block">
                {project.status === 'rejected'
                  ? '您的项目未通过审核，请根据反馈修改后重新提交。'
                  : '您的项目正在审核中，仅您可见。'}
              </span>
              {project.status === 'rejected' && project.rejection_reason && (
                <div className="rounded-md bg-red-100 p-3 text-sm dark:bg-red-900/30">
                  <span className="font-medium">拒绝原因：</span>
                  {project.rejection_reason}
                </div>
              )}
              <div className="flex justify-end">
                <Link href={`/share?edit=${project.id}`}>
                  <Button
                    variant={project.status === 'rejected' ? 'destructive' : 'outline'}
                    size="sm"
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    编辑项目
                  </Button>
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <section className="overflow-hidden rounded-[30px] border border-border/70 bg-card/75 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,420px)]">
            <div className="relative min-h-[260px] sm:min-h-[360px] lg:min-h-[540px]">
              <OptimizedImage
                src={project.image}
                alt={project.title}
                fill
                variant="cover"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/12 to-transparent lg:bg-gradient-to-r lg:from-black/20 lg:via-transparent lg:to-black/45" />
              <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-6 sm:top-6">
                {project.category ? (
                  <span className="inline-flex items-center rounded-full border border-white/25 bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                    {project.category}
                  </span>
                ) : null}
                {project.sub_category ? (
                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                    {project.sub_category}
                  </span>
                ) : null}
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:hidden">
                <div className="rounded-3xl border border-white/15 bg-black/30 p-4 text-white backdrop-blur-md">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/70">项目概览</p>
                  <h1 className="mt-2 text-2xl font-semibold leading-tight">{project.title}</h1>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/80">
                    {project.description || '一个适合边做边学、逐步完成的实践项目。'}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative flex flex-col justify-between border-t border-border/60 bg-gradient-to-b from-background via-background/96 to-secondary/10 lg:border-l lg:border-t-0">
              <div className="p-5 sm:p-7">
                <p className="hidden text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80 lg:block">
                  项目概览
                </p>
                <h1 className="mt-1 hidden text-4xl font-semibold leading-tight tracking-tight lg:block">
                  {project.title}
                </h1>

                <div className="mt-5 flex flex-wrap gap-2">
                  {tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <p className="mt-5 text-sm leading-7 text-muted-foreground">
                  {project.description || '一个适合边做边学、逐步完成的实践项目。'}
                </p>

                <div className="mt-6 rounded-[24px] border border-border/70 bg-background/80 p-4 shadow-sm shadow-black/5">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">作者</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div>
                      {project.author_id ? (
                        <Link
                          href={`/users/${project.author_id}`}
                          className="text-base font-semibold transition-colors hover:text-primary"
                        >
                          {project.author}
                        </Link>
                      ) : (
                        <p className="text-base font-semibold">{project.author}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">分享真实可实践的项目体验</p>
                    </div>
                    {project.difficulty_stars ? (
                      <DifficultyStars stars={project.difficulty_stars} size="sm" showLabel className="shrink-0" />
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <DetailChip icon={Layers3} label="步骤" value={steps.length > 0 ? `${steps.length} 个阶段` : '待补充'} />
                  <DetailChip icon={Package2} label="材料" value={materials.length > 0 ? `${materials.length} 项准备` : '暂无清单'} />
                  <DetailChip icon={FolderKanban} label="作品墙" value={`${completions.length} 份作品`} />
                  <DetailChip icon={Sparkles} label="社区热度" value={`${projectCoinsReceived} 枚投币`} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_320px]">
          <div className="space-y-8">
            <SectionCard
              eyebrow="内容概览"
              title="项目简介"
              description="先理解这个项目要做什么，再按步骤逐段完成，会更容易获得成就感。"
            >
              <div className="space-y-5 text-[15px] leading-8 text-foreground/90">
                <p>{project.description || '暂无介绍'}</p>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-primary/8 px-3 py-1 text-sm font-medium text-primary"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <div className="block xl:hidden">
              <SectionCard
                eyebrow="材料准备"
                title="所需材料"
                description="提前把材料准备好，做项目时会更顺。"
              >
                {materials.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {materials.map((material, index) => (
                      <div
                        key={`${material}-${index}`}
                        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span className="text-sm leading-6">{material}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无材料清单</p>
                )}
              </SectionCard>
            </div>

            <SectionCard
              eyebrow="实践流程"
              title="实践步骤"
              description={steps.length > 0 ? '按顺序推进，每一步都尽量聚焦一个动作或一个结果。' : '作者暂时还没有补充制作步骤。'}
            >
              {steps.length > 0 ? (
                <div className="space-y-5">
                  {steps.map((step, index) => (
                    <div key={`${step.title}-${index}`} className="grid gap-4 md:grid-cols-[56px_minmax(0,1fr)]">
                      <div className="hidden md:flex md:flex-col md:items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                          {index + 1}
                        </div>
                        {index < steps.length - 1 ? <div className="mt-3 h-full w-px bg-gradient-to-b from-primary/50 to-border" /> : null}
                      </div>

                      <article className="overflow-hidden rounded-[24px] border border-border/70 bg-background/75 shadow-sm shadow-black/5">
                        {step.image_url ? (
                          <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                            <OptimizedImage
                              src={step.image_url}
                              alt={step.title}
                              fill
                              variant="cover"
                              className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                            />
                          </div>
                        ) : null}

                        <div className="p-5 sm:p-6">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary md:hidden">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">步骤 {index + 1}</p>
                              <h3 className="mt-1 text-xl font-semibold tracking-tight">{step.title}</h3>
                              <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.description}</p>
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-background/50 px-5 py-10 text-center text-sm text-muted-foreground">
                  暂无步骤说明
                </div>
              )}
            </SectionCard>

            <CompletionCTA
              projectId={project.id}
              projectTitle={project.title}
              challengeId={project.challenge_id}
              mode={isObservationProject ? 'observation' : 'project'}
            />

            <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card/85 px-5 py-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.22)] backdrop-blur-sm sm:px-7 sm:py-7">
              <ProjectShowcase completions={completions} projectId={project.id} projectTitle={project.title} />
            </div>

            <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card/85 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.22)] backdrop-blur-sm">
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
          </div>

          <aside className="space-y-6">
            <div className="sticky top-24 hidden space-y-6 xl:block">
              <SectionCard
                eyebrow="快速导览"
                title="项目速览"
                description="把关键信息压缩到一处，适合边看边做。"
              >
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">分类与难度</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {project.category ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                          {project.category}
                        </span>
                      ) : null}
                      {project.sub_category ? (
                        <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
                          {project.sub_category}
                        </span>
                      ) : null}
                    </div>
                    {project.difficulty_stars ? (
                      <DifficultyStars stars={project.difficulty_stars} size="md" showLabel className="mt-4" />
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    <DetailChip icon={Layers3} label="步骤数量" value={steps.length > 0 ? `${steps.length} 步` : '未填写'} />
                    <DetailChip icon={Package2} label="材料数量" value={materials.length > 0 ? `${materials.length} 项` : '未填写'} />
                    <DetailChip icon={FolderKanban} label="完成作品" value={`${completions.length} 份`} />
                    <DetailChip icon={Sparkles} label="总投币数" value={`${projectCoinsReceived}`} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                eyebrow="材料准备"
                title="所需材料"
                description="建议先全部准备齐，再开始进入制作。"
              >
                {materials.length > 0 ? (
                  <div className="space-y-3">
                    {materials.map((material, index) => (
                      <div
                        key={`${material}-${index}`}
                        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span className="text-sm leading-6">{material}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无材料清单</p>
                )}
              </SectionCard>

              {isObservationProject ? (
                <SectionCard
                  eyebrow="观察说明"
                  title="自然观察的完成方式"
                  description="自然观察项目更强调留下可复用的记录，而不只是交一张图。"
                >
                  <p className="text-sm leading-7 text-muted-foreground">
                    在自然观察里，真正的完成不是“上传一个作品”，而是留下至少一条结构化的观察记录，写清时间、地点、物种和行为。
                  </p>
                  <Link href="/bird-observation/submit" className="mt-5 block">
                    <Button variant="outline" className="w-full">
                      去完成一条观察记录
                    </Button>
                  </Link>
                </SectionCard>
              ) : null}
            </div>
          </aside>
        </div>

        {relatedProjects.length > 0 ? (
          <section className="mt-12">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="section-kicker">继续探索</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">你可能也喜欢</h2>
              </div>
              <p className="hidden text-sm text-muted-foreground md:block">继续延展相近主题，找到下一次实践的灵感。</p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {relatedProjects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
