'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { CourseListItem, CoursePreviewLesson } from '@/lib/courses/types'
import { Skeleton } from '@/components/ui/skeleton'
import { getCourseCategory, type CourseCategory } from './course-catalog'
import styles from './course-hub.module.css'

const BATCH = 12
const STORAGE_KEY = 'courses:mobile-view:v1'
const CATEGORY_SHORTCUTS: Array<{ category: CourseCategory; label: string }> = [
  { category: 'brick', label: '积木' },
  { category: 'programming', label: '编程' },
  { category: 'strategy', label: '棋类' },
]
type RailView = { count: number; x: number }
type Saved = { selected: number; rails: Record<number, RailView>; y: number }
type RenderLesson = (course: CourseListItem, lesson: CoursePreviewLesson) => ReactNode

function readSaved(): Saved | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    if (!Number.isInteger(value?.selected) || !value.rails || typeof value.rails !== 'object' || !Number.isFinite(value.y)) return null
    const rails: Record<number, RailView> = {}
    for (const [id, view] of Object.entries(value.rails) as [string, RailView][]) {
      if (Number.isSafeInteger(Number(id)) && view && Number.isFinite(view.count) && Number.isFinite(view.x)) {
        rails[Number(id)] = { count: Math.max(0, Math.min(1000, Math.trunc(view.count))), x: Math.max(0, view.x) }
      }
    }
    return { selected: value.selected, rails, y: Math.max(0, value.y) }
  } catch { return null }
}

function ageLine(course: CourseListItem) {
  if (course.classification?.ageLabel) return course.classification.ageLabel
  for (const [grade, age] of [['小班', '3 岁起'], ['中班', '4 岁起'], ['大班', '5 岁起']]) {
    if (course.title.includes(grade)) return age
  }
  return null
}

