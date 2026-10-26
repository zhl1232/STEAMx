import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"

import { buildPageMetadata } from "@/lib/seo/metadata"
import { TEXTBOOK3D_CHAPTERS } from "@/lib/textbook3d/registry"

export const metadata = buildPageMetadata({
  title: "3D 物理课本",
  description: "把初中物理课本做成可以转动、翻页、动手操作的 3D 课本：机械运动、声现象、物态变化、机械能，边读边做小实验。",
  path: "/textbook",
})

export default function TextbookCatalogPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-8">
      <header className="mb-6">
        <h1 className="text-page-title font-sans">3D 物理课本</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          跟着课本一页页读，场景可以转动、点选、动手做，读完完成小挑战。
        </p>
      </header>
      <div className="space-y-8">
        {TEXTBOOK3D_CHAPTERS.map((chapter) => (
          <section key={chapter.id} aria-labelledby={`chapter-${chapter.id}`}>
            <p className="text-sm font-semibold text-muted-foreground">{chapter.volume}</p>
            <h2 id={`chapter-${chapter.id}`} className="mt-1 text-xl font-bold text-foreground">
              {chapter.title}
            </h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-2">
              {chapter.lessons.map((lesson, index) => (
                <li key={lesson.id}>
                  <Link
                    href={`/textbook/${lesson.id}`}
                    className="group flex min-h-16 items-center gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground transition-colors hover:border-primary hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-base font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-base font-semibold leading-snug">{lesson.title}</span>
                    <ArrowRight aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <p className="mt-8 flex items-center gap-2 text-base text-muted-foreground">
        <BookOpen aria-hidden className="h-5 w-5" />
        更多章节陆续上线。
      </p>
    </div>
  )
}
