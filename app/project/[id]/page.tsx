import { getProjectKitMatches } from '@/lib/kits/service'
import { ProjectKitMatches } from '@/components/kits/project-kit-matches'
import TextbookFrame from '@/components/features/textbook3d/textbook-frame'
import { getTextbook3dLesson, textbook3dSrc } from '@/lib/textbook3d/registry'
import { getScienceSampleForProject } from '@/lib/project/science-samples'
import { effectiveUpdatedAt } from '@/lib/project/effective-updated-at'
import { ScienceProjectNotes, ScienceProjectSafety } from '@/components/features/project/science-project-notes'
import type { ReactNode } from 'react'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  AlertTriangle,
  Box,
  ChevronDown,
  Edit,
  ListChecks,
  UsersRound,
} from 'lucide-react'

import { CoinIcon } from '@/components/icons/coin-icon'
import { ProjectInteractions } from '@/components/features/project-interactions'
import { MobileProjectAuthorRow } from '@/components/features/project/mobile-project-author-row'
import { MobileProjectIntro } from '@/components/features/project/mobile-project-intro'
import { MobileProjectMetaChips } from '@/components/features/project/mobile-project-meta-chips'
import { MobileProjectSteps } from '@/components/features/project/mobile-project-steps'
import { ProjectExplorationRecordsBlock } from '@/components/features/project/project-exploration-records'
import { CompletionCTA } from '@/components/features/project/completion-cta'
import { ExploreAwareContinuationCard, ExploreAwareMobileRelated, ExploreBackLink } from '@/components/features/project/explore-project-context'
import { ProjectCourseLink } from '@/components/features/project/project-course-link'
import { ContextualStoreProducts } from '@/components/store/contextual-store-products'
import { ProjectDetailActions } from '@/components/features/project/project-detail-actions'
import { UserAvatar } from '@/components/ui/user-avatar'
import { ProjectDetailScrollTop } from '@/components/features/project/project-detail-scroll-top'
import { ProjectDetailStickyBar } from '@/components/features/project/project-detail-sticky-bar'
import { ProjectDetailMobileHeader } from '@/components/features/project/project-detail-mobile-header'
import { ProjectSectionNav } from '@/components/features/project/project-section-nav'
import { ProjectHeroGallery } from '@/components/features/project/project-hero-gallery'
import { ProjectDemoVideo } from '@/components/features/project/project-demo-video'
import { getProjectVideoPresentationPilot } from '@/lib/project/video-presentation-pilot'
import { LedCardExtension } from '@/components/features/project/led-card-extension'
import { ProjectStepCopy } from '@/components/features/project/project-step-copy'
import { ProjectFaq } from '@/components/features/project/project-faq'
import { ProjectStepImage } from '@/components/features/project/project-step-image'
import { FollowButton } from '@/components/features/social/follow-button'
import { Button } from '@/components/ui/button'
import { ContentClassification } from '@/components/ui/content-classification'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { JsonLd } from '@/components/seo/json-ld'
import { toPublicImageUrl } from '@/lib/seo/public-image'
import { DEFAULT_SOCIAL_IMAGE } from '@/lib/seo/metadata'
import { buildProjectCiteDescription, buildProjectCiteKeywords } from '@/lib/seo/project-citability'
import {
  buildProjectOverviewText,
  buildProjectSeoDescription,
  isPlaceholderProjectDescription,
} from '@/lib/seo/project-description'
import { buildSegmentTitle } from '@/lib/seo/title'
import { toExploreContextProject } from '@/lib/explore/project-navigation-context'
import { resolveProjectMaterials } from '@/lib/project/materials'
import { ToneBadge, type CategoryTone } from '@/components/ui/tone-badge'
import { CATEGORY_META } from '@/lib/config/categories'
import {
  getProjectById,
  getProjectCompletions,
  getProjectCompletionsCount,
  getProjectCollectionsCount,
  getRelatedProjects,
  getProjectTotalCoinsReceived,
} from '@/lib/api/explore-data'
import { getCourseLessonByWorksProjectId } from '@/lib/api/courses'
import { listStoreProductsForContext } from '@/lib/store/service'
import { collectHeroGalleryImages } from '@/lib/project/hero-gallery'
import { getMaterialMeta } from '@/lib/project/material-meta'
import {
  formatProjectDescriptionForDisplay,
  formatProjectReflectionForDisplay,
  formatProjectStepDescriptionForDisplay,
  mergeBrokenParenMaterials,
  shouldShowProjectReflection,
} from '@/lib/project/presentation'
import { displayProjectTags } from '@/lib/project/tags'
import { resolveProjectVideoPlaybackSrc } from '@/lib/project/video-url'
import { createClient } from '@/lib/supabase/server'
import { buildProjectJsonLd, validProjectDate } from '@/lib/seo/json-ld'
import { cn } from '@/lib/utils'
import { BRAND_FULL_NAME } from '@/lib/brand'
import type { ProjectStep } from '@/lib/mappers/types'