function CourseRail({ course, theme, saved, renderLesson, remember }: {
  course: CourseListItem
  theme: string
  saved?: RailView
  renderLesson: RenderLesson
  remember: (courseId: number, view: RailView) => void
}) {
  const preview = course.preview_lessons ?? []
  const initialCount = Math.max(Math.min(preview.length, 8), Math.min(saved?.count ?? 0, course.lesson_count))
  const [count, setCount] = useState(initialCount)
  const [lessons, setLessons] = useState<CoursePreviewLesson[] | null>(preview.length >= course.lesson_count ? preview : null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const rail = useRef<HTMLDivElement>(null)
  const request = useRef<AbortController | null>(null)
  const restoring = useRef(true)
  const currentCount = useRef(count)
  const total = lessons?.length ?? course.lesson_count
  const shown = (lessons ?? preview).slice(0, count)
  const placeholders = Math.max(0, count - shown.length)
  const hasMore = count < total
  const headingId = `course-${course.id}-heading`
  const railId = `course-${course.id}-rail`
  const [edges, setEdges] = useState({ previous: false, next: false })
  const updateEdges = useCallback(() => {
    const element = rail.current
    if (!element) return
    const previous = element.scrollLeft > 1
    const next = element.scrollWidth - element.clientWidth - element.scrollLeft > 1
    setEdges(current => current.previous === previous && current.next === next ? current : { previous, next })
  }, [])

  async function moveRail(direction: number) {
    const element = rail.current
    if (!element) return
    if (direction > 0 && !edges.next && hasMore && !error) await loadMore()
    requestAnimationFrame(() => {
      element.scrollBy({ left: direction * Math.max(164, element.clientWidth * 0.85),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    })
  }

  useEffect(() => {
    updateEdges()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges)
    if (rail.current) observer?.observe(rail.current)
    window.addEventListener('resize', updateEdges)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateEdges)
    }
  }, [count, updateEdges])

  async function loadMore(expand = true) {
    if (request.current) return
    if (lessons) {
      if (expand) setCount(current => Math.min(current + BATCH, lessons.length))
      return
    }
    if (preview.length >= course.lesson_count) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(false)
    try {
      const response = await fetch(`/api/courses/${course.id}/catalog`, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw new Error('catalog unavailable')
      const data = await response.json()
      if (!Array.isArray(data.lessons)) throw new Error('invalid catalog')
      if (controller.signal.aborted) return
      setLessons(data.lessons)
      setCount(current => Math.min(expand ? current + BATCH : current, data.lessons.length))
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // Only a previously expanded rail is read again on return; unseen rails use previews.
    if (initialCount > preview.length) void loadMore(false)
    const frame = requestAnimationFrame(() => {
      if (rail.current) {
        rail.current.scrollLeft = saved?.x ?? 0
        remember(course.id, { count: currentCount.current, x: rail.current.scrollLeft })
      }
      restoring.current = false
    })
    return () => {
      cancelAnimationFrame(frame)
      request.current?.abort()
      request.current = null
    }
    // Each rail is keyed by course and its initial saved position is used once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    currentCount.current = count
    remember(course.id, { count, x: rail.current?.scrollLeft ?? 0 })
  }, [count, course.id, remember])

  return (
    <section id={`course-section-${course.id}`} className={styles.lessonSection} data-course-id={course.id} data-course-theme={theme} aria-labelledby={headingId}>
      <div className={styles.lessonHeader}>
        {theme !== 'other' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/courses/icons/${theme}.webp`} alt="" width={46} height={46} className={styles.courseIcon} onError={event => { event.currentTarget.hidden = true }} />
        ) : null}
        <div className={styles.lessonHeaderText}>
          <h2 id={headingId}>{course.title}</h2>
          <p>{[ageLine(course), `${course.lesson_count} 课`].filter(Boolean).join(' · ')}</p>
        </div>
        {shown.length > 0 || placeholders > 0 || hasMore ? (
          <div className={styles.railControls} role="group" aria-label={`${course.title}浏览控制`}>
            <button type="button" aria-label={`${course.title}：向前浏览`} aria-controls={railId}
              disabled={!edges.previous} onClick={() => { void moveRail(-1) }}><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" aria-label={`${course.title}：向后浏览`} aria-controls={railId}
              disabled={loading || (!edges.next && (!hasMore || error))} onClick={() => { void moveRail(1) }}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
        ) : null}
      </div>
      {shown.length > 0 || placeholders > 0 || hasMore ? (
        <div className={styles.lessonRailWrap}>
          <div id={railId} ref={rail} className={styles.lessonRail} data-lesson-rail data-course-rail role="region" aria-label={`${course.title}课时`} tabIndex={0}
            onScroll={event => {
              const element = event.currentTarget
              updateEdges()
              remember(course.id, { count: currentCount.current, x: element.scrollLeft })
              if (!restoring.current && !error && hasMore && element.scrollLeft > 0 && element.scrollWidth - element.clientWidth - element.scrollLeft <= 300) void loadMore()
            }}>
            {shown.map(lesson => renderLesson(course, lesson))}
            {Array.from({ length: placeholders }, (_, index) => (
              <span key={`placeholder-${index}`} className={styles.lessonTile} aria-hidden="true">
                <Skeleton className={styles.lessonThumb} />
                <span className={styles.lessonTitle} style={{ minHeight: '2.8em' }} />
              </span>
            ))}
            {hasMore || error ? (
              <div className={styles.railMore}>
                <button type="button" aria-label={`${course.title}：加载更多课时`} disabled={loading} onClick={() => { void loadMore() }}>
                  {loading ? '加载中…' : error ? '重试加载' : '加载更多课时'}
                </button>
                {error ? <span role="alert">课时加载失败</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : <p className={styles.lessonEmpty}>课时准备中</p>}
    </section>
  )
}

export function MobileCourseCatalog({ courses, hero, renderLesson, themeFor, initialCourseId }: {
  courses: CourseListItem[]
  initialCourseId?: number
  hero: ReactNode
  renderLesson: RenderLesson
  themeFor: (course: CourseListItem) => string
}) {
  // The server and first client render both use previews; restore browser state after hydration.
  const [saved, setSaved] = useState<Saved | null>(null)
  const views = useRef<Record<number, RailView>>({})
  const selected = useRef(initialCourseId ?? courses[0]?.id ?? 0)
  useEffect(() => {
    const restored = readSaved()
    if (restored) {
      views.current = { ...restored.rails }
      selected.current = initialCourseId ?? restored.selected
      setSaved(restored)
    }
  }, [initialCourseId])
  const remember = useCallback((courseId: number, view: RailView) => { views.current[courseId] = view }, [])
  const save = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ selected: selected.current, rails: views.current, y: window.scrollY }))
    } catch { /* Storage is optional. */ }
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (initialCourseId) {
        const section = document.getElementById(`course-section-${initialCourseId}`)
        if (section) window.scrollTo({ top: Math.max(0, section.getBoundingClientRect().top + window.scrollY - 80), behavior: 'instant' })
      } else if (saved) window.scrollTo({ top: saved.y, behavior: 'instant' })
    })
    window.addEventListener('pagehide', save)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pagehide', save)
    }
  }, [save, saved, initialCourseId])

  if (courses.length === 0) return <div className={styles.empty}>技能课程即将上线，敬请期待。</div>
  return (
    <div className={styles.hub} data-course-hub data-mobile-courses onClickCapture={event => {
      const target = event.target
      if (!(target instanceof Element)) return
      const href = target.closest('a')?.getAttribute('href')
      const match = href?.match(/^\/courses\/(\d+)\/lessons\//)
      if (match) {
        selected.current = Number(match[1])
        save()
      }
    }}>
      {hero}
      <nav className={styles.categoryShortcuts} aria-label="课程分类定位">
        {CATEGORY_SHORTCUTS.map(({ category, label }) => {
          const firstCourse = courses.find(course => getCourseCategory(course) === category)
          return firstCourse ? <a key={category} href={`#course-section-${firstCourse.id}`}>
            {label}<ArrowDown size={14} aria-hidden="true" />
          </a> : null
        })}
      </nav>
      {courses.map(course => <CourseRail key={`${course.id}-${saved ? 'restored' : 'preview'}`} course={course} theme={themeFor(course)} saved={saved?.rails[course.id]} renderLesson={renderLesson} remember={remember} />)}
    </div>
  )
}
