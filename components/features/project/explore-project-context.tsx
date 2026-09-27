"use client"

import Link from "next/link"
import { useMemo, useSyncExternalStore, type ReactNode } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"

import { ProjectContinuationCard } from "@/components/features/project/project-continuation-card"
import { ContentClassification } from "@/components/ui/content-classification"
import { OptimizedImage } from "@/components/ui/optimized-image"
import {
  advanceExploreProjectContext,
  parseExploreProjectContext,
  readExploreProjectContextRaw,
  saveExploreProjectContext,
  type ExploreContextProject,
  type ExploreProjectContext,
} from "@/lib/explore/project-navigation-context"
import { isPlaceholderProjectDescription } from "@/lib/seo/project-description"
import { cn } from "@/lib/utils"

const subscribeNoop = () => () => {}

/** Explore context for this project, read from sessionStorage after hydration (null on the server). */
export function useExploreProjectContext(projectId: string | number): ExploreProjectContext | null {
  const raw = useSyncExternalStore(subscribeNoop, readExploreProjectContextRaw, () => null)
  return useMemo(() => parseExploreProjectContext(raw, projectId), [raw, projectId])
}

export function useExploreBackHref(projectId: string | number, fallbackHref: string): string {
  return useExploreProjectContext(projectId)?.exploreHref ?? fallbackHref
}

export function ExploreBackLink({
  projectId,
  fallbackHref,
  className,
  children,
}: {
  projectId: string | number
  fallbackHref: string
  className?: string
  children: ReactNode
}) {
  const href = useExploreBackHref(projectId, fallbackHref)
  return (
    <Link href={href} className={className}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      {children}
    </Link>
  )
}

type Continuation = {
  kind: "next" | "related" | "back"
  href: string
  project: ExploreContextProject | null
  onNavigate?: () => void
}

function useContinuation(
  projectId: string | number,
  fallback: { project: ExploreContextProject | null; href: string },
): { continuation: Continuation | null; exploreHref: string | null } {
  const context = useExploreProjectContext(projectId)
  if (!context) {
    return {
      continuation: fallback.project ? { kind: "related", href: fallback.href, project: fallback.project } : null,
      exploreHref: null,
    }
  }
  const next = context.queue[0] ?? null
  if (!next) {
    return { continuation: { kind: "back", href: context.exploreHref, project: null }, exploreHref: context.exploreHref }
  }
  return {
    continuation: {
      kind: "next",
      href: `/project/${next.id}`,
      project: next,
      onNavigate: () => saveExploreProjectContext(advanceExploreProjectContext(context)),
    },
    exploreHref: context.exploreHref,
  }
}

/** Desktop "继续看下一个项目 / 继续探索这个方向" card. */
export function ExploreAwareContinuationCard({
  projectId,
  fallbackProject,
  fallbackHref,
}: {
  projectId: string | number
  fallbackProject: ExploreContextProject | null
  fallbackHref: string
}) {
  const { continuation } = useContinuation(projectId, { project: fallbackProject, href: fallbackHref })
  if (!continuation) return null
  return (
    <ProjectContinuationCard
      kind={continuation.kind}
      href={continuation.href}
      project={continuation.project}
      onNavigate={continuation.onNavigate}
    />
  )
}

function MobileRelatedShell({ exploreHref, children }: { exploreHref: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-32 rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-base font-bold tracking-tight text-foreground">你可能还会喜欢</h2>
        <Link href={exploreHref} className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">查看更多</Link>
      </div>
      {children}
    </section>
  )
}

/** Mobile "你可能还会喜欢" block. */
export function ExploreAwareMobileRelated({
  projectId,
  fallbackProject,
  fallbackHref,
  fallbackExploreHref,
}: {
  projectId: string | number
  fallbackProject: ExploreContextProject | null
  fallbackHref: string
  fallbackExploreHref: string
}) {
  const { continuation, exploreHref: contextExploreHref } = useContinuation(projectId, {
    project: fallbackProject,
    href: fallbackHref,
  })
  const exploreHref = contextExploreHref ?? fallbackExploreHref
  const project = continuation?.project ?? null
  const href = continuation?.href ?? fallbackHref

  if (!project) {
    return (
      <MobileRelatedShell exploreHref={exploreHref}>
        <Link
          href={href}
          className="flex items-center justify-between rounded-sm border border-dashed border-[hsl(var(--surface-border))] bg-background/58 px-4 py-4 text-sm font-semibold text-[hsl(var(--brand-green))]"
        >
          回到探索页发现更多项目
          <ChevronRight className="h-4 w-4" />
        </Link>
      </MobileRelatedShell>
    )
  }

  const description = isPlaceholderProjectDescription(project.description, project.title)
    ? ""
    : project.description

  return (
    <MobileRelatedShell exploreHref={exploreHref}>
      <Link
        href={href}
        onClick={continuation?.onNavigate}
        className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-sm border border-[hsl(var(--surface-border)/0.84)] bg-background/78 p-2.5"
      >
        <div className="relative aspect-4/3 overflow-hidden rounded-sm bg-muted">
          <OptimizedImage src={project.image} alt={project.title} fill variant="card" className="object-cover" />
        </div>
        <div className="min-w-0 py-0.5">
          <p className="line-clamp-2 font-sans text-sm font-bold leading-5 text-foreground">{project.title}</p>
          <p className={cn("mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground")}>
            {description || "继续探索一个相关项目。"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <ContentClassification classification={project.classification} compact />
            {project.category ? <span className="shrink-0">{project.category}</span> : null}
          </div>
        </div>
      </Link>
    </MobileRelatedShell>
  )
}