interface ProjectDetailPageProps {
  searchParams?: Promise<{kit?: string}>
  params: Promise<{ id: string }>
}

// Explore filters / list position used to travel in the URL (`?from=explore&sourceIndex=…&q=…`).
// They now live in sessionStorage (lib/explore/project-navigation-context.ts) so every
// internal project link is the bare canonical `/project/:id`.
const EXPLORE_HREF = '/explore'

function canAccessProject(
  project: Awaited<ReturnType<typeof getProjectById>>,
  viewer?: { id?: string; isStaff?: boolean },
) {
  if (!project) return false
  if ((!project.status || project.status === 'approved') && project.moderation_state === 'approved') return true
  return viewer?.id === project.author_id || viewer?.isStaff === true
}

async function getProjectViewerAccess(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { id: undefined, isStaff: false }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    isStaff: profile?.role === 'admin' || profile?.role === 'moderator',
  }
}

function getCategoryTone(category?: string): CategoryTone {
  return CATEGORY_META[category || '']?.tone ?? 'science'
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
  avatarFrameId?: string | null
  level: number
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
  const profileResponse = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, equipped_avatar_frame_id, xp')
    .eq('id', authorId)
    .maybeSingle()

  const profile = profileResponse.data as {
    id: string
    display_name?: string | null
    avatar_url?: string | null
    equipped_avatar_frame_id?: string | null
    xp?: number | null
  } | null

  if (!profile && !fallbackName) return null

  return {
    id: authorId,
    name: profile?.display_name || fallbackName || '项目作者',
    avatarUrl: profile?.avatar_url,
    avatarFrameId: profile?.equipped_avatar_frame_id,
    level: getLevelFromXp(profile?.xp),
  }
}

function ProjectCiteTakeaway({
  category,
  reflection,
  description,
  className,
}: {
  category?: string | null
  reflection?: string | null
  description?: string | null
  className?: string
}) {
  const conclusion = formatProjectReflectionForDisplay(reflection)
  if (!shouldShowProjectReflection(conclusion, description)) return null

  const heading = category === '科学' ? '实验总结' : '项目总结'

  return (
    <section className={className}>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <h2 className="font-sans text-base font-bold tracking-tight md:text-xl">{heading}</h2>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-foreground md:text-base">{conclusion}</p>
      </details>
    </section>
  )
}

function MaterialsList({ materials, preparationNotes = [], kitLinks = [], kitMaterialName }: { materials: string[]; preparationNotes?: string[]; kitLinks?: { name: string; href: string }[]; kitMaterialName?: string }) {
  return (
    <>
      {materials.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无材料清单，请参考步骤中的准备说明。</p>
      ) : (
        <ul className="grid list-none gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {materials.map((material, index) => {
            const meta = getMaterialMeta(material)
            const showNote = Boolean(meta.note) && !meta.name.startsWith('自备：')
            return (
              <li key={`${material}-${index}`} className="flex min-w-0 items-start gap-3 py-1">
                <Box className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-6 wrap-anywhere">{kitLinks.length === 1 && kitMaterialName === meta.name ? <Link href={kitLinks[0].href} className="text-primary underline underline-offset-4">{meta.name}</Link> : meta.name}</p>
                  {kitLinks.length > 1 && kitMaterialName === meta.name ? <div className="mt-1 flex flex-col gap-1">{kitLinks.map(link => <Link key={link.href} href={link.href} className="text-sm text-primary underline underline-offset-4">{link.name}</Link>)}</div> : null}
                  {showNote && !(kitLinks.length && kitMaterialName === meta.name) ? <p className="text-sm leading-6 text-muted-foreground wrap-anywhere">{meta.note}</p> : null}
                </div>
                {meta.amount ? <span className="shrink-0 pt-0.5 text-sm leading-6 text-muted-foreground">{meta.amount}</span> : null}
              </li>
            )
          })}
        </ul>
      )}
      {preparationNotes.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-4">
          <h3 className="mb-1 text-sm font-medium">准备要求</h3>
          {preparationNotes.map((note) => <p key={note} className="text-sm leading-6 text-muted-foreground">{note}</p>)}
        </div>
      )}
    </>
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
    <section className="surface-panel overflow-hidden rounded-lg">
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

