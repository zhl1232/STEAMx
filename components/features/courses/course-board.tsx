import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CompactCardSkeleton } from '@/components/ui/loading-skeleton'
import type { CourseListItem } from '@/lib/courses/types'
import { CourseHub } from './course-hub'
import type { CourseFilter } from './course-catalog'

// 保留已有调用方的纯函数入口，不让服务端导入客户端筛选逻辑。
export { isBrickCourse, partitionCourseGroups } from './course-catalog'

export function CourseBoard({ courses, initialFilter = 'recommended' }: {
  courses: CourseListItem[]; initialFilter?: CourseFilter
}) {
  // 同一路由切换积木/编程时重新初始化，不能沿用上一方向的本地筛选。
  return <CourseHub key={initialFilter} courses={courses} initialFilter={initialFilter} />
}

export function CourseBoardSkeleton() {
  return (
    <div className="grid gap-3 pt-3 pb-5 md:grid-cols-2 md:gap-4 md:p-6">
      {Array.from({ length: 4 }).map((_, i) => <CompactCardSkeleton key={i} />)}
    </div>
  )
}

export function CourseBoardError({ message = '课程加载失败，请稍后重试。', retryHref }: {
  message?: string; retryHref: string
}) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <p>{message}</p>
      <Button asChild variant="outline" className="mt-4"><Link href={retryHref}>重试</Link></Button>
    </div>
  )
}
