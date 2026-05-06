import type { ReactNode } from 'react'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata, ResolvingMetadata } from 'next'
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Edit,
  ListChecks,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'

import { CoinIcon } from '@/components/icons/coin-icon'
import { ProjectComments } from '@/components/features/project-comments'
import { ProjectInteractions } from '@/components/features/project-interactions'
import { MobileProjectCommunityTabs } from '@/components/features/project/mobile-project-community-tabs'
import { CompletionCTA } from '@/components/features/project/completion-cta'
import { ProjectContinuationCard } from '@/components/features/project/project-continuation-card'
import { ProjectDetailActions } from '@/components/features/project/project-detail-actions'
import { ProjectDetailScrollTop } from '@/components/features/project/project-detail-scroll-top'
import { ProjectDetailStickyBar } from '@/components/features/project/project-detail-sticky-bar'
import { ProjectHeroActions } from '@/components/features/project/project-hero-actions'
import { ProjectShowcase } from '@/components/features/project-showcase'
import { FollowButton } from '@/components/features/social/follow-button'
import { Button } from '@/components/ui/button'
import { DifficultyStars } from '@/components/ui/difficulty-stars'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ToneBadge, type CategoryTone } from '@/components/ui/tone-badge'
import {
  getProjectAtIndex,
  getProjectById,
  getProjectComments,
  getProjectCompletions,
  getProjectCompletionsCount,
  getProjectCollectionsCount,
  getRelatedProjects,
  getProjectTotalCoinsReceived,
  type ProjectFilters,
} from '@/lib/api/explore-data'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { ProjectStep } from '@/lib/mappers/types'

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<{
    from?: string | string[]
    sourceIndex?: string | string[]
    q?: string | string[]
    category?: string | string[]
    subCategory?: string | string[]
    difficulty?: string | string[]
    tags?: string | string[]
    sortBy?: string | string[]
  }>
}

function getSingleSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0]
  return value
}

function buildExploreSearchParams(searchParams?: Awaited<ProjectDetailPageProps['searchParams']>) {
  const params = new URLSearchParams()
  const query = getSingleSearchParam(searchParams?.q)
  const category = getSingleSearchParam(searchParams?.category)
  const subCategory = getSingleSearchParam(searchParams?.subCategory)
  const difficulty = getSingleSearchParam(searchParams?.difficulty)
  const tags = getSingleSearchParam(searchParams?.tags)
  const sortBy = getSingleSearchParam(searchParams?.sortBy)

  if (query) params.set('q', query)
  if (category) params.set('category', category)
  if (subCategory) params.set('subCategory', subCategory)
  if (difficulty) params.set('difficulty', difficulty)
  if (tags) params.set('tags', tags)
  if (sortBy === 'latest') params.set('sortBy', 'latest')

  return params
}

function buildExploreHref(searchParams?: Awaited<ProjectDetailPageProps['searchParams']>) {
  const params = buildExploreSearchParams(searchParams)
  return params.size > 0 ? `/explore?${params.toString()}` : '/explore'
}

function buildProjectHref(
  projectId: string | number,
  searchParams?: Awaited<ProjectDetailPageProps['searchParams']>,
  sourceIndex?: number,
) {
  const params = buildExploreSearchParams(searchParams)

  if (Number.isInteger(sourceIndex) && (sourceIndex ?? -1) >= 0) {
    params.set('from', 'explore')
    params.set('sourceIndex', String(sourceIndex))
  }

  const query = params.toString()
  return query ? `/project/${projectId}?${query}` : `/project/${projectId}`
}

function parseProjectFilters(searchParams?: Awaited<ProjectDetailPageProps['searchParams']>): ProjectFilters {
  const tagsValue = getSingleSearchParam(searchParams?.tags)

  return {
    searchQuery: getSingleSearchParam(searchParams?.q),
    category: getSingleSearchParam(searchParams?.category),
    subCategory: getSingleSearchParam(searchParams?.subCategory),
    difficulty: getSingleSearchParam(searchParams?.difficulty) as ProjectFilters['difficulty'],
    tags: tagsValue ? tagsValue.split(',').filter(Boolean) : undefined,
  }
}

