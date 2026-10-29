'use client'

import Link from 'next/link'
import { courseCatalogHref } from '@/lib/courses/catalog-url'
import { CourseShareButton } from './course-share-button'
import { ContinueLastLesson } from './continue-last-lesson'
import { useEffect, useState, type ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { CourseListItem, CoursePreviewLesson } from '@/lib/courses/types'
import { isLearningCourse } from './course-catalog'
import { courseDisplayDescription, courseDisplayTitle } from './course-presentation'
import styles from './course-hub.module.css'

const STORAGE_KEY = 'courses:mobile-view:v1'
type RenderLesson = (course: CourseListItem, lesson: CoursePreviewLesson) => ReactNode

function initialSelection(courses: CourseListItem[], initialCourseId?: number, restoreSelection = true) {
  if (restoreSelection) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
      const id = saved?.desktopSelected ?? saved?.selected
      if (courses.some(course => course.id === id)) return id as number
    } catch { /* Browser storage is optional. */ }
  }
  return initialCourseId ?? courses[0]?.id ?? 0
}

export function DesktopCourseCatalog({ courses, initialCourseId, restoreSelection, renderLesson, themeFor }: {
  courses: CourseListItem[]
  initialCourseId?: number
  restoreSelection: boolean
  renderLesson: RenderLesson
  themeFor: (course: CourseListItem) => string
}) {
  // This component mounts only after the viewport is known on the client.
  const [selectedId] = useState(() => initialSelection(courses, initialCourseId, restoreSelection))
  const [catalogs, setCatalogs] = useState<Record<number, CoursePreviewLesson[]>>({})
  const [requestState, setRequestState] = useState<{ id: number; status: 'loading' | 'error' } | null>(null)
  const [retry, setRetry] = useState(0)
  const selected = selectedId === 0 ? undefined : courses.find(course => course.id === selectedId) ?? courses[0]

  useEffect(() => {
    if (!selected || catalogs[selected.id] || (selected.preview_lessons?.length ?? 0) >= selected.lesson_count) return
    const controller = new AbortController()
    const id = selected.id
    setRequestState({ id, status: 'loading' })
    void (async () => {
      try {
        const response = await fetch(`/api/courses/${id}/catalog`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('catalog unavailable')
        const data = await response.json()
        if (!Array.isArray(data.lessons)) throw new Error('invalid catalog')
        if (controller.signal.aborted) return
        setCatalogs(current => ({ ...current, [id]: data.lessons }))
        setRequestState(null)
      } catch {
        if (!controller.signal.aborted) setRequestState({ id, status: 'error' })
      }
    })()
    return () => controller.abort()
  }, [selected, catalogs, retry])

  function remember(courseId: number, enteringLesson = false) {
    try {
      const existing = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
      const saved = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, desktopSelected: courseId,
        ...(enteringLesson ? { selected: courseId } : {}) }))
    } catch { /* Browsing remains available without storage. */ }
  }

  const courseTabs = <div className={styles.courseTabs} role="group" aria-label="选择课程">
    {courses.filter(course => course.is_listed !== false).map(course => <Link key={course.id} href={courseCatalogHref(course.id)} prefetch={false} aria-current={selected?.id === course.id ? 'page' : undefined}
      onClick={event => { if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; remember(course.id) }}>{courseDisplayTitle(course.title)}</Link>)}
  </div>
  if (!selected) return <div className={`${styles.hub} ${styles.desktopCatalog}`} data-course-hub data-desktop-courses>
    {courses.length > 0 ? courseTabs : null}
    <div className={styles.empty}>{courses.length > 0 ? '当前分类暂无课程。' : '技能课程即将上线，敬请期待。'}</div>
  </div>
  const lessons = catalogs[selected.id] ?? selected.preview_lessons ?? []
  const status = requestState?.id === selected.id ? requestState.status : null
  const incomplete = !catalogs[selected.id] && lessons.length < selected.lesson_count
  const next = isLearningCourse(selected) ? selected.next_lesson : null
  return (
    <div className={`${styles.hub} ${styles.desktopCatalog}`} data-course-hub data-desktop-courses>
      {courseTabs}
      <section data-course-id={selected.id} data-course-theme={themeFor(selected)} aria-labelledby="desktop-course-heading"
        onClickCapture={event => {
          if (event.target instanceof Element && event.target.closest('a')?.getAttribute('href')?.startsWith(`/courses/${selected.id}/lessons/`)) remember(selected.id, true)
        }}>
        <header className={styles.desktopCourseSummary}>
          <div>
            <h2 id="desktop-course-heading" className="sr-only">{courseDisplayTitle(selected.title)}</h2>
            <p>{[selected.classification?.ageLabel, `${catalogs[selected.id]?.length ?? selected.lesson_count} 课`, selected.classification?.supportLabel].filter(Boolean).join(' · ')}</p>
            {courseDisplayDescription(selected) ? <p className={styles.courseDescription}>{courseDisplayDescription(selected)}</p> : null}
          </div>
          <div className={styles.courseActions}>
          <ContinueLastLesson courseId={selected.id} lessonIds={lessons.map(lesson => lesson.id)} fallback={next ? <Link href={`/courses/${selected.id}/lessons/${next.id}`} prefetch={false} className={styles.desktopContinue}
            aria-label={`继续学习：${selected.title} 第${next.number}课 ${next.title}`}>继续学习 · {next.title}</Link> : null} />
          {selected.progress?.status === 'completed' ? <Link href={`/courses/${selected.id}/certificate`}>查看证书</Link> : null}
          <CourseShareButton className="h-9 px-3 text-sm" course={{ id: selected.id, title: selected.title, description: selected.description, image: selected.image_url, lessonCount: selected.lesson_count }} />
          </div>
        </header>
        {incomplete ? <div className={styles.catalogStatus} role={status === 'error' ? 'alert' : 'status'}>
          {status === 'error' ? <><span>完整课时加载失败，当前展示 {lessons.length} / {selected.lesson_count} 课。</span>
            <button type="button" onClick={() => setRetry(value => value + 1)}>重试</button></>
            : `正在加载全部课时，当前展示 ${lessons.length} / ${selected.lesson_count} 课…`}
        </div> : null}
        {lessons.length > 0 ? <div className={styles.desktopLessonGrid} data-course-grid aria-busy={incomplete && status !== 'error'}>
          {lessons.map(lesson => renderLesson(selected, lesson))}
        </div> : !incomplete ? <p className={styles.lessonEmpty}>课时准备中</p> : null}
      </section>
    </div>
  )
}

