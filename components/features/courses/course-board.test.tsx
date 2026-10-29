import type { ComponentProps } from 'react'
import { renderToString } from 'react-dom/server'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
})
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals() })

function makeCourse(overrides: Partial<CourseListItem> = {}): CourseListItem {
  return {
    id: 1, title: '示例课程', description: '跟着步骤完成一个作品。', image_url: null,
    tags: [], status: 'approved', sort_order: 1, steam_weights: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    lesson_count: 100, progress: null, preview_lessons: [{ id: 101, number: 1, title: '搭建城堡', image_url: '/castle.webp', is_completed: false }], ...overrides,
  }
}
function learningCourse(id = 1): CourseListItem {
  return makeCourse({ id, title: `积木课程 ${id}`, tags: ['积木'], next_lesson: { id: 30, number: 11, title: '搭建风车', image_url: null, is_completed: false }, progress: {
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
    expect(getCourseAction({ ...course, progress: { ...course.progress!, next_lesson_id: null } }).href).toBe('/courses?course=1')
  })
  it('已完成和零课时分别回顾/查看，不生成假的开始入口', () => {
    const course = learningCourse()
    expect(getCourseAction({ ...course, progress: { ...course.progress!, status: 'completed' } })).toEqual({ label: '回顾课程', href: '/courses?course=1' })
    expect(getCourseAction({ ...course, lesson_count: 0 })).toEqual({ label: '查看课程', href: '/courses?course=1' })
  })
})

describe('课程目录服务端内容', () => {
  it('显式课程的服务端 HTML 包含全部课时，同时保留其它课程的可抓取入口', () => {
    const course = { ...catalog[0], lesson_count: 25, preview_lessons: Array.from({ length: 25 }, (_, i) => ({ id: 900 + i, number: i + 1, title: `完整课时${i + 1}`, image_url: null, is_completed: false })) }
    const html = renderToString(<CourseBoard courses={[course, catalog[2]]} initialCourseId={course.id} />)
    expect(html).toContain(`href="/courses/${course.id}/lessons/924"`)
    expect(html).toContain(`href="/courses?course=${catalog[2].id}"`)
    expect((html.match(/data-lesson-id=/g) ?? [])).toHaveLength(25)
  })
  it('无 JavaScript 的服务端 HTML 保留真实课程和预览课时链接，且不请求完整目录', () => {
    const fetchCatalog = vi.fn()
    vi.stubGlobal('fetch', fetchCatalog)
    const html = renderToString(<CourseBoard courses={catalog} />)
    expect(html).toContain('href="/courses?course=2"')
    expect(html).toContain('href="/courses?course=3"')
    expect(html).toContain('href="/courses/2/lessons/101"')
    expect(html).toContain('中班大颗粒积木')
    expect(html).toContain('搭建城堡')
    expect(fetchCatalog).not.toHaveBeenCalled()
  })
})

describe('真实课程组件：手机作品目录', () => {
  it('每门课程都有课时横列，作品直接进入学习且不再出现课程卡片筛选', () => {
    const { container } = render(<CourseBoard courses={catalog} />)
    expect(container.querySelectorAll('section[data-course-id]')).toHaveLength(4)
    expect(screen.getAllByRole('link', { name: '第1课 搭建城堡' }).map(link => link.getAttribute('href')))
      .toEqual(['/courses/2/lessons/101', '/courses/1/lessons/101', '/courses/3/lessons/101', '/courses/4/lessons/101'])
    expect(screen.queryByRole('group', { name: '课程分类' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /开始学习/ })).not.toBeInTheDocument()
  })
  it('在学课程各自保留真实继续入口，课时横列不被移除', () => {
    const { container } = render(<CourseBoard courses={[...catalog, learningCourse(5)]} />)
    const section = screen.getByRole('region', { name: '继续学习' })
    const links = within(section).getAllByRole('link', { name: /^继续学习：/ })
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/courses/1/lessons/30', '/courses/5/lessons/30'])
    expect(within(section).getAllByText(/已学 10\/100/)).toHaveLength(2)
    expect(container.querySelectorAll('section[data-course-id]')).toHaveLength(5)
    expect(screen.queryByText(/最近学习/)).not.toBeInTheDocument()
  })
  it('分类深链接保留限定范围，同路由切换方向重新显示对应课程', () => {
    const { container, rerender } = render(<CourseBoard courses={catalog} initialFilter="brick" />)
    expect(container.querySelectorAll('section[data-course-id]')).toHaveLength(2)
    rerender(<CourseBoard courses={catalog} initialFilter="programming" />)
    expect(container.querySelectorAll('section[data-course-id]')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Scratch 创意编程' })).toBeInTheDocument()
  })
  it.each([null, { completed_lesson_count: 0, total_lesson_count: 100, status: 'not_started' as const, next_lesson_id: 30, milestone_completed_at: null }])('匿名或未开始不伪造个人进度', progress => {
    render(<CourseBoard courses={[makeCourse({ progress })]} />)
    expect(screen.queryByRole('region', { name: '继续学习' })).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '第1课 搭建城堡' })).toHaveAttribute('href', '/courses/1/lessons/101')
  })
  it('已完成课程仍可直接回看课时，不出现在继续学习区', () => {
    const course = learningCourse()
    render(<CourseBoard courses={[{ ...course, progress: { ...course.progress!, status: 'completed', completed_lesson_count: 100 } }]} />)
    expect(screen.getByRole('link', { name: '第1课 搭建城堡' })).toHaveAttribute('href', '/courses/1/lessons/101')
    expect(screen.queryByRole('region', { name: '继续学习' })).not.toBeInTheDocument()
  })
  it('目录为空仍显示明确空状态', () => {
    render(<CourseBoard courses={[]} />)
    expect(screen.getByText('技能课程即将上线，敬请期待。')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '课程分类定位' })).not.toBeInTheDocument()
  })
  it('零课时不生成假的课时链接', () => {
    render(<CourseBoard courses={[makeCourse({ lesson_count: 0, preview_lessons: [] })]} />)
    expect(screen.getByText('课时准备中')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^第/ })).not.toBeInTheDocument()
  })
  it('请求失败保留重试，不伪装为空目录', () => {
    render(<CourseBoardError retryHref="/courses" />)
    expect(screen.getByText('课程加载失败，请稍后重试。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '重试' })).toHaveAttribute('href', '/courses')
  })
})