function canAccessProject(project: Awaited<ReturnType<typeof getProjectById>>, viewerId?: string) {
  if (!project) return false
  if (!project.status || project.status === 'approved') return true
  return viewerId === project.author_id
}

function getCategoryTone(category?: string): CategoryTone {
  if (category === '技术') return 'tech'
  if (category === '工程') return 'engineering'
  if (category === '艺术') return 'art'
  if (category === '数学') return 'math'
  if (category === '其他') return 'playground'
  return 'science'
}

function getDifficultyLabel(stars?: number) {
  const value = Math.max(1, Math.min(6, stars ?? 1))
  if (value === 1) return '入门'
  if (value === 2) return '简单'
  if (value === 3) return '中等'
  if (value === 4) return '进阶'
  if (value === 5) return '挑战'
  return '传说'
}

function formatCount(value: number) {
  if (value >= 10000) {
    const rounded = value / 10000
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}w`
  }
  if (value >= 1000) {
    const rounded = value / 1000
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}k`
  }
  return String(value)
}

interface ProjectAuthorSummary {
  id: string
  name: string
  avatarUrl?: string | null
  bio?: string | null
  level: number
  projectsCount: number
  followerCount: number
  likesReceived: number
}

function getLevelFromXp(xp?: number | null) {
  return Math.floor(Math.sqrt(Number(xp || 0) / 100)) + 1
}

async function getProjectAuthorSummary(
  authorId?: string | null,
  fallbackName?: string | null,
): Promise<ProjectAuthorSummary | null> {
  if (!authorId) return null

  const supabase = await createClient()
  const [profileResponse, projectsCountResponse, followersResponse, likesResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio, xp')
      .eq('id', authorId)
      .maybeSingle(),
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', authorId)
      .eq('status', 'approved'),
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', authorId),
    supabase
      .from('projects')
      .select('likes_count')
      .eq('author_id', authorId)
      .eq('status', 'approved'),
  ])

  const profile = profileResponse.data as {
    id: string
    display_name?: string | null
    avatar_url?: string | null
    bio?: string | null
    xp?: number | null
  } | null
  const likesRows = (likesResponse.data as { likes_count?: number | null }[] | null) || []

  if (!profile && !fallbackName) return null

  return {
    id: authorId,
    name: profile?.display_name || fallbackName || '项目作者',
    avatarUrl: profile?.avatar_url,
    bio: profile?.bio,
    level: getLevelFromXp(profile?.xp),
    projectsCount: projectsCountResponse.count || 0,
    followerCount: followersResponse.count || 0,
    likesReceived: likesRows.reduce((sum, row) => sum + Number(row.likes_count || 0), 0),
  }
}

function getMaterialMeta(material: string) {
  const normalized = material.trim()
  const amountMatch = normalized.match(/(?:[x×*]\s*)?(\d+(?:\.\d+)?\s*(?:个|只|张|根|支|套|瓶|块|枚|片|条|卷|米|cm|厘米|ml|毫升|g|克))/i)
  const amount = amountMatch?.[1] ?? (/水|胶|颜料|纸|线/.test(normalized) ? '适量' : '1 个')
  const rawName = normalized
    .replace(/(?:[x×*]\s*)?\d+(?:\.\d+)?\s*(?:个|只|张|根|支|套|瓶|块|枚|片|条|卷|米|cm|厘米|ml|毫升|g|克)/gi, '')
    .replace(/[，,、:：-]+$/g, '')
    .trim()
  const noteMatch = rawName.match(/^(.*?)[（(]([^）)]+)[）)]$/)
  const name = noteMatch?.[1]?.trim() || rawName
  const note = noteMatch?.[2]?.trim()

  return {
    name: name || normalized,
    amount,
    note,
  }
}

function MaterialsList({ materials, compact = false }: { materials: string[]; compact?: boolean }) {
  if (materials.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无材料清单</p>
  }

  return (
    <div className={compact ? "grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] xl:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-1"}>
      {materials.map((material, index) => (
        compact ? (
          <MaterialTile key={`${material}-${index}`} material={material} index={index} />
        ) : (
          <div
            key={`${material}-${index}`}
            className="flex items-center gap-3 rounded-[12px] border border-[hsl(var(--surface-border))] bg-background/72 px-4 py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[hsl(var(--brand-blue)/0.1)] text-sm font-semibold text-[hsl(var(--brand-blue))]">
              {index + 1}
            </span>
            <span className="text-sm leading-6">{material}</span>
          </div>
        )
      ))}
    </div>
  )
}

