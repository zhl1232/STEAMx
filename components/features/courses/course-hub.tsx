'use client'

import Link from 'next/link'
import { courseCatalogHref } from '@/lib/courses/catalog-url'
import { useEffect, useMemo, useState } from 'react'
import { Check, Play } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/optimized-image'
import type { CourseListItem, CoursePreviewLesson } from '@/lib/courses/types'
import {
  getCourseCategory, isLearningCourse, selectCourseCatalog,
  type CourseCategory, type CourseFilter,
} from './course-catalog'
import styles from './course-hub.module.css'
import { MobileCourseCatalog } from './mobile-course-catalog'
import { DesktopCourseCatalog } from './desktop-course-catalog'
import { courseDisplayDescription, courseDisplayTitle } from './course-presentation'

const CATEGORY_ORDER: CourseCategory[] = ['brick', 'programming', 'strategy', 'other']

const BRICK_GRADE_SECTIONS: Array<{ key: string; label: string; test: (title: string) => boolean }> = [
  { key: 'xiaoban', label: '小班（3 岁起）', test: (t) => t.includes('小班') },
  { key: 'zhongban', label: '中班（4 岁起）', test: (t) => t.includes('中班') },
  { key: 'daban', label: '大班（5 岁起）', test: (t) => t.includes('大班') },
]

function withRetry(src: string, attempt: number) {
  if (attempt === 0) return src
  return `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`
}

type CourseTheme = 'xiaoban' | 'zhongban' | 'daban' | 'scratch' | 'gomoku' | 'other'

function getCourseTheme(course: CourseListItem): CourseTheme {
  const category = getCourseCategory(course)
  if (category === 'brick') return (BRICK_GRADE_SECTIONS.find((s) => s.test(course.title))?.key as CourseTheme | undefined) ?? 'other'
  if (category === 'programming') return 'scratch'
  if (category === 'strategy') return 'gomoku'
  return 'other'
}

