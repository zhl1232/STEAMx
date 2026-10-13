'use client'

import Link from 'next/link'
import { memo, useMemo, useState } from 'react'
import { Blocks, BookOpen, ChevronRight, Compass, FlaskConical, Leaf, Lightbulb } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/optimized-image'
import type { CourseListItem } from '@/lib/courses/types'
import { cn } from '@/lib/utils'
import {
  COURSE_CATEGORY_LABELS, getCourseAction, getCourseCategory, isLearningCourse, selectCourseCatalog,
  type CourseCategory, type CourseFilter,
} from './course-catalog'
import styles from './course-hub.module.css'

const CATEGORY_ORDER: CourseCategory[] = ['brick', 'programming', 'strategy', 'other']

// 数据库里的旧封面地址在代码侧换成新图，不改线上数据。
const COVER_OVERRIDES: Record<string, string> = {
  '/api/assets/courses/scratch-original/v1/cover.svg': '/assets/courses/scratch-course-cover.svg',
}

function withRetry(src: string, attempt: number) {
  if (attempt === 0) return src
  return `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`
}

/** 封面加载失败时自动重试两次（600ms、1200ms 退避），仍失败才显示「暂无封面」。 */
function CourseCover({ course, priority }: { course: CourseListItem; priority: boolean }) {
  const raw = course.image_url?.trim() || null
  const baseSrc = raw ? COVER_OVERRIDES[raw] ?? raw : null
  const [state, setState] = useState<{ src: string | null; attempt: number; failed: boolean }>({ src: null, attempt: 0, failed: false })
  const attempt = state.src === baseSrc ? state.attempt : 0
  const failed = state.src === baseSrc && state.failed
  return (
    <div className={styles.cover} data-category={getCourseCategory(course)}>
      {baseSrc && !failed ? (
        <OptimizedImage key={attempt} src={withRetry(baseSrc, attempt)} alt="" fill priority={priority} variant="thumbnail"
          sizes="(min-width: 768px) 104px, 100px" className={styles.coverImage}
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

// 积木课数据里没有年龄分级，按班级在代码里补；不改线上数据。
const BRICK_AGE_BY_GRADE: Array<[string, string]> = [['小班', '3 岁起'], ['中班', '4 岁起'], ['大班', '5 岁起']]

/** 只显示年龄和难度，不显示陪同/学习方式这类说明。 */
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
        {learning && progress ? (
          <div className={styles.progress}>
            <div role="progressbar" aria-label={`${course.title}学习进度`} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={percent} aria-valuetext={`已完成 ${progress.completed_lesson_count} / ${progress.total_lesson_count} 课时`}
              className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>
            <span>{progress.completed_lesson_count}/{progress.total_lesson_count}</span>
          </div>
        ) : null}
        <div className={styles.cardBottom}>
          {!learning ? <span className={styles.modeLabel}>{completed ? '已完成' : course.lesson_count === 0 ? '内容准备中' : ''}</span> : null}
          <Link href={action.href} prefetch={false} aria-label={`${action.label}：${course.title}`}
            className={cn(styles.action, featured && styles.primaryAction)}>
            {action.label}<ChevronRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
})

export function CourseHub({ courses }: { courses: CourseListItem[] }) {
  const [filter, setFilter] = useState<CourseFilter>('recommended')
  const available = useMemo(() => CATEGORY_ORDER.filter(category => courses.some(course => getCourseCategory(course) === category)), [courses])
  const learning = useMemo(() => courses.filter(isLearningCourse), [courses])
  // 无进度时不虚构「继续学习」；接口暂无最近学习时间，按原顺序取一个入口。
  const featured = filter === 'recommended' ? learning[0] : undefined
  const visible = useMemo(() => selectCourseCatalog(courses, filter).filter(course => course.id !== featured?.id), [courses, filter, featured?.id])
  const title = filter === 'recommended' ? '推荐课程' : filter === 'all' ? '全部课程' : filter === 'learning' ? '在学课程' : COURSE_CATEGORY_LABELS[filter]
  const filters: Array<{ key: CourseFilter; label: string }> = [
    { key: 'recommended', label: '推荐' },
    ...available.map(key => ({ key, label: COURSE_CATEGORY_LABELS[key] })),
    { key: 'all', label: '全部' },
  ]
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
      <section className={styles.directions} aria-labelledby="course-directions-heading">
        <div className={styles.sectionHeading}><h2 id="course-directions-heading">更多学习方向</h2>
        </div>
        <div className={styles.directionGrid}>
          <Link href="/learn/science"><FlaskConical aria-hidden="true" /><strong>科学实验</strong><span>找个小实验</span></Link>
          <Link href="/learn/nature"><Leaf aria-hidden="true" /><strong>自然观察</strong><span>去发现自然</span></Link>
          <Link href="/explore"><Lightbulb aria-hidden="true" /><strong>动手项目</strong><span>挑个项目做</span></Link>
          <Link href="/start"><Compass aria-hidden="true" /><strong>入门指南</strong><span>找到起点</span></Link>
        </div>
      </section>
    </div>
  )
}
