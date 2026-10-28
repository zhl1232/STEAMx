'use client'

import Link from 'next/link'
import { memo, useEffect, useMemo, useState } from 'react'
import { Blocks, BookOpen, Check, ChevronRight, Play, Compass, FlaskConical, Leaf, Lightbulb } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/optimized-image'
import type { CourseListItem, CoursePreviewLesson } from '@/lib/courses/types'
import { cn } from '@/lib/utils'
import {
  COURSE_CATEGORY_LABELS, getCourseAction, getCourseCategory, isLearningCourse, selectCourseCatalog,
  type CourseCategory, type CourseFilter,
} from './course-catalog'
import styles from './course-hub.module.css'

const CATEGORY_ORDER: CourseCategory[] = ['brick', 'programming', 'strategy', 'other']

const COVER_OVERRIDES: Record<string, string> = {
  '/api/assets/courses/scratch-original/v1/cover.svg': '/assets/courses/scratch-course-cover.svg',
}

const BRICK_GRADE_SECTIONS: Array<{ key: string; label: string; test: (title: string) => boolean }> = [
  { key: 'xiaoban', label: '小班（3 岁起）', test: (t) => t.includes('小班') },
  { key: 'zhongban', label: '中班（4 岁起）', test: (t) => t.includes('中班') },
  { key: 'daban', label: '大班（5 岁起）', test: (t) => t.includes('大班') },
]

function withRetry(src: string, attempt: number) {
  if (attempt === 0) return src
  return `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`
}

function CourseCover({ course, priority, compact = false }: { course: CourseListItem; priority: boolean; compact?: boolean }) {
  const raw = course.image_url?.trim() || null
  const baseSrc = raw ? COVER_OVERRIDES[raw] ?? raw : null
  const [state, setState] = useState<{ src: string | null; attempt: number; failed: boolean }>({ src: null, attempt: 0, failed: false })
  const attempt = state.src === baseSrc ? state.attempt : 0
  const failed = state.src === baseSrc && state.failed
  return (
    <div className={cn(styles.cover, compact && styles.coverCompact)} data-category={getCourseCategory(course)}>
      {baseSrc && !failed ? (
        <OptimizedImage key={attempt} src={withRetry(baseSrc, attempt)} alt="" fill priority={priority} variant="thumbnail"
          sizes={compact ? '(max-width: 767px) 148px, 104px' : '(min-width: 768px) 104px, 100px'} className={styles.coverImage}
          onError={() => {
            if (attempt < 2) window.setTimeout(() => setState({ src: baseSrc, attempt: attempt + 1, failed: false }), 600 * (attempt + 1))
            else setState({ src: baseSrc, attempt, failed: true })
          }} />
      ) : (
        <span className={styles.coverFallback} role="img" aria-label={`${course.title}：暂无封面`}>
          {getCourseCategory(course) === 'brick' ? <Blocks size={28} aria-hidden="true" /> : <BookOpen size={28} aria-hidden="true" />}
          <span>暂无封面</span>
        </span>
      )}
    </div>
  )
}

const BRICK_AGE_BY_GRADE: Array<[string, string]> = [['小班', '3 岁起'], ['中班', '4 岁起'], ['大班', '5 岁起']]

function getAgeLine(course: CourseListItem) {
  const c = course.classification
  if (c) return [c.ageLabel, c.difficultyLabel].filter(Boolean).join(' · ')
  return BRICK_AGE_BY_GRADE.find(([grade]) => course.title.includes(grade))?.[1] ?? null
}

