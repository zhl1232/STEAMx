import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CourseListItem, CoursePreviewLesson } from '@/lib/courses/types'
import { DesktopCourseCatalog } from './desktop-course-catalog'

vi.mock('./course-share-button', () => ({ CourseShareButton: () => <button>分享</button> }))
vi.mock('next/link', () => ({ default: ({ prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => <a {...props} /> }))
const fetchCatalog = vi.fn<typeof fetch>()
const lessons = (id: number, count: number): CoursePreviewLesson[] => Array.from({ length: count }, (_, index) => ({ id: id * 1000 + index, number: index + 1, title: `作品 ${id}-${index + 1}`, image_url: '/model.webp', is_completed: false }))
const all = { 5: lessons(5, 100), 6: lessons(6, 100) }
const makeCourse = (id: 5 | 6): CourseListItem => ({ id, title: id === 5 ? '小班大颗粒积木' : '中班大颗粒积木', tags: ['得宝'], description: '', image_url: null,
  status: 'approved', sort_order: id, steam_weights: null, created_at: '', updated_at: '', lesson_count: 100, progress: null, preview_lessons: all[id].slice(0, 8) })
const courses = [makeCourse(5), makeCourse(6)]
const response = (items: CoursePreviewLesson[]) => ({ ok: true, json: async () => ({ lessons: items }) }) as Response
const renderLesson = (course: CourseListItem, lesson: CoursePreviewLesson) => <a key={lesson.id} href={`/courses/${course.id}/lessons/${lesson.id}`}>{lesson.title}</a>
function Catalog(props: Partial<ComponentProps<typeof DesktopCourseCatalog>> = {}) {
  return <DesktopCourseCatalog courses={courses} initialCourseId={5} restoreSelection renderLesson={renderLesson} themeFor={() => 'xiaoban'} {...props} />
}
beforeEach(() => {
  sessionStorage.clear()
  fetchCatalog.mockReset()
  fetchCatalog.mockImplementation(async input => response(String(input).includes('/5/') ? all[5] : all[6]))
  vi.stubGlobal('fetch', fetchCatalog)
})
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals() })

