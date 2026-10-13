import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CourseListItem } from '@/lib/courses/types'
import { CourseBoard, CourseBoardError, isBrickCourse, partitionCourseGroups } from './course-board'
import { getCourseAction, getCourseCategory, selectCourseCatalog } from './course-catalog'

vi.mock('next/link', () => ({
  default: ({ prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => <a {...props} />,
}))
vi.mock('next/image', () => ({
  default: ({ priority: _priority, ...props }: ComponentProps<'img'> & { priority?: boolean }) => <img {...props} />,
}))
vi.mock('@/components/ui/optimized-image', () => ({
  OptimizedImage: ({ fill: _fill, priority: _priority, variant: _variant, ...props }: ComponentProps<'img'> & { fill?: boolean; priority?: boolean; variant?: string }) => <img {...props} />,
}))
afterEach(cleanup)

function makeCourse(overrides: Partial<CourseListItem> = {}): CourseListItem {
  return {
    id: 1, title: '示例课程', description: '跟着步骤完成一个作品。', image_url: null,
    tags: [], status: 'approved', sort_order: 1, steam_weights: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    lesson_count: 100, progress: null, ...overrides,
  }
}
function learningCourse(id = 1): CourseListItem {
  return makeCourse({ id, title: `积木课程 ${id}`, tags: ['积木'], progress: {
    completed_lesson_count: 10, total_lesson_count: 100, status: 'in_progress', next_lesson_id: 30, milestone_completed_at: null,
  } })
}

const catalog = [
  learningCourse(1),
  makeCourse({ id: 2, title: '中班大颗粒积木', tags: ['得宝'] }),
  makeCourse({ id: 3, title: 'Scratch 创意编程', tags: ['Scratch', '编程'], lesson_count: 48 }),
  makeCourse({ id: 4, title: '五子棋博弈论入门', tags: ['五子棋'], lesson_count: 8 }),
]

describe('课程目录数据契约', () => {
  it('保留积木标签识别和原有分组顺序', () => {
    expect(isBrickCourse(makeCourse({ tags: ['乐高', '得宝'] }))).toBe(true)
    expect(isBrickCourse(makeCourse({ tags: null }))).toBe(false)
    const groups = partitionCourseGroups([catalog[2], catalog[0], catalog[3], catalog[1]])
    expect(groups.brick.map(item => item.id)).toEqual([1, 2])
    expect(groups.other.map(item => item.id)).toEqual([3, 4])
  })
  it('Scratch 的图形化积木不误归入实体积木，其他课程不丢失', () => {
    expect(getCourseCategory(makeCourse({ title: 'Scratch 积木', tags: ['积木'] }))).toBe('programming')
    expect(getCourseCategory(makeCourse({ title: '绘画' }))).toBe('other')
    expect(selectCourseCatalog(catalog, 'all').map(item => item.id)).toEqual([1, 2, 3, 4])
    expect(catalog).toHaveLength(4)
  })
  it('继续学习跳转真实下一课时；缺少下一课时时回课程目录', () => {
    expect(getCourseAction(learningCourse())).toEqual({ label: '继续学习', href: '/courses/1/lessons/30' })
    const course = learningCourse()
    expect(getCourseAction({ ...course, progress: { ...course.progress!, next_lesson_id: null } }).href).toBe('/courses/1')
  })
  it('已完成和零课时分别回顾/查看，不生成假的开始入口', () => {
    const course = learningCourse()
    expect(getCourseAction({ ...course, progress: { ...course.progress!, status: 'completed' } })).toEqual({ label: '回顾课程', href: '/courses/1' })
    expect(getCourseAction({ ...course, lesson_count: 0 })).toEqual({ label: '查看课程', href: '/courses/1' })
  })
})

describe('真实课程组件', () => {
  it('在学入口前置且不与推荐区重复；进度来自传入数据', () => {
    const { container } = render(<CourseBoard courses={catalog} />)
    const section = screen.getByRole('region', { name: '继续学习' })
    expect(within(section).getByRole('link', { name: '继续学习：积木课程 1' })).toHaveAttribute('href', '/courses/1/lessons/30')
    expect(within(section).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10')
    expect(within(section).getByText('10/100')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-course-id="1"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-course-id]')).toHaveLength(4)
    expect(screen.queryByText('适合 3-4 岁')).not.toBeInTheDocument()
    expect(screen.queryByText('推荐起步')).not.toBeInTheDocument()
  })
  it('编程/积木/全部是真实筛选，全部恢复完整目录', () => {
    const { container } = render(<CourseBoard courses={catalog} />)
    const tabs = within(screen.getByRole('group', { name: '课程分类' }))
    fireEvent.click(tabs.getByRole('button', { name: '编程' }))
    expect(container.querySelectorAll('[data-course-id]')).toHaveLength(1)
    expect(screen.getByRole('link', { name: '开始学习：Scratch 创意编程' })).toHaveAttribute('href', '/courses/3')
    fireEvent.click(tabs.getByRole('button', { name: '积木搭建' }))
    expect(container.querySelectorAll('[data-course-id]')).toHaveLength(2)
    fireEvent.click(tabs.getByRole('button', { name: '全部' }))
    expect(container.querySelectorAll('[data-course-id]')).toHaveLength(4)
    expect(tabs.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('在学课程入口显示所有未完成的学习，而非虚构最近学习', () => {
    const { container } = render(<CourseBoard courses={[...catalog, learningCourse(5)]} />)
    fireEvent.click(screen.getByRole('button', { name: '在学课程 2' }))
    expect(screen.getByRole('heading', { name: '在学课程' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-course-id]')).toHaveLength(2)
    expect(screen.queryByText(/最近学习/)).not.toBeInTheDocument()
  })
  it.each([null, { completed_lesson_count: 0, total_lesson_count: 100, status: 'not_started' as const, next_lesson_id: 30, milestone_completed_at: null }])('匿名或未开始不伪造个人进度', progress => {
    render(<CourseBoard courses={[makeCourse({ progress })]} />)
    expect(screen.queryByRole('region', { name: '继续学习' })).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '开始学习：示例课程' })).toHaveAttribute('href', '/courses/1')
  })
  it('完成课程保留回顾入口，不出现在继续学习区', () => {
    const course = learningCourse()
    render(<CourseBoard courses={[{ ...course, progress: { ...course.progress!, status: 'completed', completed_lesson_count: 100 } }]} />)
    expect(screen.getByRole('link', { name: '回顾课程：积木课程 1' })).toHaveAttribute('href', '/courses/1')
    expect(screen.queryByRole('region', { name: '继续学习' })).not.toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()
  })
  it('封面失败显示占位，更新图片后恢复，不使用别的课程图', () => {
    const course = makeCourse({ image_url: '/broken.webp' })
    vi.useFakeTimers()
    const { container, rerender } = render(<CourseBoard courses={[course]} />)
    // 先自动重试两次（带 retry 参数），仍失败才显示占位。
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      fireEvent.error(container.querySelector('[data-course-id] img')!)
      act(() => { vi.advanceTimersByTime(600 * attempt) })
      expect(container.querySelector('[data-course-id] img')!.getAttribute('src')).toContain(`retry=${attempt}`)
    }
    fireEvent.error(container.querySelector('[data-course-id] img')!)
    vi.useRealTimers()
    expect(screen.getByRole('img', { name: '示例课程：暂无封面' })).toBeInTheDocument()
    expect(container.querySelector('img[src="/projects/tech_programming.webp"]')).toBeNull()
    rerender(<CourseBoard courses={[{ ...course, image_url: '/fixed.webp' }]} />)
    expect(container.querySelector('[data-course-id] img')).toHaveAttribute('src', '/fixed.webp')
  })
  it('更多学习方向指向真实页面而非弹出预览说明', () => {
    render(<CourseBoard courses={catalog} />)
    const directions = within(screen.getByRole('region', { name: '更多学习方向' }))
    expect(directions.getByRole('link', { name: /科学实验/ })).toHaveAttribute('href', '/learn/science')
    expect(directions.getByRole('link', { name: /自然观察/ })).toHaveAttribute('href', '/learn/nature')
    expect(directions.getByRole('link', { name: /动手项目/ })).toHaveAttribute('href', '/explore')
  })
  it('目录为空仍显示明确空状态和探索方向', () => {
    render(<CourseBoard courses={[]} />)
    expect(screen.getByText('技能课程即将上线，敬请期待。')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '课程分类' })).not.toBeInTheDocument()
  })
  it('请求失败保留重试，不伪装为空目录', () => {
    render(<CourseBoardError retryHref="/courses" />)
    expect(screen.getByText('课程加载失败，请稍后重试。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '重试' })).toHaveAttribute('href', '/courses')
  })
})