const CourseCard = memo(function CourseCard({ course, featured = false, priority = false }: {
  course: CourseListItem; featured?: boolean; priority?: boolean
}) {
  const category = getCourseCategory(course)
  const ageLine = getAgeLine(course)
  const action = getCourseAction(course)
  const progress = course.progress
  const learning = isLearningCourse(course)
  const completed = course.lesson_count > 0 && progress?.status === 'completed'
  const percent = progress && progress.total_lesson_count > 0
    ? Math.max(0, Math.min(100, Math.round(progress.completed_lesson_count / progress.total_lesson_count * 100))) : 0
  return (
    <article className={cn(styles.card, featured && styles.featured)} data-course-id={course.id}>
      <CourseCover course={course} priority={priority} />
      <div className={styles.cardBody}>
        <span className={styles.category} data-category={category}>{COURSE_CATEGORY_LABELS[category]}</span>
        <h3 className={styles.courseTitle}>
          <Link href={`/courses/${course.id}`} prefetch={false} title={course.title}>{course.title}</Link>
        </h3>
        <p className={styles.metadata}><BookOpen size={12} aria-hidden="true" />{[`${course.lesson_count} 课时`, ageLine].filter(Boolean).join(' · ')}</p>
        <div className={styles.cardBottom}>
          {learning && progress ? (
            <div className={styles.progress}>
              <div role="progressbar" aria-label={`${course.title}学习进度`} aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={percent} aria-valuetext={`已完成 ${progress.completed_lesson_count} / ${progress.total_lesson_count} 课时`}
                className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>
              <span>{progress.completed_lesson_count}/{progress.total_lesson_count}</span>
            </div>
          ) : <span className={styles.modeLabel}>{completed ? '已完成' : course.lesson_count === 0 ? '内容准备中' : ''}</span>}
          <Link href={action.href} prefetch={false} aria-label={`${action.label}：${course.title}`}
            className={cn(styles.action, featured && styles.primaryAction)}>
            {action.label}<ChevronRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
})

type CourseTheme = 'xiaoban' | 'zhongban' | 'daban' | 'scratch' | 'gomoku' | 'other'

function getCourseTheme(course: CourseListItem): CourseTheme {
  const category = getCourseCategory(course)
  if (category === 'brick') return (BRICK_GRADE_SECTIONS.find((s) => s.test(course.title))?.key as CourseTheme | undefined) ?? 'other'
  if (category === 'programming') return 'scratch'
  if (category === 'strategy') return 'gomoku'
  return 'other'
}

function CourseIcon({ theme }: { theme: CourseTheme }) {
  const [failed, setFailed] = useState(false)
  if (theme === 'other' || failed) return null
  // 小图标为本地静态 webp，直接用原生 img 避免再走图片优化
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/courses/icons/${theme}.webp`} alt="" width={46} height={46} className={styles.courseIcon} onError={() => setFailed(true)} />
}

function LessonTileImage({ lesson, theme }: { lesson: CoursePreviewLesson; theme: CourseTheme }) {
  const [load, setLoad] = useState({ attempt: 0, failed: false })
  if (lesson.image_url && !load.failed) {
    const { attempt } = load
    return (
      <span className={styles.lessonThumb} data-kind="photo">
        <OptimizedImage key={attempt} src={withRetry(lesson.image_url, attempt)} alt="" fill variant="thumbnail" sizes="104px"
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

function CourseLessonSection({ course }: { course: CourseListItem }) {
  const theme = getCourseTheme(course)
  const age = getAgeLine(course)?.split(' · ')[0]
  const headingId = `course-${course.id}-heading`
  const lessons = course.preview_lessons ?? []
  return (
    <section className={styles.lessonSection} aria-labelledby={headingId} data-course-id={course.id} data-course-theme={theme}>
      <div className={styles.lessonHeader}>
        <CourseIcon theme={theme} />
        <div className={styles.lessonHeaderText}>
          <h2 id={headingId}>{course.title}</h2>
          <p>{[age, `${course.lesson_count} 课`].filter(Boolean).join(' · ')}</p>
        </div>
        <Link href={`/courses/${course.id}`} prefetch={false} className={styles.allLessons}
          aria-label={`${course.title}：全部 ${course.lesson_count} 课`}>
          全部 {course.lesson_count} 课<ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </div>
      {lessons.length > 0 ? (
        <div className={styles.lessonRailWrap}>
          <div className={styles.lessonRail}>
            {lessons.map((lesson) => <LessonTile key={lesson.id} course={course} lesson={lesson} theme={theme} />)}
          </div>
        </div>
      ) : <p className={styles.lessonEmpty}>课时准备中</p>}
    </section>
  )
}

/** 顶部横幅文案（占位，待定稿后替换；subtitle 留空则不显示） */
export const HERO_COPY = { title: '每一次坚持，都算数。', subtitle: '', emphasis: ['都算数'] }

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

/** 顶部：登录在学显示「继续上次的课」，否则显示插画横幅 */
function MobileCoursesHero({ continueCourse }: { continueCourse?: CourseListItem }) {
  const next = continueCourse?.next_lesson
  if (continueCourse && next) {
    const theme = getCourseTheme(continueCourse)
    const progress = continueCourse.progress
    return (
      <Link href={`/courses/${continueCourse.id}/lessons/${next.id}`} prefetch={false} className={styles.heroContinue}
        data-course-theme={theme} data-continue-card aria-label={`继续上次的课：${continueCourse.title} 第${next.number}课 ${next.title}`}>
        <span className={styles.heroContinueThumb}>
          {next.image_url ? <OptimizedImage src={next.image_url} alt="" fill variant="thumbnail" sizes="88px" className={styles.lessonPhoto} />
            : <span className={styles.lessonNumber}>{String(next.number).padStart(2, '0')}</span>}
        </span>
        <span className={styles.heroContinueBody}>
          <span className={styles.heroContinueLabel}>继续上次的课</span>
          <strong>第{next.number}课 · {next.title}</strong>
          <span className={styles.heroContinueMeta}>
            {continueCourse.title}{progress ? ` · 已学 ${progress.completed_lesson_count}/${progress.total_lesson_count}` : ''}
          </span>
        </span>
        <span className={styles.heroContinueGo} aria-hidden="true"><Play size={18} /></span>
      </Link>
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

function orderMobileCourses(visible: CourseListItem[]) {
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

function useIsMobileCourses() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isMobile
}

function Directions() {
  return (
    <section className={styles.directions} aria-labelledby="course-directions-heading">
      <div className={styles.sectionHeading}><h2 id="course-directions-heading">更多学习方向</h2></div>
      <div className={styles.directionGrid}>
        <Link href="/explore?category=科学"><FlaskConical aria-hidden="true" /><strong>科学实验</strong><span>找个小实验</span></Link>
        <Link href="/nature"><Leaf aria-hidden="true" /><strong>自然观察</strong><span>去发现自然</span></Link>
        <Link href="/explore"><Lightbulb aria-hidden="true" /><strong>动手项目</strong><span>挑个项目做</span></Link>
        <Link href="/start"><Compass aria-hidden="true" /><strong>选一个开始</strong><span>换个方向</span></Link>
      </div>
    </section>
  )
}

function MobileCourseHub({ courses, visible }: { courses: CourseListItem[]; visible: CourseListItem[] }) {
  const ordered = useMemo(() => orderMobileCourses(visible), [visible])
  const continueCourse = useMemo(() => courses.find((c) => isLearningCourse(c) && c.next_lesson), [courses])
  return (
    <div className={styles.hub} data-course-hub data-mobile-courses>
      {courses.length > 0 ? (
        <>
          <MobileCoursesHero continueCourse={continueCourse} />
          {ordered.map((course) => <CourseLessonSection key={course.id} course={course} />)}
        </>
      ) : (
        <div className={styles.empty}><BookOpen size={28} aria-hidden="true" /><p>技能课程即将上线，敬请期待。</p></div>
      )}
      <Directions />
    </div>
  )
}

export function CourseHub({ courses, initialFilter = 'recommended' }: {
  courses: CourseListItem[]; initialFilter?: CourseFilter
}) {
  const isMobile = useIsMobileCourses()
  const [filter, setFilter] = useState<CourseFilter>(initialFilter)
  const available = useMemo(() => CATEGORY_ORDER.filter(category => category === filter || courses.some(course => getCourseCategory(course) === category)), [courses, filter])
  const learning = useMemo(() => courses.filter(isLearningCourse), [courses])
  const featured = filter === 'recommended' ? learning[0] : undefined
  const visible = useMemo(() => selectCourseCatalog(courses, filter).filter(course => course.id !== featured?.id), [courses, filter, featured?.id])
  const title = filter === 'recommended' ? '推荐课程' : filter === 'all' ? '全部课程' : filter === 'learning' ? '在学课程' : COURSE_CATEGORY_LABELS[filter]
  const filters: Array<{ key: CourseFilter; label: string }> = [
    { key: 'recommended', label: '推荐' },
    ...available.map(key => ({ key, label: COURSE_CATEGORY_LABELS[key] })),
    { key: 'all', label: '全部' },
  ]

  if (isMobile) {
    return <MobileCourseHub courses={courses} visible={selectCourseCatalog(courses, filter)} />
  }

  return (
    <div className={styles.hub} data-course-hub>
      {courses.length > 0 ? <>
        <div className={styles.filters} role="group" aria-label="课程分类">
          {filters.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>)}
        </div>
        {featured ? <section className={styles.section} aria-labelledby="course-continue-heading">
          <div className={styles.sectionHeading}><h2 id="course-continue-heading">继续学习</h2>
            {learning.length > 1 ? <button type="button" onClick={() => setFilter('learning')}>在学课程 {learning.length}<ChevronRight size={14} aria-hidden="true" /></button> : null}
          </div>
          <div className={styles.cardGrid}><CourseCard course={featured} featured priority /></div>
        </section> : null}
        <section className={styles.section} aria-labelledby="course-catalog-heading" id="course-catalog">
          <div className={styles.sectionHeading}><h2 id="course-catalog-heading">{title}</h2>
            {filter !== 'all' ? <button type="button" onClick={() => setFilter('all')}>全部课程<ChevronRight size={14} aria-hidden="true" /></button> : null}
          </div>
          <p className="sr-only" role="status">{title}，共 {visible.length} 门</p>
          {visible.length > 0 ? <div className={styles.cardGrid}>
            {visible.map((course, index) => <CourseCard key={course.id} course={course} priority={!featured && index === 0} />)}
          </div> : <div className={styles.empty}>
            <p>{featured ? '其他课程会陆续加入，先继续手上的作品吧。' : '当前没有符合条件的课程。'}</p>
            <button type="button" onClick={() => setFilter('all')}>查看全部课程</button>
          </div>}
        </section>
      </> : <div className={styles.empty}><BookOpen size={28} aria-hidden="true" /><p>技能课程即将上线，敬请期待。</p></div>}
      <Directions />
    </div>
  )
}
