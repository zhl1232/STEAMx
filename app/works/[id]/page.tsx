import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { WorkDetail } from "@/components/features/works/work-detail"
import { JsonLd } from "@/components/seo/json-ld"
import { buildWorkJsonLd } from "@/lib/seo/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { createClient } from "@/lib/supabase/server"
import { getWorkById, getWorkJourneyResult } from "@/lib/works/data"

type WorkPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ share?: string | string[] }>
}

export async function generateMetadata({ params }: WorkPageProps): Promise<Metadata> {
  const id = Number((await params).id)
  const work = Number.isInteger(id) && id > 0 ? await getWorkById(id) : null
  if (!work) return { title: "作品未找到", robots: { index: false, follow: false } }
  const contentLabel = work.recordKind === "final" ? "作品" : "探索记录"
  const title = `${work.author}的${work.source?.title || contentLabel}`
  const description = work.notes?.slice(0, 160) || `查看 ${work.author} 分享的 STEAM ${contentLabel}。`
  return buildPageMetadata({
    title,
    description,
    path: `/works/${work.id}`,
    type: "article",
    image: work.proofImages[0],
    keywords: [work.source?.title, contentLabel, "学生作品"],
    noIndex: work.status !== "approved" || !work.isPublic,
  })
}

export default async function WorkPage({ params, searchParams }: WorkPageProps) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const [work, supabase] = await Promise.all([getWorkById(id), createClient()])
  if (!work) notFound()
  const [authResult, journeyResult, resolvedSearchParams] = await Promise.all([
    supabase.auth.getUser(),
    getWorkJourneyResult(work),
    searchParams,
  ])
  const user = authResult.data.user
  const shareParam = resolvedSearchParams?.share
  const isOwner = user?.id === work.userId
  return (
    <>
      <JsonLd data={buildWorkJsonLd({
        id: work.id,
        title: `${work.author}的${work.source?.title || "作品"}`,
        description: work.notes,
        images: work.proofImages,
        author: work.author,
        dateCreated: work.completedAtIso,
      })} />
      <WorkDetail
        work={work}
        journeyRecords={journeyResult.records}
        journeyTotal={journeyResult.total}
        journeyHasMore={journeyResult.hasMore}
        canShare={isOwner && work.recordKind === "final"}
        canPromote={isOwner && work.source?.type === "project"}
        autoOpenShare={shareParam === "1"}
      />
    </>
  )
}