function MaterialTile({ material, index }: { material: string; index: number }) {
  const meta = getMaterialMeta(material)
  const tones = [
    'bg-[hsl(var(--tone-science-soft))] text-[hsl(var(--tone-science))]',
    'bg-[hsl(var(--tone-engineering-soft))] text-[hsl(var(--tone-engineering))]',
    'bg-[hsl(var(--tone-tech-soft))] text-[hsl(var(--tone-tech))]',
    'bg-[hsl(var(--tone-playground-soft))] text-[hsl(var(--tone-playground))]',
  ]

  return (
    <div className="group flex min-h-[60px] items-center gap-2 rounded-[10px] border border-[hsl(var(--surface-border))] bg-background/78 p-2 shadow-sm shadow-[hsl(var(--surface-shadow)/0.035)] sm:min-h-[64px] sm:gap-2.5 sm:p-2.5">
      <div className="shrink-0">
        <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-[hsl(var(--surface-muted))] sm:h-9 sm:w-9 sm:rounded-[10px]">
          <Box className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-[hsl(var(--brand-blue))] sm:h-[18px] sm:w-[18px]" strokeWidth={1.8} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 sm:gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-xs font-semibold leading-tight [overflow-wrap:anywhere] sm:text-sm">{meta.name}</p>
          {meta.note ? (
            <p className="mt-0.5 truncate text-[11px] leading-3.5 text-muted-foreground sm:text-xs sm:leading-4">{meta.note}</p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-[7px] px-1.5 py-0.5 text-[11px] font-semibold ${tones[index % tones.length]}`}>
          {meta.amount}
        </span>
      </div>
    </div>
  )
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="surface-panel overflow-hidden rounded-[18px]">
      <div className="border-b border-border/60 px-5 py-5 sm:px-6">
        {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-sans text-xl font-bold tracking-tight">{title}</h2>
          {description ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </section>
  )
}

function HeroStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: string
  label: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-3 border-r border-border/70 px-4 last:border-r-0">
      <span className="hidden text-muted-foreground sm:inline-flex">{icon}</span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function ProjectAuthorCard({ author, compact = false }: { author: ProjectAuthorSummary | null; compact?: boolean }) {
  if (!author) return null

  const bio = author.bio || '热爱科学与创造，喜欢用动手实践探索世界的奥秘。'

  if (compact) {
    return (
      <section className="surface-panel flex items-center justify-between gap-3 rounded-[14px] px-4 py-3">
        <Link href={`/users/${author.id}`} className="flex min-w-0 items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[hsl(var(--brand-blue)/0.1)]">
            {author.avatarUrl ? (
              <OptimizedImage
                src={author.avatarUrl}
                alt={author.name}
                fill
                variant="avatar"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[hsl(var(--brand-blue))]">
                {author.name[0] || '作'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-bold text-foreground">{author.name}</p>
              <span className="shrink-0 rounded-full bg-[hsl(var(--tone-tech-soft))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--tone-tech))]">
                LV{author.level}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">项目作者</p>
          </div>
        </Link>
        <FollowButton
          targetUserId={author.id}
          variant="outline"
          showIcon={false}
          className="h-8 min-w-[72px] shrink-0 rounded-[8px] border-[hsl(var(--surface-border-strong))] bg-background/72 px-3 text-xs text-foreground hover:bg-[hsl(var(--surface-muted))]"
        />
      </section>
    )
  }

  return (
    <section className="surface-panel overflow-hidden rounded-[18px] px-5 py-5 sm:px-6">
      <h2 className="font-sans text-base font-bold tracking-tight">项目作者</h2>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link href={`/users/${author.id}`} className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[hsl(var(--brand-blue)/0.1)]">
            {author.avatarUrl ? (
              <OptimizedImage
                src={author.avatarUrl}
                alt={author.name}
                fill
                variant="avatar"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base font-bold text-[hsl(var(--brand-blue))]">
                {author.name[0] || '作'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-bold text-foreground">{author.name}</p>
              <span className="shrink-0 rounded-full bg-[hsl(var(--tone-tech-soft))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--tone-tech))]">
                LV{author.level}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">项目作者</p>
          </div>
        </Link>
        <FollowButton
          targetUserId={author.id}
          variant="outline"
          showIcon={false}
          className="h-9 min-w-[86px] shrink-0 rounded-[8px] border-[hsl(var(--surface-border-strong))] bg-background/72 px-4 text-foreground hover:bg-[hsl(var(--surface-muted))]"
        />
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x divide-border/70 border-y border-border/60 py-3 text-center">
        <div>
          <p className="text-xs text-muted-foreground">发布项目</p>
          <p className="mt-1 text-base font-bold tracking-tight">{formatCount(author.projectsCount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">粉丝</p>
          <p className="mt-1 text-base font-bold tracking-tight">{formatCount(author.followerCount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">获赞</p>
          <p className="mt-1 text-base font-bold tracking-tight">{formatCount(author.likesReceived)}</p>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{bio}</p>
    </section>
  )
}

function StepItem({
  step,
  index,
  isLast,
}: {
  step: ProjectStep
  index: number
  isLast: boolean
}) {
  const stepTitle = step.title || `步骤 ${index + 1}`
  const hasImage = Boolean(step.image_url)

  return (
    <li
      id={`project-step-${index + 1}`}
      className="scroll-mt-28 grid grid-cols-[32px_minmax(0,1fr)] gap-2.5"
    >
      <div className="relative flex justify-start">
        <span className="z-10 grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--brand-blue))] text-sm font-bold text-white shadow-[0_12px_24px_-18px_hsl(var(--brand-blue)/0.9)]">
          {index + 1}
        </span>
        {!isLast ? (
          <span className="absolute bottom-[-14px] left-4 top-9 w-px bg-[hsl(var(--brand-blue)/0.22)]" />
        ) : null}
      </div>
      <article
        className={cn(
          "group min-w-0 rounded-[12px] border border-[hsl(var(--surface-border))] bg-background/78 p-3 shadow-sm shadow-[hsl(var(--surface-shadow)/0.04)]",
          hasImage ? "grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center" : "px-4 py-3",
        )}
      >
        {hasImage ? (
          <div className="relative h-16 overflow-hidden rounded-[10px] bg-muted sm:h-20">
            <OptimizedImage
              src={step.image_url!}
              alt={stepTitle}
              fill
              variant="thumbnail"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="break-words font-sans text-base font-bold leading-5 [overflow-wrap:anywhere]">
            {stepTitle}
          </h3>
          <p
            className={cn(
              "mt-1 break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]",
              hasImage && "sm:line-clamp-2",
            )}
          >
            {step.description}
          </p>
        </div>
      </article>
    </li>
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

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined

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

  const fromExplore = getSingleSearchParam(resolvedSearchParams?.from) === 'explore'
  const parsedSourceIndex = Number.parseInt(getSingleSearchParam(resolvedSearchParams?.sourceIndex) || '', 10)
  const sourceIndex = Number.isInteger(parsedSourceIndex) && parsedSourceIndex >= 0 ? parsedSourceIndex : null
  const exploreFilters = parseProjectFilters(resolvedSearchParams)
  const exploreBackHref = buildExploreHref(resolvedSearchParams)

  const showStatusAlert = isAuthor && (project.status === 'pending' || project.status === 'rejected')

  const [
    completions,
    completionCount,
    commentsData,
    projectCoinsReceived,
    collectionsCount,
    nextProject,
    relatedProjects,
    authorSummary,
  ] = await Promise.all([
    getProjectCompletions(project.id, 8),
    getProjectCompletionsCount(project.id),
    getProjectComments(project.id, 0, 5, { userId: user?.id }),
    getProjectTotalCoinsReceived(project.id, project.coins_count ?? 0),
    getProjectCollectionsCount(project.id),
    fromExplore && sourceIndex !== null
      ? getProjectAtIndex(exploreFilters, sourceIndex + 1, {
          sortBy: getSingleSearchParam(resolvedSearchParams?.sortBy) === 'latest' ? 'latest' : 'popular',
        })
      : Promise.resolve(null),
    fromExplore ? Promise.resolve([]) : getRelatedProjects(project.id, project.category, 1),
    getProjectAuthorSummary(project.author_id, project.author),
  ])

  const {
    comments: initialComments,
    total: totalComments,
    hasMore: hasMoreComments,
    likedCommentIds: initialLikedCommentIds,
  } = commentsData

  const materials = project.materials ?? []
  const steps = project.steps ?? []
  const tags = project.tags ?? []
  const isObservationProject = tags.includes('鸟类')
  const projectSummary = project.description || '一个适合边做边学、逐步完成的实践项目。'
  const continuationProject = nextProject && Number(nextProject.id) !== Number(project.id)
    ? nextProject
    : (!fromExplore ? relatedProjects[0] ?? null : null)
  const continuationHref = continuationProject
    ? buildProjectHref(
        continuationProject.id,
        resolvedSearchParams,
        fromExplore && sourceIndex !== null ? sourceIndex + 1 : undefined,
      )
    : exploreBackHref
  const categoryTone = getCategoryTone(project.category)
  const visibleTags = tags
    .filter((tag) => tag !== project.category && tag !== project.sub_category)
    .slice(0, 4)
  const difficultyLabel = getDifficultyLabel(project.difficulty_stars)
  const mode = isObservationProject ? 'observation' : 'project'
  const showcaseCount = Math.max(completionCount, completions.length)

  return (
    <div className="relative overflow-x-hidden bg-[hsl(var(--app-canvas))]">
      <ProjectDetailScrollTop />
      <ProjectDetailStickyBar
        title={project.title}
        projectId={project.id}
        mode={mode}
      />
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_16%_0%,hsl(var(--brand-blue)/0.18),transparent_38%),radial-gradient(circle_at_85%_10%,hsl(var(--brand-green)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--app-canvas))_0%,transparent_100%)]" />
      <div className="mx-auto w-full max-w-[1840px] px-4 pb-36 pt-4 md:px-8 md:pb-14 md:pt-6">
        <MobilePageHeader
          title="项目详情"
          fallbackHref={exploreBackHref}
          className="-mx-4 -mt-4 mb-4 md:hidden"
          titleClassName="text-center text-lg"
          rightSlot={
            <ProjectDetailActions
              projectId={project.id}
              projectTitle={project.title}
              mode={mode}
              variant="header"
            />
          }
        />

        <div className="mb-5 hidden md:block">
          <Link
            href={exploreBackHref}
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
                <Link href={`/project?edit=${project.id}`}>
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

        <section className="-mx-4 -mt-4 overflow-hidden md:hidden">
          <div className="relative h-[31vh] min-h-[210px] max-h-[280px] overflow-hidden bg-muted">
            <OptimizedImage
              src={project.image}
              alt={project.title}
              fill
              variant="cover"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/36 to-black/4 dark:from-black/95 dark:via-black/55 dark:to-black/8" />
            <div className="absolute inset-x-0 bottom-0 space-y-3 px-4 pb-4 text-white">
              <div className="flex flex-wrap items-center gap-2">
                {project.category ? (
                  <span className="rounded-[8px] bg-black/36 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
                    {project.category}
                  </span>
                ) : null}
                {project.sub_category ? (
                  <span className="rounded-[8px] bg-black/30 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
                    {project.sub_category}
                  </span>
                ) : null}
                <span className="ml-auto inline-flex items-center gap-1 rounded-[8px] bg-black/42 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
                  <DifficultyStars stars={project.difficulty_stars ?? 1} size="sm" />
                  {difficultyLabel}
                </span>
              </div>
              <h1 className="font-sans text-2xl font-bold leading-tight tracking-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.86),0_0_2px_rgba(0,0,0,0.7)]">
                {project.title}
              </h1>
            </div>
          </div>
          <div className="space-y-3 bg-[hsl(var(--app-canvas))] px-4 pb-4 pt-3">
            <ProjectAuthorCard author={authorSummary} compact />
            <div className="space-y-2">
              <p className="line-clamp-2 text-[15px] leading-6 text-muted-foreground">
                {projectSummary}
              </p>
              {visibleTags.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {visibleTags.map((tag) => (
                    <span
                      key={tag}
                      className="shrink-0 rounded-[8px] bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="rounded-[12px] border border-border/60 bg-muted/24 px-1 py-2.5">
              <div className="grid grid-cols-4 divide-x divide-border/50">
                <HeroStat
                  icon={<ListChecks className="h-4 w-4" />}
                  value={String(steps.length || '-')}
                  label="步骤"
                />
                <HeroStat
                  icon={<Box className="h-4 w-4" />}
                  value={String(materials.length || '-')}
                  label="材料"
                />
                <HeroStat
                  icon={<UsersRound className="h-4 w-4" />}
                  value={formatCount(showcaseCount)}
                  label="完成"
                />
                <HeroStat
                  icon={<CoinIcon className="h-4 w-4" />}
                  value={formatCount(projectCoinsReceived)}
                  label="投币"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <main className="min-w-0 space-y-6">
            <section className="surface-panel hidden overflow-hidden rounded-[18px] md:block">
              <div className="lg:flex lg:items-stretch">
                <div className="relative min-w-0 overflow-hidden bg-muted aspect-[16/9] sm:aspect-[16/8.6] lg:aspect-auto lg:h-auto lg:min-h-[318px] lg:w-[42%] lg:max-w-[540px] lg:flex-none">
                  <OptimizedImage
                    src={project.image}
                    alt={project.title}
                    fill
                    variant="cover"
                    className="object-cover"
                    priority
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between p-5 sm:p-6 lg:p-8">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start gap-2">
                      <h1 className="basis-full font-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        {project.title}
                      </h1>
                      {project.category ? (
                        <ToneBadge tone={categoryTone} className="mt-1 rounded-[8px] px-3 py-1 text-xs">
                          {project.category}
                        </ToneBadge>
                      ) : null}
                      {project.sub_category ? (
                        <span className="mt-1 inline-flex rounded-[8px] bg-[hsl(var(--brand-blue)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--brand-blue))]">
                          {project.sub_category}
                        </span>
                      ) : null}
                      <span className="ml-auto mt-1 inline-flex items-center gap-1.5 rounded-[8px] bg-[hsl(var(--tone-tech-soft))] px-3 py-1 text-xs font-semibold text-[hsl(var(--tone-tech))]">
                        <DifficultyStars stars={project.difficulty_stars ?? 1} size="sm" />
                        {difficultyLabel}
                      </span>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                      <p className="max-w-4xl text-[15px] leading-7 text-muted-foreground">
                        {projectSummary}
                      </p>
                      <div className="flex justify-start md:justify-end">
                        <ProjectHeroActions
                          projectId={project.id}
                          likes={project.likes}
                          collections={collectionsCount}
                        />
                      </div>
                    </div>

                    {visibleTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {visibleTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex rounded-[8px] bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 grid grid-cols-4 border-t border-border/70 pt-5">
                    <HeroStat
                      icon={<ListChecks className="h-5 w-5" />}
                      value={String(steps.length || '-')}
                      label="个步骤"
                    />
                    <HeroStat
                      icon={<Box className="h-5 w-5" />}
                      value={String(materials.length || '-')}
                      label="种材料"
                    />
                    <HeroStat
                      icon={<UsersRound className="h-5 w-5" />}
                      value={formatCount(showcaseCount)}
                      label="人完成"
                    />
                    <HeroStat
                      icon={<CoinIcon className="h-5 w-5" />}
                      value={formatCount(projectCoinsReceived)}
                      label="投币"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="flex items-start gap-3 rounded-[10px] border border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--brand-blue)/0.045)] px-3 py-2.5 text-sm shadow-sm shadow-[hsl(var(--surface-shadow)/0.025)] sm:px-5 sm:py-4">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))] sm:h-7 sm:w-7">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">安全提醒</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:mt-1 sm:text-sm sm:leading-6">
                  制作或观察时请确认环境安全，必要时在成人或老师陪同下完成。
                </p>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-start xl:grid-cols-[minmax(0,1.16fr)_minmax(360px,0.84fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
              <div className="min-w-0 space-y-6">
                <div id="project-materials" className="scroll-mt-24 lg:scroll-mt-28">
                  <SectionCard title={`所需材料${materials.length > 0 ? `（${materials.length}）` : ''}`}>
                    <MaterialsList materials={materials} compact />
                  </SectionCard>
                </div>

                <div id="project-steps" className="scroll-mt-24 lg:scroll-mt-28">
                  <SectionCard title={`制作步骤${steps.length > 0 ? `（共 ${steps.length} 步）` : ''}`}>
                    {steps.length > 0 ? (
                      <ol className="space-y-3">
                        {steps.map((step, index) => (
                          <StepItem
                            key={`${step.title || 'step'}-${index}`}
                            step={step}
                            index={index}
                            isLast={index === steps.length - 1}
                          />
                        ))}
                      </ol>
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-border bg-background/50 px-5 py-10 text-center text-sm text-muted-foreground">
                        暂无步骤说明
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>

              <aside className="hidden min-w-0 space-y-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block">
                <div className="hidden lg:block">
                  <ProjectAuthorCard author={authorSummary} />
                </div>

                <section
                  id="project-showcase"
                  className="surface-panel overflow-hidden rounded-[18px] px-5 py-5 sm:px-6"
                >
                  <ProjectShowcase
                    completions={completions}
                    projectId={project.id}
                    projectTitle={project.title}
                    title="作品展示"
                    totalCount={showcaseCount}
                    emptyActionSlot={
                      <CompletionCTA
                        projectId={project.id}
                        projectTitle={project.title}
                        challengeId={project.challenge_id}
                        mode={mode}
                        variant="inline"
                      />
                    }
                  />
                </section>

                {showcaseCount > 0 ? (
                  <CompletionCTA
                    projectId={project.id}
                    projectTitle={project.title}
                    challengeId={project.challenge_id}
                    mode={mode}
                  />
                ) : null}

                {(continuationProject || fromExplore) ? (
                  <div className="hidden lg:block">
                    <ProjectContinuationCard
                      kind={continuationProject ? (fromExplore ? 'next' : 'related') : 'back'}
                      href={continuationHref}
                      project={continuationProject}
                      compact
                    />
                  </div>
                ) : null}

                {project.challenge_id ? (
                  <section className="surface-panel flex flex-col gap-4 rounded-[18px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch">
                    <div className="min-w-0">
                      <p className="font-sans text-base font-bold text-foreground">相关挑战</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        这个项目可作为挑战作品的参考实践。
                      </p>
                    </div>
                    <Button asChild variant="outline" className="h-9 shrink-0 rounded-[8px]">
                      <Link href={`/community/challenge/${project.challenge_id}`}>查看挑战</Link>
                    </Button>
                  </section>
                ) : null}
              </aside>

              <section id="project-comments-desktop" className="surface-panel hidden scroll-mt-24 overflow-hidden rounded-[18px] px-4 pb-5 sm:px-6 lg:col-start-1 lg:row-start-2 lg:block">
                <ProjectComments
                  projectId={project.id}
                  initialComments={initialComments}
                  initialTotal={totalComments}
                  initialHasMore={hasMoreComments}
                  initialLikedCommentIds={initialLikedCommentIds}
                  commentBoxId="project-comment-box-desktop"
                  actionsSlot={
                    <ProjectInteractions
                      projectId={project.id}
                      projectTitle={project.title}
                      likes={project.likes}
                      projectOwnerId={project.author_id}
                      projectCoinsReceived={projectCoinsReceived}
                    />
                  }
                />
              </section>
            </div>

            <MobileProjectCommunityTabs
              projectId={project.id}
              projectTitle={project.title}
              projectOwnerId={project.author_id}
              challengeId={project.challenge_id}
              mode={mode}
              likes={project.likes}
              completions={completions}
              showcaseCount={showcaseCount}
              projectCoinsReceived={projectCoinsReceived}
              collectionsCount={collectionsCount}
              comments={initialComments}
              totalComments={totalComments}
              hasMoreComments={hasMoreComments}
              likedCommentIds={initialLikedCommentIds}
            />

            {(continuationProject || fromExplore) ? (
              <div className="lg:hidden">
                <ProjectContinuationCard
                  kind={continuationProject ? (fromExplore ? 'next' : 'related') : 'back'}
                  href={continuationHref}
                  project={continuationProject}
                />
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  )
}