function MobileSectionCard({
  title,
  action,
  children,
  className,
  id,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn("scroll-mt-32 rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-base font-bold tracking-tight text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function MobileBottomProjectBar({
  projectId,
  projectTitle,
  mode,
  practicePending = false, viewingGuide = false,
  collections,
  projectAuthor,
  projectImage,
  projectCategory,
}: {
  projectId: string | number
  projectTitle: string
  mode: 'project' | 'observation'
  viewingGuide?: boolean; practicePending?: boolean
  collections: number
  projectAuthor: string
  projectImage: string
  projectCategory: string
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--surface-border)/0.86)] bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_44px_-34px_rgba(15,23,42,0.46)] md:hidden">
      <ProjectDetailActions practicePending={practicePending} viewingGuide={viewingGuide}
        projectId={projectId}
        projectTitle={projectTitle}
        mode={mode}
        variant="bottom"
        collections={collections}
        projectAuthor={projectAuthor}
        projectImage={projectImage}
        projectCategory={projectCategory}
      />
    </div>
  )
}

function ProjectAuthorCard({ author }: { author: ProjectAuthorSummary | null }) {
  if (!author) return null

  return (
    <div className="flex items-center justify-between gap-3">
      <Link href={`/users/${author.id}`} className="flex min-h-11 min-w-0 items-center gap-3 rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
        <UserAvatar
          userId={author.id}
          name={author.name}
          src={author.avatarUrl}
          avatarFrameId={author.avatarFrameId}
          href={null}
          className="h-10 w-10 bg-muted"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{author.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">项目作者 · LV{author.level}</p>
        </div>
      </Link>
      <FollowButton targetUserId={author.id} variant="outline" showIcon={false} className="min-h-11 shrink-0 px-3" />
    </div>
  )
}

function StepItem({ step, index, viewingGuide = false }: { step: ProjectStep; index: number; viewingGuide?: boolean }) {
  const stepTitle = step.title || `${viewingGuide ? "观看要点" : "步骤"} ${index + 1}`

  return (
    <li id={`project-step-${index + 1}`} className="scroll-mt-36 py-6 first:pt-0 last:pb-0">
      <article className="min-w-0">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-blue)/0.1)] text-sm font-bold text-[hsl(var(--brand-blue))]">
            {index + 1}
          </span>
          <h3 className="min-w-0 pt-0.5 text-lg font-semibold leading-7 wrap-anywhere">{stepTitle}</h3>
        </div>
        <div className={cn("min-w-0", step.image_url && "grid items-start gap-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]")}>
          {step.image_url ? (
            <ProjectStepImage
              src={step.image_url}
              alt={stepTitle}
              sizes="(max-width: 1023px) 40vw, (max-width: 1535px) 28vw, 480px"
            />
          ) : null}
          <ProjectStepCopy step={step} className="whitespace-pre-line text-base leading-7 text-foreground/85 wrap-anywhere" />
        </div>
      </article>
    </li>
  )
}