function LessonTileImage({ lesson, theme }: { lesson: CoursePreviewLesson; theme: CourseTheme }) {
  const [load, setLoad] = useState({ attempt: 0, failed: false })
  if (lesson.image_url && !load.failed) {
    const { attempt } = load
    return (
      <span className={styles.lessonThumb} data-kind="photo">
        <OptimizedImage key={attempt} src={withRetry(lesson.image_url, attempt)} alt="" fill variant="thumbnail" loading="lazy" sizes="(min-width: 1920px) 208px, (min-width: 1440px) 15vw, (min-width: 1280px) 18vw, (min-width: 768px) 23vw, 124px"
          className={styles.lessonPhoto} onError={() => {
            if (attempt < 2) window.setTimeout(() => setLoad({ attempt: attempt + 1, failed: false }), 600 * (attempt + 1))
            else setLoad({ attempt, failed: true })
          }} />
      </span>
    )
  }
  return (
    <span className={styles.lessonThumb} data-kind="icon">
      {theme !== 'other' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/courses/icons/${theme}.webp`} alt="" width={64} height={64} className={styles.lessonIconArt} />
      ) : null}
    </span>
  )
}

function LessonTile({ course, lesson, theme }: { course: CourseListItem; lesson: CoursePreviewLesson; theme: CourseTheme }) {
  return (
    <Link href={`/courses/${course.id}/lessons/${lesson.id}`} prefetch={false} className={styles.lessonTile}
      aria-label={`第${lesson.number}课 ${lesson.title}${lesson.is_completed ? '（已完成）' : ''}`} data-lesson-id={lesson.id}>
      <LessonTileImage lesson={lesson} theme={theme} />
      <span className={styles.lessonBadge} aria-hidden="true">{String(lesson.number).padStart(2, '0')}</span>
      {lesson.is_completed ? <span className={styles.doneBadge} aria-hidden="true"><Check size={14} strokeWidth={3} /></span> : null}
      <strong className={styles.lessonTitle}>{lesson.title}</strong>
    </Link>
  )
}

/** 顶部横幅文案（占位，待定稿后替换；subtitle 留空则不显示） */
export const HERO_COPY = { title: '每一次尝试，都是成长。', subtitle: '', emphasis: ['成长'] }

/** 把标题按逗号分行，并把重点词包成高亮 */
function HeroTitle({ text, emphasis }: { text: string; emphasis: string[] }) {
  const pattern = new RegExp(`(${emphasis.join('|')})`)
  return (
    <>
      {text.split(/(?<=，)/).map((line) => (
        <span key={line} className={styles.heroLine}>
          {line.split(pattern).filter(Boolean).map((part, i) => emphasis.includes(part)
            ? <em key={i} className={styles.heroEm}>{part}</em> : <span key={i}>{part}</span>)}
        </span>
      ))}
    </>
  )
}

/** 顶部展示每门在学课程的继续入口，否则保留插画横幅。 */
function CoursesHero({ courses }: { courses: CourseListItem[] }) {
  const continuing = courses.filter(course => isLearningCourse(course) && course.next_lesson)
  if (continuing.length > 0) {
    return (
      <section className={styles.continueCourses} aria-label="继续学习">
        <div className={styles.continueCoursesRail}>
          {continuing.map(course => {
            const next = course.next_lesson!
            const progress = course.progress
            return <Link key={course.id} href={`/courses/${course.id}/lessons/${next.id}`} prefetch={false} className={styles.heroContinue}
              data-course-theme={getCourseTheme(course)} data-continue-card aria-label={`继续学习：${course.title} 第${next.number}课 ${next.title}`}>
              <span className={styles.heroContinueThumb}>
                {next.image_url ? <OptimizedImage src={next.image_url} alt="" fill variant="thumbnail" loading="lazy" sizes="72px" className={styles.lessonPhoto} />
                  : <span className={styles.lessonNumber}>{String(next.number).padStart(2, '0')}</span>}
              </span>
              <span className={styles.heroContinueBody}>
                <span className={styles.heroContinueLabel}>继续学习</span>
                <strong>第{next.number}课 · {next.title}</strong>
                <span className={styles.heroContinueMeta}>{course.title}{progress ? ` · 已学 ${progress.completed_lesson_count}/${progress.total_lesson_count}` : ''}</span>
              </span>
              <span className={styles.heroContinueGo} aria-hidden="true"><Play size={18} /></span>
            </Link>
          })}
        </div>
      </section>
    )
  }
  return (
    <section className={styles.hero} aria-labelledby="courses-hero-heading">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/courses/hero.webp" alt="" className={`${styles.heroImage} ${styles.heroImageLight}`} width={1200} height={400} />
      <img src="/courses/hero-dark.webp" alt="" className={`${styles.heroImage} ${styles.heroImageDark}`} width={1200} height={400} />
      <div className={styles.heroText}>
        <h2 id="courses-hero-heading" aria-label={HERO_COPY.title}><HeroTitle text={HERO_COPY.title} emphasis={HERO_COPY.emphasis} /></h2>
        {HERO_COPY.subtitle ? <p className={styles.heroSub}>{HERO_COPY.subtitle}</p> : null}
      </div>
    </section>
  )
}

function orderCourses(visible: CourseListItem[]) {
  const rank = (c: CourseListItem) => {
    const cat = getCourseCategory(c)
    if (cat === 'brick') {
      const g = BRICK_GRADE_SECTIONS.findIndex((s) => s.test(c.title))
      return g === -1 ? 3 : g
    }
    return 4 + CATEGORY_ORDER.indexOf(cat)
  }
  return visible.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map(({ c }) => c)
}

/** Show real course content before hydration, including when JavaScript is unavailable. */
function InitialCourseCatalog({ courses, selectedCourseId }: { courses: CourseListItem[]; selectedCourseId?: number }) {
  if (courses.length === 0) return <div className={styles.empty}>技能课程即将上线，敬请期待。</div>
  return <div className={`${styles.hub} ${styles.initialCatalog}`} data-course-hub data-initial-courses>
    {selectedCourseId ? <nav className={styles.courseTabs} aria-label="选择课程">{courses.filter(course => course.is_listed !== false).map(course => <Link key={course.id} href={courseCatalogHref(course.id)} prefetch={false} aria-current={course.id === selectedCourseId ? 'page' : undefined}>{courseDisplayTitle(course.title)}</Link>)}</nav> : null}
    {courses.filter(course => !selectedCourseId || course.id === selectedCourseId).map(course => <section key={course.id} data-course-theme={getCourseTheme(course)}>
      <header className={styles.initialCourseHeading}>
        <h2><Link href={courseCatalogHref(course.id)} prefetch={false}>{courseDisplayTitle(course.title)}</Link></h2>
        <p>{[course.classification?.ageLabel, `${course.lesson_count} 课`, selectedCourseId ? course.classification?.supportLabel : null].filter(Boolean).join(' · ')}</p>
        {selectedCourseId && courseDisplayDescription(course) ? <p>{courseDisplayDescription(course)}</p> : null}
      </header>
      {(course.preview_lessons?.length ?? 0) > 0 ? <div className={styles.initialLessonGrid}>
        {course.preview_lessons!.map(lesson => <LessonTile key={lesson.id} course={course} lesson={lesson} theme={getCourseTheme(course)} />)}
      </div> : <p className={styles.lessonEmpty}>{course.lesson_count > 0 ? '进入课程查看课时' : '课时准备中'}</p>}
    </section>)}
  </div>
}

export function CourseHub({ courses, initialFilter = 'recommended', initialCourseId }: {
  courses: CourseListItem[]; initialFilter?: CourseFilter; initialCourseId?: number
}) {
  const ordered = useMemo(() => orderCourses(selectCourseCatalog(courses, initialFilter)), [courses, initialFilter])
  const allCourses = useMemo(() => orderCourses(courses), [courses])
  const [desktop, setDesktop] = useState<boolean | null>(null)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  if (desktop === null) return <InitialCourseCatalog courses={initialCourseId ? allCourses : ordered} selectedCourseId={initialCourseId} />
  if (desktop) return <DesktopCourseCatalog courses={allCourses} initialCourseId={initialCourseId ?? ordered[0]?.id ?? 0}
    restoreSelection={!initialCourseId && (initialFilter === 'recommended' || initialFilter === 'all')} themeFor={getCourseTheme}
    renderLesson={(course, lesson) => <LessonTile key={lesson.id} course={course} lesson={lesson} theme={getCourseTheme(course)} />} />
  return <MobileCourseCatalog initialCourseId={initialCourseId} courses={initialCourseId ? allCourses : ordered} hero={courses.length > 0 ? <CoursesHero courses={courses} /> : null}
    themeFor={getCourseTheme} renderLesson={(course, lesson) => <LessonTile key={lesson.id} course={course} lesson={lesson} theme={getCourseTheme(course)} />} />
}
