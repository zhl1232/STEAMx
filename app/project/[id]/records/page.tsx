import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { ProjectRecordsClient } from "@/components/features/project/project-records-client"
import { ProjectRecordsPageSkeleton } from "@/components/ui/loading-skeleton"
import {
  getProjectById,
  getProjectCompletionById,
  getProjectCompletions,
  getProjectExplorationRecordsCount,
  mergeHighlightCompletion,
  type ProjectCompletionSort,
} from "@/lib/api/explore-data"
import { createClient } from "@/lib/supabase/server"
import { parseHighlightCompletionId } from "@/lib/project/exploration-record-links"
import { buildPageMetadata } from "@/lib/seo/metadata"

const RECORDS_PAGE_LIMIT = 48

interface ProjectRecordsPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ highlight?: string; sort?: string }>
}

function canAccessProject(
  project: Awaited<ReturnType<typeof getProjectById>>,
  viewerId?: string,
) {
  if (!project) return false
  if (!project.status || project.status === "approved") return true
  return viewerId === project.author_id
}

function parseRecordsSort(value?: string | null): ProjectCompletionSort {
  return value === "featured" ? "featured" : "latest"
}

export async function generateMetadata({ params }: ProjectRecordsPageProps): Promise<Metadata> {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) {
    return buildPageMetadata({ title: "探索记录", description: "项目探索记录", path: `/project/${id}/records` })
  }
  return buildPageMetadata({
    title: `${project.title} · 探索记录`,
    description: `查看「${project.title}」的探索记录与玩家动态。`,
    path: `/project/${project.id}/records`,
  })
}

export default async function ProjectRecordsPage({ params, searchParams }: ProjectRecordsPageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const highlightCompletionId = parseHighlightCompletionId(resolvedSearchParams.highlight)
  const sortBy = parseRecordsSort(resolvedSearchParams.sort)
  const project = await getProjectById(id)
  if (!project) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!canAccessProject(project, user?.id)) notFound()

  const tags = project.tags ?? []
  const mode = tags.includes("鸟类") ? "observation" : "project"

  const [rawCompletions, totalRecordsCount, highlightCompletion] = await Promise.all([
    getProjectCompletions(project.id, RECORDS_PAGE_LIMIT, { sortBy }),
    getProjectExplorationRecordsCount(project.id),
    highlightCompletionId
      ? getProjectCompletionById(project.id, highlightCompletionId)
      : Promise.resolve(null),
  ])

  const completions = mergeHighlightCompletion(rawCompletions, highlightCompletion, RECORDS_PAGE_LIMIT)
  return (
    <Suspense fallback={<ProjectRecordsPageSkeleton />}>
      <ProjectRecordsClient
        projectId={project.id}
        projectTitle={project.title}
        challengeId={project.challenge_id}
        mode={mode}
        completions={completions}
        totalRecordsCount={totalRecordsCount}
        initialSort={sortBy}
        highlightCompletionId={highlightCompletionId}
      />
    </Suspense>
  )
}