export function CourseCatalogSkeleton() {
  return <div aria-hidden="true">
    <div className="md:hidden">
      <Skeleton className="h-[150px] rounded-[22px]" />
      {[0, 1, 2].map(index => <div key={index} className={styles.lessonSection}>
        <div className={styles.lessonHeader}><Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="flex-1 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-24" /></div>
        </div>
        <div className="overflow-hidden"><div className={styles.lessonRail}>
          {Array.from({ length: 8 }).map((_, tile) => <div key={tile} className={styles.lessonTile}>
            <Skeleton className={styles.lessonThumb} /><Skeleton className="h-4 w-20" />
          </div>)}
        </div></div>
      </div>)}
    </div>
    <div className={`${styles.desktopCatalog} hidden md:block`}>
      <div className={styles.courseTabs}>{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-11 w-36 rounded-full" />)}</div>
      <div className={styles.desktopCourseSummary}><div className="space-y-2"><Skeleton className="h-6 w-44" /><Skeleton className="h-4 w-24" /></div></div>
      <div className={styles.desktopLessonGrid}>
        {Array.from({ length: 12 }).map((_, index) => <div key={index} className={styles.lessonTile}>
          <Skeleton className={styles.lessonThumb} /><Skeleton className="h-4 w-24" />
        </div>)}
      </div>
    </div>
  </div>
}