describe('桌面完整课时网格', () => {
  it('课程链接支持新标签打开，修饰键点击不改变当前课程', () => {
    render(<Catalog courses={courses.map(course => ({ ...course, lesson_count: 8 }))} />)
    const target = screen.getByRole('link', { name: '中班大颗粒积木' })
    expect(target).toHaveAttribute('href', '/courses?course=6')
    fireEvent.click(target, { ctrlKey: true })
    expect(screen.getByRole('link', { name: '小班大颗粒积木' })).toHaveAttribute('aria-current', 'page')
    expect(fetchCatalog).not.toHaveBeenCalled()
  })
  it('编程课程标签和展示标题省略固定副标题，并使用简洁介绍', () => {
    render(<Catalog courses={[{ ...courses[0], title: 'Scratch 创探编程：从动画到作品', lesson_count: 8 }]} />)
    expect(screen.getByRole('link', { name: 'Scratch 创探编程' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /从动画到作品/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Scratch 创探编程' })).toBeInTheDocument()
    expect(screen.getByText('从动画、故事到小游戏，动手创作自己的作品。')).toBeInTheDocument()
  })
  it('只读取当前课程且一次完整展示全部100课，切换时保留所有课程按钮', async () => {
    const { container } = render(<Catalog />)
    await waitFor(() => expect(container.querySelector('[data-course-grid]')?.children).toHaveLength(100))
    expect(screen.getByRole('link', { name: '作品 5-100' })).toHaveAttribute('href', '/courses/5/lessons/5099')
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    expect(fetchCatalog).toHaveBeenCalledWith('/api/courses/5/catalog', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))
    expect(within(screen.getByRole('group', { name: '选择课程' })).getAllByRole('link')).toHaveLength(2)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
  it('等待路由提交时保留当前内容且不重复请求，提交后取消旧请求并使用服务端完整目录', async () => {
    let resolveOld!: (value: Response) => void
    fetchCatalog.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const { container, rerender } = render(<Catalog key="base" />)
    container.addEventListener('click', event => event.preventDefault())
    const signal = fetchCatalog.mock.calls[0][1]?.signal
    fireEvent.click(screen.getByRole('link', { name: '中班大颗粒积木' }))
    expect(signal?.aborted).toBe(false)
    expect(screen.getByRole('link', { name: '小班大颗粒积木' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: '作品 6-1' })).not.toBeInTheDocument()
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    const complete = courses.map(course => ({ ...course, preview_lessons: all[course.id as 5 | 6] }))
    // Next commits the new query route and CourseBoard remounts with its server catalog.
    rerender(<Catalog key="course=6" courses={complete} initialCourseId={6} restoreSelection={false} />)
    expect(signal?.aborted).toBe(true)
    expect(screen.getByRole('link', { name: '作品 6-100' })).toBeInTheDocument()
    await act(async () => resolveOld(response(all[5])))
    expect(screen.queryByRole('link', { name: '作品 5-100' })).not.toBeInTheDocument()
    rerender(<Catalog key="course=5" courses={complete} initialCourseId={5} restoreSelection={false} />)
    expect(screen.getByRole('link', { name: '作品 5-100' })).toBeInTheDocument()
    expect(container.querySelector('[data-course-grid]')?.children).toHaveLength(100)
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
  })
  it('失败保留真实预览与计数，重试后显示完整目录', async () => {
    fetchCatalog.mockRejectedValueOnce(new Error('offline'))
    render(<Catalog />)
    expect(await screen.findByRole('alert')).toHaveTextContent('8 / 100')
    expect(screen.getAllByRole('link')).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(102))
  })
  it('显式分类优先于保存的选择，点击课时保存返回目标而不持久化课时数据', async () => {
    sessionStorage.setItem('courses:mobile-view:v1', JSON.stringify({ selected: 6, desktopSelected: 6, rails: {}, y: 0 }))
    const { container } = render(<Catalog restoreSelection={false} />)
    expect(screen.getByRole('link', { name: '小班大颗粒积木' })).toHaveAttribute('aria-current', 'page')
    await waitFor(() => expect(screen.getByRole('link', { name: '作品 5-100' })).toBeInTheDocument())
    container.addEventListener('click', event => event.preventDefault())
    fireEvent.click(screen.getByRole('link', { name: '作品 5-100' }))
    expect(JSON.parse(sessionStorage.getItem('courses:mobile-view:v1')!)).toEqual({ selected: 5, desktopSelected: 5, rails: {}, y: 0 })
  })
  it('返回时恢复桌面所选课程，完整预览无需重复请求', () => {
    sessionStorage.setItem('courses:mobile-view:v1', JSON.stringify({ desktopSelected: 6 }))
    render(<Catalog courses={courses.map(course => ({ ...course, lesson_count: 8 }))} />)
    expect(screen.getByRole('link', { name: '中班大颗粒积木' })).toHaveAttribute('aria-current', 'page')
    expect(fetchCatalog).not.toHaveBeenCalled()
  })
  it('空分类不显示无关课程，但保留课程按钮供主动切换', async () => {
    const { rerender } = render(<Catalog key="empty" initialCourseId={0} restoreSelection={false} />)
    expect(screen.getByText('当前分类暂无课程。')).toBeInTheDocument()
    expect(fetchCatalog).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: '中班大颗粒积木' }))
    expect(screen.getByText('当前分类暂无课程。')).toBeInTheDocument()
    expect(fetchCatalog).not.toHaveBeenCalled()
    rerender(<Catalog key="course=6" initialCourseId={6} restoreSelection={false} courses={courses.map(course => ({ ...course, preview_lessons: all[course.id as 5 | 6] }))} />)
    expect(screen.getByRole('link', { name: '作品 6-100' })).toBeInTheDocument()
  })
})