export async function generateMetadata(
  { params }: ProjectDetailPageProps,
): Promise<Metadata> {
  const { id } = await params
  const numericId = Number(id)
  const project =
    Number.isInteger(numericId) && numericId > 0 ? await getProjectById(numericId) : null
  if (!project) {
    return {
      title: '项目未找到',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const supabase = await createClient()
  const viewer = await getProjectViewerAccess(supabase)
  if (!canAccessProject(project, viewer)) {
    return {
      title: '项目未找到',
      robots: {
        index: false,
        follow: false,
      },
    }
  }
  const citeDescription = buildProjectCiteDescription({
    title: project.title,
    description: isPlaceholderProjectDescription(project.description, project.title) ? '' : project.description,
    category: project.category,
    classification: project.classification,
    reflection: project.reflection,
  })
  const videoPilot = getProjectVideoPresentationPilot(project)
  const description = videoPilot?.summary || buildProjectSeoDescription({
    citeDescription,
    title: project.title,
    description: project.description,
    category: project.category,
    subCategory: project.sub_category,
    classification: project.classification,
    tags: project.tags,
    materials: mergeBrokenParenMaterials(project.materials ?? []),
    steps: project.steps,
    hasVideo: Boolean(resolveProjectVideoPlaybackSrc({
      videoUrl: project.videoUrl,
      description: project.description,
      steps: project.steps ?? [],
    })),
  }) || `${BRAND_FULL_NAME}上的实践项目详情页。`
  const socialImage = toPublicImageUrl(project.image) || toPublicImageUrl(DEFAULT_SOCIAL_IMAGE)!
  // Normalised numeric id (never the raw segment / query): `/project/0348` canonicalises to `/project/348`.
  const canonicalPath = `/project/${numericId}`
  const keywords = buildProjectCiteKeywords({
    title: project.title,
    category: project.category,
    subCategory: project.sub_category,
    tags: project.tags,
  })

  return {
    title: buildSegmentTitle(project.title),
    description,
    keywords,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: project.title,
      description,
      url: canonicalPath,
      siteName: BRAND_FULL_NAME,
      images: [{
        url: socialImage,
        ...(project.image ? {} : { width: 1200, height: 630 }),
        alt: project.title,
      }],
      type: 'article',
      ...(project.author ? { authors: [project.author] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description,
      images: [socialImage],
    },
    ...(project.status !== 'approved'
      ? {
          robots: {
            index: false,
            follow: false,
          },
        }
      : {}),
  }
}

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) {
    notFound()
  }

  const supabase = await createClient()
  const legacyCourseLink = await getCourseLessonByWorksProjectId(supabase, numericId)
  if (legacyCourseLink) {
    redirect(`/courses/${legacyCourseLink.courseId}/lessons/${legacyCourseLink.lessonId}?view=works`)
  }

  const project = await getProjectById(numericId)
  if (!project) {
    notFound()
  }

  const viewer = await getProjectViewerAccess(supabase)
  const isAuthor = viewer.id === project.author_id

  if (!canAccessProject(project, viewer)) {
    notFound()
  }

  const exploreBackHref = EXPLORE_HREF

  const showStatusAlert = isAuthor && (project.status === 'pending' || project.status === 'rejected')

  const [
    completions,
    completionCount,
    projectCoinsReceived,
    collectionsCount,
    relatedProjects,
    authorSummary,
    courseLessonRef,
    contextualStoreProducts,
  ] = await Promise.all([
    getProjectCompletions(project.id, 8, { onePerUser: true }),
    getProjectCompletionsCount(project.id),
    getProjectTotalCoinsReceived(project.id, project.coins_count ?? 0),
    getProjectCollectionsCount(project.id),
    getRelatedProjects(project.id, project.category, 1),
    getProjectAuthorSummary(project.author_id, project.author),
    Promise.resolve(null as Awaited<ReturnType<typeof getCourseLessonByWorksProjectId>>),
    listStoreProductsForContext(supabase, `project:${project.id}`),
  ])

  const kitMatches = await getProjectKitMatches(project, (await searchParams)?.kit)
  const materialKitLinks = kitMatches.flatMap(match => match.linkedOffers.map(offer => ({
    name: match.kit.name,
    href: `/store/products/${offer.productId}?variant=${offer.id}`,
  })))
  const videoPilot = getProjectVideoPresentationPilot(project)
  const textbook3d = project.textbook3dLessonId ? getTextbook3dLesson(project.textbook3dLessonId) : null
  const scienceSample = getScienceSampleForProject(project)
  const isSciencePracticePending = scienceSample?.mode === 'preparation'
  const isScienceViewingGuide = scienceSample?.mode === 'observation'
  const usesScienceGuideOrAlternative = isSciencePracticePending || isScienceViewingGuide || scienceSample?.sourceRelation === 'alternative'
  const rawSteps = project.steps ?? []
  const videoPlaybackSrc = resolveProjectVideoPlaybackSrc({
    videoUrl: project.videoUrl,
    description: project.description,
    steps: rawSteps,
  })
  const hasVideoPlayer = Boolean(videoPlaybackSrc)
  const { materials, preparationNotes } = resolveProjectMaterials(project)
  const purchasableKits = contextualStoreProducts.filter((product) => product.external_url)
  const onlyMaterial = materials.length === 1 ? getMaterialMeta(materials[0]) : null
  // Only consolidate the imported placeholder when the linked kit is unambiguous.
  const showSingleMobileKit = !materialKitLinks.length && !usesScienceGuideOrAlternative && purchasableKits.length === 1
    && onlyMaterial?.name === `《${project.title}》对应实验材料包`
    && (!onlyMaterial.note || onlyMaterial.note === '需自行购买')

  const steps = (videoPilot ? [] : rawSteps).map((step) => ({
    ...step,
    description: formatProjectStepDescriptionForDisplay(step.description, { hasVideoPlayer }),
  }))
  const tags = project.tags ?? []
  const isObservationProject = tags.includes('鸟类')
  // Deterministic intro assembled from this project's own fields (never invented copy).
  const projectOverview = buildProjectOverviewText({
    title: project.title,
    description: project.description,
    category: project.category,
    subCategory: project.sub_category,
    classification: project.classification,
    tags,
    materials,
    steps: videoPilot ? [] : rawSteps,
    hasVideo: hasVideoPlayer,
  })
  const summaryIsPlaceholder = isPlaceholderProjectDescription(project.description, project.title)
  const projectSummary = videoPilot?.summary || (summaryIsPlaceholder
    ? projectOverview
    : formatProjectDescriptionForDisplay(project.description, { hasVideoPlayer }) || projectOverview)
  const relatedProject = relatedProjects.find((item) => Number(item.id) !== Number(project.id)) ?? null
  const continuationProject = relatedProject ? toExploreContextProject(relatedProject) : null
  const continuationHref = continuationProject ? `/project/${continuationProject.id}` : exploreBackHref
  const categoryTone = getCategoryTone(project.category)
  const visibleTags = displayProjectTags(tags)
    .filter((tag) => tag !== project.category && tag !== project.sub_category)
    .slice(0, 4)
  const mode = isObservationProject ? 'observation' : 'project'
  const completedCount = completionCount
  const chip2Label = project.sub_category ?? visibleTags[0] ?? null
  const introTags = project.sub_category ? visibleTags : visibleTags.slice(1)
  const heroGallery = collectHeroGalleryImages(project.image, steps, {
    coverCaption: Number(project.id) === 149 ? 'AI 生成的成品示意图；制作方法见步骤。' : project.title,
  }).slice(0, 1)
  const createdAt = validProjectDate(project.createdAt)
  const updatedAt = effectiveUpdatedAt(project)
  const dateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai" })
  const heroImages = heroGallery.map((item) => item.url)
  const heroCaptions = heroGallery.map((item) => item.caption)
  const materialsTitle = videoPilot ? '准备材料' : `${isScienceViewingGuide ? '观看准备' : '所需材料'}${materials.length ? `（${materials.length}）` : ''}`
  const tutorialContent = videoPilot && videoPlaybackSrc ? (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{videoPilot.durationLabel}</p>
      <p className="mb-4 text-sm leading-6"><strong>关键提醒：</strong>{videoPilot.reminder}</p>
      <ProjectDemoVideo key={videoPlaybackSrc} src={videoPlaybackSrc} title={project.title} poster={project.image} videoLabel="制作视频" chapters={videoPilot.chapters} />
    </>
  ) : null

  return (
    <div className="relative overflow-x-clip bg-[hsl(var(--app-canvas))]">
      <JsonLd
        data={buildProjectJsonLd({
          id: project.id,
          title: project.title,
          description: projectSummary,
          image: project.image,
          classification: project.classification,
          materials,
          steps,
          reflection: project.reflection,
          faq: scienceSample?.faq ?? project.faq,
          mode: scienceSample?.mode,
          author: authorSummary?.name || project.author,
          authorId: authorSummary?.id || project.author_id,
          dateCreated: createdAt,
          dateModified: updatedAt,
        })}
      />
      <ProjectDetailScrollTop />
      <ProjectDetailStickyBar practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide}
        videoTutorial={Boolean(videoPilot)}
        key={`sticky-${project.id}`}
        title={project.title}
        projectId={project.id}
        mode={mode}
        projectAuthor={project.author}
        projectImage={project.image}
        projectCategory={project.category}
      />
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_16%_0%,hsl(var(--brand-blue)/0.18),transparent_38%),radial-gradient(circle_at_85%_10%,hsl(var(--brand-green)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--app-canvas))_0%,transparent_100%)]" />
      <div className="app-shell-wide pb-[calc(6rem+env(safe-area-inset-bottom))] pt-0 md:px-8 md:pb-14 md:pt-6">
        <div className="mb-5 hidden md:block">
          <ExploreBackLink
            projectId={project.id}
            fallbackHref={exploreBackHref}
            className="hidden items-center text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
          >
            返回探索
          </ExploreBackLink>
        </div>

          <ProjectDetailMobileHeader practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide}
            videoTutorial={Boolean(videoPilot)}
            key={`header-${project.id}`}
            title={project.title}
            projectId={project.id}
            backHref={exploreBackHref}
            actions={
              <ProjectDetailActions practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide}
                projectId={project.id}
                projectTitle={project.title}
                mode={mode}
                variant="cover"
                likes={project.likes}
                projectOwnerId={project.author_id}
                projectCoinsReceived={projectCoinsReceived}
                projectAuthor={project.author}
                projectImage={project.image}
                projectCategory={project.category}
              />
            }
          />

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
                <div className="rounded-xs bg-red-100 p-3 text-sm dark:bg-red-900/30">
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

        <div className="-mx-4 md:hidden">
          <section id="project-hero-mobile" className="overflow-hidden rounded-b-lg bg-[hsl(var(--surface-raised))]">
            <ProjectHeroGallery
              key={`mobile-${project.id}`}
              images={heroImages}
              captions={heroCaptions}
              alt={project.title}
              videoSrc={videoPilot ? null : videoPlaybackSrc}
              videoPoster={project.image || null}
              className={hasVideoPlayer ? 'aspect-video' : 'aspect-4/3 max-h-[360px]'}
              sizes="100vw"
            />
            <div className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="min-w-0 flex-1 basis-40 font-sans text-[26px] font-bold leading-tight tracking-tight text-foreground wrap-anywhere">{project.title}</h1>
                <ProjectDetailActions practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide}
                  projectId={project.id}
                  projectTitle={project.title}
                  mode={mode}
                  variant="support"
                  likes={project.likes}
                  projectOwnerId={project.author_id}
                  projectCoinsReceived={projectCoinsReceived}
                  className="ml-auto"
                />
              </div>
              <MobileProjectMetaChips practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide}
                category={project.category}
                categoryTone={categoryTone}
                topicLabel={chip2Label}
                stepsCount={steps.length}
                materialsCount={videoPilot ? 0 : materials.length}
                classification={project.classification}
              />
              <MobileProjectIntro key={project.id} summary={projectSummary} tags={introTags} embedded />
              {Number(project.id) === 149 ? <p className="text-xs leading-5 text-muted-foreground">封面及过程配图为 AI 生成示意图，制作方法见步骤。</p> : null}
              <MobileProjectAuthorRow
                author={authorSummary}
              />
            </div>
          </section>
          <div className="space-y-4 px-4 pt-4">
            {courseLessonRef ? (
              <ProjectCourseLink courseId={courseLessonRef.courseId} lessonId={courseLessonRef.lessonId} courseTitle={courseLessonRef.courseTitle} lessonTitle={courseLessonRef.lessonTitle} />
            ) : null}
            <MobileSectionCard id="project-materials-mobile" title={materialsTitle}>
              {showSingleMobileKit ? (
                <ContextualStoreProducts products={purchasableKits} contextLabel="这个项目的" idSuffix="mobile" embedded materialAmount={onlyMaterial?.amount ?? ''} />
              ) : (
                <>
                  <MaterialsList materials={materials} preparationNotes={preparationNotes} kitLinks={materialKitLinks} kitMaterialName={`《${project.title}》对应实验材料包`} />
                  <ProjectKitMatches matches={onlyMaterial?.name === `《${project.title}》对应实验材料包` && materialKitLinks.length ? [] : kitMatches} />
                  {videoPilot ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{videoPilot.materialsNote}</p> : null}
                  {!usesScienceGuideOrAlternative ? <ContextualStoreProducts products={contextualStoreProducts} contextLabel="这个项目的" idSuffix="mobile" embedded /> : null}
                </>
              )}
            </MobileSectionCard>
            {scienceSample ? <ScienceProjectSafety sample={scienceSample} /> : null}
            {textbook3d ? (
              <MobileSectionCard id="project-textbook-mobile" title="3D 课本">
                <TextbookFrame lessonId={textbook3d.id} src={textbook3dSrc(textbook3d.id)} title={`3D 课本：${textbook3d.title}`} />
              </MobileSectionCard>
            ) : null}
            {videoPilot ? (
              <MobileSectionCard id="project-steps-mobile" title="制作视频">{tutorialContent}</MobileSectionCard>
            ) : <MobileProjectSteps projectId={project.id} key={project.id} steps={steps} practicePending={isSciencePracticePending} observationOnly={isScienceViewingGuide} />}
            {scienceSample ? <ScienceProjectNotes sample={scienceSample} /> : Number(project.id) === 149 ? (
              <LedCardExtension className="rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-3" />
            ) : (
              <ProjectCiteTakeaway
              category={project.category}
              reflection={project.reflection}
              description={projectSummary}
              className="rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-3"
            />
            )}
            {!usesScienceGuideOrAlternative && project.faq?.length ? (
              <MobileSectionCard id="project-faq-mobile" title={Number(project.id) === 149 ? "故障排查" : "常见问题"}>
                <ProjectFaq items={project.faq} projectId={project.id} />
              </MobileSectionCard>
            ) : null}
            <MobileSectionCard id="project-exploration-records-mobile" title="探索记录">
              <ProjectExplorationRecordsBlock practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide} projectId={project.id} completions={completions} />
            </MobileSectionCard>
            <ExploreAwareMobileRelated
              projectId={project.id}
              fallbackProject={continuationProject}
              fallbackHref={continuationHref}
              fallbackExploreHref={exploreBackHref}
              currentMinAge={project.classification?.recommendedMinAge ?? null}
            />
          </div>
          <MobileBottomProjectBar practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide}
            projectId={project.id}
            projectTitle={project.title}
            mode={mode}
            collections={collectionsCount}
            projectAuthor={project.author}
            projectImage={project.image}
            projectCategory={project.category}
          />
        </div>

        <div className="hidden min-w-0 space-y-6 md:block">
          <section id="project-hero-desktop" className="surface-panel overflow-hidden rounded-lg">
            <div className="lg:flex lg:items-stretch">
              <ProjectHeroGallery
                key={`desktop-${project.id}`}
                images={heroImages}
                captions={heroCaptions}
                alt={project.title}
                videoSrc={videoPilot ? null : videoPlaybackSrc}
                videoPoster={project.image || null}
                className="aspect-video lg:aspect-auto lg:min-h-[320px] lg:w-[42%] lg:max-w-[600px] lg:flex-none"
                sizes="(min-width: 1536px) 600px, (min-width: 1024px) 42vw, 92vw"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-5 p-6 lg:p-8">
                <div className="space-y-3">
                  <h1 className="font-sans text-3xl font-bold tracking-tight text-foreground wrap-anywhere">{project.title}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    {project.category ? <ToneBadge tone={categoryTone} className="rounded-xs px-3 py-1 text-xs">{project.category}</ToneBadge> : null}
                    {project.sub_category ? <span className="rounded-xs bg-muted px-3 py-1 text-xs text-muted-foreground">{project.sub_category}</span> : null}
                    <ContentClassification classification={project.classification} compact />
                  </div>
                  <p className="max-w-3xl whitespace-pre-line text-base leading-7 text-foreground/85">{projectSummary}</p>
                  {Number(project.id) === 149 ? <p className="text-xs leading-5 text-muted-foreground">封面及过程配图为 AI 生成示意图，制作方法见步骤。</p> : null}
                  {!videoPilot && !usesScienceGuideOrAlternative && Number(project.id) !== 149 && !summaryIsPlaceholder && projectOverview !== projectSummary ? (
                    <p data-testid="project-overview" className="max-w-3xl text-sm leading-6 text-muted-foreground">{projectOverview}</p>
                  ) : null}
                  {visibleTags.length ? <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">{visibleTags.map(tag => <span key={tag}>#{tag}</span>)}</div> : null}
                </div>
                <ProjectDetailActions practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide} projectId={project.id} projectTitle={project.title} mode={mode} variant="hero" />
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    {!videoPilot ? <span className="inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4" aria-hidden />{steps.length} {isScienceViewingGuide ? "项观看要点" : "个步骤"}</span> : null}
                    {!videoPilot && !isScienceViewingGuide ? <span className="inline-flex items-center gap-1.5"><Box className="h-4 w-4" aria-hidden />{materials.length} 种材料</span> : null}
                    {completedCount > 0 ? <span className="inline-flex items-center gap-1.5"><UsersRound className="h-4 w-4" aria-hidden />{formatCount(completedCount)} 人完成</span> : null}
                    {projectCoinsReceived > 0 ? <span className="inline-flex items-center gap-1.5"><CoinIcon className="h-4 w-4" />{formatCount(projectCoinsReceived)} 投币</span> : null}
                  </div>
                  <ProjectInteractions projectId={project.id} projectTitle={project.title} likes={project.likes} projectOwnerId={project.author_id} projectCoinsReceived={projectCoinsReceived} />
                </div>
              </div>
            </div>
          </section>
          {courseLessonRef ? (
            <ProjectCourseLink courseId={courseLessonRef.courseId} lessonId={courseLessonRef.lessonId} courseTitle={courseLessonRef.courseTitle} lessonTitle={courseLessonRef.lessonTitle} />
          ) : null}
          <div className="surface-panel rounded-lg p-4 lg:hidden"><ProjectAuthorCard author={authorSummary} /></div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-6">
              <div id="project-materials" className="scroll-mt-36">
                <SectionCard title={materialsTitle}>
                  <MaterialsList materials={materials} preparationNotes={preparationNotes} kitLinks={materialKitLinks} kitMaterialName={`《${project.title}》对应实验材料包`} />
                  <ProjectKitMatches matches={onlyMaterial?.name === `《${project.title}》对应实验材料包` && materialKitLinks.length ? [] : kitMatches} />
                  {videoPilot ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{videoPilot.materialsNote}</p> : null}
                  {!usesScienceGuideOrAlternative ? <ContextualStoreProducts products={contextualStoreProducts} contextLabel="这个项目的" idSuffix="desktop" embedded /> : null}
                </SectionCard>
              </div>
              {scienceSample ? <ScienceProjectSafety sample={scienceSample} /> : null}
              {textbook3d ? (
                <div id="project-textbook" className="scroll-mt-36">
                  <SectionCard title="3D 课本">
                    <TextbookFrame lessonId={textbook3d.id} src={textbook3dSrc(textbook3d.id)} title={`3D 课本：${textbook3d.title}`} />
                  </SectionCard>
                </div>
              ) : null}
              <div id="project-steps" className="scroll-mt-36">
                {videoPilot ? <SectionCard title="制作视频">{tutorialContent}</SectionCard> : <SectionCard title={`${isScienceViewingGuide ? '观看要点' : '制作步骤'}${steps.length ? `（共 ${steps.length} ${isScienceViewingGuide ? "项" : "步"}）` : ''}`}>
                  {steps.length ? (
                    <ol className="divide-y divide-border/60">{steps.map((step, index) => <StepItem viewingGuide={isScienceViewingGuide} key={`${step.title || 'step'}-${index}`} step={step} index={index} />)}</ol>
                  ) : <p className="py-4 text-sm text-muted-foreground">{isScienceViewingGuide ? "暂无观看要点" : "暂无步骤说明"}</p>}
                </SectionCard>}
              </div>
              {scienceSample ? <ScienceProjectNotes sample={scienceSample} /> : Number(project.id) === 149 ? <LedCardExtension className="surface-panel rounded-lg px-6 py-4" /> : (<ProjectCiteTakeaway category={project.category} reflection={project.reflection} description={projectSummary} className="surface-panel rounded-lg px-6 py-4" />)}
              {!usesScienceGuideOrAlternative && project.faq?.length ? (
                <SectionCard title={Number(project.id) === 149 ? "故障排查" : "常见问题"}>
                  <ProjectFaq items={project.faq} projectId={project.id} />
                </SectionCard>
              ) : null}
              <section id="project-exploration-records" className="surface-panel scroll-mt-36 overflow-hidden rounded-lg p-6">
                <h2 className="mb-4 text-xl font-bold tracking-tight">探索记录</h2>
                <ProjectExplorationRecordsBlock practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide}
                  projectId={project.id}
                  completions={completions}
                  emptyActionSlot={isScienceViewingGuide ? undefined : <CompletionCTA projectId={project.id} projectTitle={project.title} challengeId={project.challenge_id} mode={mode} variant="inline" actionLabel={isObservationProject ? '记录我的观察' : '记录我的项目'} />}
                />
              </section>
              <ExploreAwareContinuationCard projectId={project.id} fallbackProject={continuationProject} fallbackHref={continuationHref} currentMinAge={project.classification?.recommendedMinAge ?? null} />
            </div>
            <aside className="sticky top-36 hidden min-w-0 space-y-5 lg:block">
              <section className="surface-panel rounded-lg p-5">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">项目目录</h2>
                <ProjectSectionNav practicePending={isSciencePracticePending} viewingGuide={isScienceViewingGuide} videoTutorial={Boolean(videoPilot)} variant="vertical" />
                {authorSummary ? <div className="mt-4 border-t border-border/60 pt-4"><ProjectAuthorCard author={authorSummary} /></div> : null}
              </section>
              {project.challenge_id ? (
                <section className="surface-panel rounded-lg p-5">
                  <h2 className="font-semibold">相关挑战</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">这个项目可作为挑战作品的参考实践。</p>
                  <Button asChild variant="outline" className="mt-3 min-h-11"><Link href={`/pbl/${project.challenge_id}`}>查看挑战</Link></Button>
                </section>
              ) : null}
            </aside>
          </div>
        </div>
        {(createdAt || updatedAt) && (
          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {createdAt && <span>创建于 <time dateTime={createdAt}>{dateFormatter.format(new Date(createdAt))}</time></span>}
            {updatedAt && <span>更新于 <time dateTime={updatedAt}>{dateFormatter.format(new Date(updatedAt))}</time></span>}
          </p>
        )}
      </div>
    </div>
  )
}
