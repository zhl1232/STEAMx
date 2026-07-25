import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { WorkDetail } from "@/components/features/works/work-detail"
import { createClient } from "@/lib/supabase/server"
import { getWorkById } from "@/lib/works/data"

type WorkPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ share?: string | string[] }>
}

export async function generateMetadata({ params }: WorkPageProps): Promise<Metadata> {
  const id = Number((await params).id)
  const work = Number.isInteger(id) && id > 0 ? await getWorkById(id) : null
  if (!work) return { title: "作品未找到", robots: { index: false, follow: false } }
  const title = `${work.author}的${work.source?.title || "作品"}`
  const description = work.notes?.slice(0, 160) || `查看 ${work.author} 分享的 STEAM 探索作品。`
  return {
    title,
    description,
    alternates: { canonical: `/works/${work.id}` },
    openGraph: {
      title,
      description,
      type: "article",
      images: work.proofImages[0] ? [{ url: work.proofImages[0], alt: title }] : undefined,
    },
    robots: work.status === "approved" && work.isPublic ? undefined : { index: false, follow: false },
  }
}

export default async function WorkPage({ params, searchParams }: WorkPageProps) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const [work, supabase] = await Promise.all([getWorkById(id), createClient()])
  if (!work) notFound()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const shareParam = (await searchParams)?.share
  return (
    <WorkDetail
      work={work}
      canShare={user?.id === work.userId}
      autoOpenShare={shareParam === "1"}
    />
  )
}
