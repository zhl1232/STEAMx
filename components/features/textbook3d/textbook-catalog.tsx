import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"

import { TEXTBOOK3D_VOLUMES } from "@/lib/textbook3d/registry"
import styles from "./textbook-catalog.module.css"

const bookGroups = [
  { title: "小学科学", edition: "教科版", volumes: TEXTBOOK3D_VOLUMES.filter((volume) => volume.subject === "科学") },
  { title: "初中物理", edition: "人教版", volumes: TEXTBOOK3D_VOLUMES.filter((volume) => volume.subject === "物理") },
]

export default function TextbookCatalog({ volumeId }: { volumeId?: string }) {
  const selected = TEXTBOOK3D_VOLUMES.find((volume) => volume.id === volumeId) ?? TEXTBOOK3D_VOLUMES[0]
  const lessonCount = selected.chapters.reduce((total, chapter) => total + chapter.lessons.length, 0)
  const firstLesson = selected.chapters[0]?.lessons[0]

  return (
    <div className={`app-shell-wide pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:py-10 ${styles.catalog}`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><BookOpen aria-hidden className="size-4" /> 从课本出发，亲手探索</p>
          <h1 className={styles.title}>翻开课本，<br className="sm:hidden" />让知识立体起来。</h1>
          <p className={styles.intro}>3D 互动课本 · 转动场景，动手实验，在探索中读懂科学。</p>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <Image src="/assets/playground-art/textbook-v2.webp" alt="" fill sizes="(min-width: 1280px) 360px, (min-width: 768px) 280px, 0px" className="object-contain" />
        </div>
      </header>
      <div className={styles.workspace}>
        <nav className={styles.shelf} aria-label="选择年级与册次">
          <div className={styles.shelfHeading}><h2>选择课本</h2></div>
          <div className={styles.gradeList}>
            {bookGroups.map(({ title, edition, volumes }) => (
              <div className={styles.gradeGroup} key={title}>
                <div className={styles.gradeLabel}><span>{title}</span><span>{edition}</span></div>
                <div className={styles.semesters}>
                  {volumes.map((volume) => (
                    <Link key={volume.id} href={`/textbook?volume=${volume.id}`} scroll={false}
                      aria-current={volume.id === selected.id ? "page" : undefined}
                      aria-label={`${volume.edition}${volume.subject} ${volume.title}`} className={styles.semester}>
                      {volume.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
        <section className={styles.contents} aria-labelledby="volume-title">
          <header className={styles.volumeHeader}>
            <div className={styles.bookMark} aria-hidden="true"><BookOpen className="size-7" /></div>
            <div className={styles.volumeIdentity}>
              <p className={styles.edition}>{selected.edition} · {selected.id.startsWith("p") ? "小学" : "初中"}{selected.subject}</p>
              <h2 id="volume-title" className={styles.volumeTitle}>{selected.title}</h2>
              <p className={styles.publisher}>{selected.publisher} · {selected.chapters.length} 个单元 · {lessonCount} 节</p>
            </div>
            {firstLesson ? <Link href={`/textbook/${firstLesson.id}`} className={styles.startLink}>翻开课本<ArrowRight aria-hidden className="size-4" /></Link> : null}
          </header>
          <div className={styles.chapterList}>
            {selected.chapters.map((chapter, chapterIndex) => (
              <section className={styles.chapter} key={chapter.id} aria-labelledby={`chapter-${chapter.id}`}>
                <div className={styles.chapterHeading}>
                  <span className={styles.chapterNumber} aria-hidden="true">{String(chapterIndex + 1).padStart(2, "0")}</span>
                  <h3 id={`chapter-${chapter.id}`}>{chapter.title}</h3>
                  <span className={styles.chapterCount}>{chapter.lessons.length} 节</span>
                </div>
                <ol className={styles.lessons}>
                  {chapter.lessons.map((lesson, index) => (
                    <li key={lesson.id}>
                      <Link href={`/textbook/${lesson.id}`} className={styles.lesson}>
                        <span className={styles.lessonNumber}>{String(index + 1).padStart(2, "0")}</span>
                        <span className={styles.lessonTitle}>{lesson.title}</span>
                        <ArrowRight aria-hidden className={styles.lessonArrow} />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
