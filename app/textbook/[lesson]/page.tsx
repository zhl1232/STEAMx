import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { buildPageMetadata } from "@/lib/seo/metadata"
import { getTextbook3dLesson, listTextbook3dLessons, textbook3dSrc } from "@/lib/textbook3d/registry"
import TextbookFrame from "@/components/features/textbook3d/textbook-frame"

export const dynamicParams = false

export function generateStaticParams() {
  return listTextbook3dLessons().map((lesson) => ({ lesson: lesson.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ lesson: string }> }) {
  const lesson = getTextbook3dLesson((await params).lesson)
  if (!lesson) return {}
  return buildPageMetadata({
    title: `${lesson.title} · 3D 物理课本`,
    description: `${lesson.chapter.volume}${lesson.chapter.title}「${lesson.title}」的 3D 互动课本，边读边转动场景、动手做小实验。`,
    path: `/textbook/${lesson.id}`,
  })
}

const navLink = "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-base font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

export default async function TextbookLessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const lesson = getTextbook3dLesson((await params).lesson)
  if (!lesson) notFound()
  return (
    <div className="mx-auto w-full max-w-6xl py-4 md:px-6 md:py-6">
      <header className="px-4 md:px-0">
        <Link href="/textbook" className={`${navLink} -ml-3 text-muted-foreground`}>
          <ArrowLeft aria-hidden className="h-5 w-5" />
          3D 物理课本
        </Link>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          {lesson.chapter.volume} · {lesson.chapter.title} · 第 {lesson.number} 节
        </p>
        <h1 className="mt-1 text-page-title font-sans">{lesson.title}</h1>
      </header>
      <div className="mt-4">
        <TextbookFrame key={lesson.id} lessonId={lesson.id} src={textbook3dSrc(lesson.id)} title={`3D 课本：${lesson.title}`} />
      </div>
      <nav aria-label="上一节和下一节" className="mt-4 flex flex-wrap justify-between gap-2 px-4 md:px-0">
        {lesson.prev ? (
          <Link href={`/textbook/${lesson.prev.id}`} className={navLink}>
            <ArrowLeft aria-hidden className="h-5 w-5" />上一节：{lesson.prev.title}
          </Link>
        ) : <span />}
        {lesson.next && (
          <Link href={`/textbook/${lesson.next.id}`} className={navLink}>
            下一节：{lesson.next.title}<ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
        )}
      </nav>
    </div>
  )
}
