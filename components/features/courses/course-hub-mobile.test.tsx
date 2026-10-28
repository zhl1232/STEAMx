import type { ComponentProps } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CourseListItem, CoursePreviewLesson } from '@/lib/courses/types'
import { CourseHub } from './course-hub'

vi.mock('next/link', () => ({
  default: ({ prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => <a {...props} />,
}))
vi.mock('@/components/ui/optimized-image', () => ({
  OptimizedImage: ({ fill: _fill, priority: _priority, variant: _variant, ...props }: ComponentProps<'img'> & { fill?: boolean; priority?: boolean; variant?: string }) => <img {...props} />,
}))

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width'), media: query,
    addEventListener: () => {}, removeEventListener: () => {},
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const lesson = (id: number, number: number, title: string, extra: Partial<CoursePreviewLesson> = {}): CoursePreviewLesson =>
  ({ id, number, title, image_url: null, is_completed: false, ...extra })

function makeCourse(overrides: Partial<CourseListItem>): CourseListItem {
  return {
    id: 1, title: '示例', description: '', image_url: null, tags: [], status: 'approved', sort_order: 1, steam_weights: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', lesson_count: 8, progress: null, ...overrides,
  }
}

describe('手机端课程页：每门课露出课时', () => {
  it('课程标题行 + 全部 N 课入口 + 课时横滑，积木用成品图、编程用序号块', () => {
    render(<CourseHub courses={[
      makeCourse({ id: 3, title: 'Scratch 创探编程', tags: ['Scratch'], lesson_count: 48,
        preview_lessons: [lesson(301, 1, '探索员报到'), lesson(302, 2, '种子去散步')] }),
      makeCourse({ id: 5, title: '小班大颗粒积木', tags: ['得宝'], lesson_count: 100,
        preview_lessons: [lesson(501, 1, '埃菲尔铁塔', { image_url: 'https://x/a.webp' })] }),
    ]} />)
    const sections = screen.getAllByRole('region').filter(r => r.hasAttribute('data-course-id'))
    expect(within(sections[0]).getByRole('heading').textContent).toBe('小班大颗粒积木')
    expect(within(sections[0]).getByRole('link', { name: /全部 100 课/ }).getAttribute('href')).toBe('/courses/5')
    const brickTile = within(sections[0]).getByRole('link', { name: '第1课 埃菲尔铁塔' })
    expect(brickTile.getAttribute('href')).toBe('/courses/5/lessons/501')
    expect(brickTile.querySelector('img')?.getAttribute('src')).toBe('https://x/a.webp')
    expect(within(sections[1]).getByRole('link', { name: '第2课 种子去散步' }).textContent).toContain('02')
    expect(screen.queryByText(/分钟/)).toBeNull()
  })

  it('登录在学：顶部只有一个「继续上次的课」入口，行内不重复，已完成课时有完成标记', () => {
    render(<CourseHub courses={[makeCourse({
      id: 7, title: '大班大颗粒积木', tags: ['得宝'], lesson_count: 100,
      progress: { completed_lesson_count: 1, total_lesson_count: 100, status: 'in_progress', next_lesson_id: 702, milestone_completed_at: null },
      preview_lessons: [lesson(701, 1, '扁担', { is_completed: true }), lesson(702, 2, '变速风扇')],
      next_lesson: lesson(702, 2, '变速风扇'),
    })]} />)
    const cards = screen.getAllByRole('link', { name: /^继续上次的课/ })
    expect(cards).toHaveLength(1)
    expect(cards[0].getAttribute('href')).toBe('/courses/7/lessons/702')
    expect(cards[0].textContent).toContain('第2课 · 变速风扇')
    expect(screen.queryByRole('heading', { name: /每一次尝试/ })).toBeNull()
    expect(screen.getByRole('link', { name: '第1课 扁担（已完成）' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '第2课 变速风扇' }).getAttribute('href')).toBe('/courses/7/lessons/702')
  })

  it('未登录显示横幅标题', () => {
    render(<CourseHub courses={[makeCourse({ id: 3, title: '五子棋博弈论入门', tags: ['五子棋'], preview_lessons: [lesson(1, 1, '认识棋盘')] })]} />)
    expect(screen.getByRole('heading', { name: '每一次尝试，都是成长。' }).textContent).toBe('每一次尝试，都是成长。')
    expect(screen.queryByText(/技能课程 · \d+ 门/)).toBeNull()
    expect(screen.queryByRole('link', { name: /^继续上次的课/ })).toBeNull()
  })
})
