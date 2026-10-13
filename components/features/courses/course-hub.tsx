'use client'

import Link from 'next/link'
import { memo, useMemo, useState } from 'react'
import { Blocks, BookOpen, ChevronRight, Compass, FlaskConical, Leaf, Lightbulb } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { ContentClassification } from '@/components/ui/content-classification'
import type { CourseListItem } from '@/lib/courses/types'
import { cn } from '@/lib/utils'
import {
  COURSE_CATEGORY_LABELS, getCourseAction, getCourseCategory, isLearningCourse, selectCourseCatalog,
  type CourseCategory,
} from './course-catalog'
import styles from './course-hub.module.css'


// 数据库里的旧封面地址在代码侧换成新图，不改线上数据。
const COVER_OVERRIDES: Record<string, string> = {
  '/api/assets/courses/scratch-original/v1/cover.svg': '/assets/courses/scratch-course-cover.svg',
}

function CourseCover({ course, priority }: { course: CourseListItem; priority: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const raw = course.image_url?.trim() || null
  const src = raw ? COVER_OVERRIDES[raw] ?? raw : null
  return (
    <div className={styles.cover} data-category={getCourseCategory(course)}>
      {src && failedSrc !== src ? (
        <OptimizedImage src={src} alt="" fill priority={priority} variant="thumbnail"
          sizes="(min-width: 768px) 104px, 84px" className={styles.coverImage}
          onError={() => setFailedSrc(src)} />
      ) : (
        <span className={styles.coverFallback} role="img" aria-label={`${course.title}：暂无封面`}>
          {getCourseCategory(course) === 'brick' ? <Blocks size={28} aria-hidden="true" /> : <BookOpen size={28} aria-hidden="true" />}
          <span>暂无封面</span>
        </span>
      )}
    </div>
  )
}

const CourseCard = memo(function CourseCard({ course, featured = false, priority = false }: {
  course: CourseListItem; featured?: boolean; priority?: boolean
}) {
  const category = getCourseCategory(course)
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
        <p className={styles.metadata}><BookOpen size={12} aria-hidden="true" />{course.lesson_count} 课时</p>
        <ContentClassification classification={course.classification} variant="card" className={styles.classification} />
        <div className={styles.cardBottom}>
          {learning && progress ? (
            <div className={styles.progress}>
              <span>{progress.completed_lesson_count}/{progress.total_lesson_count}</span>
              <div role="progressbar" aria-label={`${course.title}学习进度`} aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={percent} aria-valuetext={`已完成 ${progress.completed_lesson_count} / ${progress.total_lesson_count} 课时`}
                className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>
            </div>
          ) : <span className={styles.modeLabel}>{completed ? '已完成' : course.lesson_count === 0 ? '内容准备中' : category === 'brick' ? '积木搭建' : '分步学习'}</span>}
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
  // 课程不多，不分类筛选，全部列出（积木课在前）。
  const learning = useMemo(() => courses.filter(isLearningCourse), [courses])
  // 无进度时不虚构「继续学习」；接口暂无最近学习时间，按原顺序取一个入口。
  const featured = learning[0]
  const visible = useMemo(() => selectCourseCatalog(courses, 'recommended').filter(course => course.id !== featured?.id), [courses, featured?.id])
  const title = featured ? '其他课程' : '全部课程'
  return (
    <div className={styles.hub} data-course-hub>
      {courses.length > 0 ? <>
        {featured ? <section className={styles.section} aria-labelledby="course-continue-heading">
          <div className={styles.sectionHeading}><h2 id="course-continue-heading">继续学习</h2></div>
          <div className={styles.cardGrid}><CourseCard course={featured} featured priority /></div>
        </section> : null}
        {visible.length > 0 ? <section className={styles.section} aria-labelledby="course-catalog-heading" id="course-catalog">
          <div className={styles.sectionHeading}><h2 id="course-catalog-heading">{title}</h2></div>
          <p className="sr-only" role="status">{title}，共 {visible.length} 门</p>
          <div className={styles.cardGrid}>
            {visible.map((course, index) => <CourseCard key={course.id} course={course} priority={!featured && index === 0} />)}
          </div>
        </section> : null}
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
