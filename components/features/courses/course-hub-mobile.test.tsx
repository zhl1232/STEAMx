import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CourseListItem, CoursePreviewLesson } from '@/lib/courses/types'
import { CourseHub } from './course-hub'

vi.mock('next/link', () => ({
  default: ({ prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => <a {...props} />,
}))
vi.mock('@/components/ui/optimized-image', () => ({
  OptimizedImage: ({ fill: _fill, priority: _priority, variant: _variant, ...props }: ComponentProps<'img'> & { fill?: boolean; priority?: boolean; variant?: string }) => <img {...props} />,
}))

const fetchCatalog = vi.fn<typeof fetch>()
const scrollTo = vi.fn()
const storageKey = 'courses:mobile-view:v1'
const lesson = (id: number, number: number, title: string, extra: Partial<CoursePreviewLesson> = {}): CoursePreviewLesson =>
  ({ id, number, title, image_url: null, is_completed: false, ...extra })
const brickLessons = Array.from({ length: 45 }, (_, i) => lesson(501 + i, i + 1, `搭建作品 ${i + 1}`))
const programmingLessons = Array.from({ length: 30 }, (_, i) => lesson(301 + i, i + 1, `编程作品 ${i + 1}`))
function response(lessons: CoursePreviewLesson[]) {
  return { ok: true, json: async () => ({ lessons }) } as Response
}
function makeCourse(overrides: Partial<CourseListItem>): CourseListItem {
  return {
    id: 1, title: '示例', description: '', image_url: null, tags: [], status: 'approved', sort_order: 1, steam_weights: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', lesson_count: 8, progress: null, ...overrides,
  }
}
const courses = [
  makeCourse({ id: 3, title: 'Scratch 创探编程', tags: ['Scratch'], lesson_count: 30, preview_lessons: programmingLessons.slice(0, 8) }),
  makeCourse({ id: 5, title: '小班大颗粒积木', tags: ['得宝'], lesson_count: 45, preview_lessons: brickLessons.slice(0, 8) }),
]
const rail = (title: string) => screen.getByRole('region', { name: `${title}课时` })
const tiles = (element: HTMLElement) => within(element).queryAllByRole('link', { name: /^第\d+课 / })
function scrollNearEnd(element: HTMLElement, x = 700) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: x + 400 },
    clientWidth: { configurable: true, value: 390 },
    scrollLeft: { configurable: true, writable: true, value: x },
  })
  fireEvent.scroll(element)
}

beforeEach(() => {
  sessionStorage.clear()
  fetchCatalog.mockReset()
  fetchCatalog.mockImplementation(async input => response(String(input).includes('/5/') ? brickLessons : programmingLessons))
  scrollTo.mockReset()
  vi.stubGlobal('fetch', fetchCatalog)
  vi.stubGlobal('scrollTo', scrollTo)
  vi.stubGlobal('scrollY', 0)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width'), media: query,
    addEventListener: () => {}, removeEventListener: () => {},
  }))
})
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals() })

describe('手机端课程页：逐门课程横向浏览全部课时', () => {
  it('显式课程优先于保存的纵向位置，完整服务端目录仍按8课及12课分批展示', () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ selected: 3, rails: {}, y: 999 }))
    render(<CourseHub courses={courses.map(course => course.id === 5 ? { ...course, preview_lessons: brickLessons } : course)} initialCourseId={5} />)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    expect(tiles(rail('小班大颗粒积木'))).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: '小班大颗粒积木：加载更多课时' }))
    expect(tiles(rail('小班大颗粒积木'))).toHaveLength(20)
    expect(fetchCatalog).not.toHaveBeenCalled()
  })
  it('保留每门课程的 8 课预览，不预读全部目录、不出现切换栏/搜索/详情入口', () => {
    const { container } = render(<CourseHub courses={courses} />)
    const sections = [...container.querySelectorAll<HTMLElement>('section[data-course-id]')]
    expect(sections.map(section => section.dataset.courseId)).toEqual(['5', '3'])
    expect(tiles(rail('小班大颗粒积木'))).toHaveLength(8)
    expect(tiles(rail('Scratch 创探编程'))).toHaveLength(8)
    expect(screen.getByRole('link', { name: '第1课 搭建作品 1' })).toHaveAttribute('href', '/courses/5/lessons/501')
    expect(screen.queryByRole('group', { name: '选择课程' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /全部.*课|课程介绍/ })).not.toBeInTheDocument()
    expect(fetchCatalog).not.toHaveBeenCalled()
  })

  it('桌面前后浏览按钮只移动对应课程横列，并在边缘更新可用状态', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
    render(<CourseHub courses={courses} />)
    const brickRail = rail('小班大颗粒积木')
    const scrollBy = vi.fn()
    Object.defineProperties(brickRail, {
      scrollWidth: { configurable: true, value: 2200 },
      clientWidth: { configurable: true, value: 1000 },
      scrollLeft: { configurable: true, writable: true, value: 0 },
      scrollBy: { configurable: true, value: scrollBy },
    })
    fireEvent.scroll(brickRail)
    expect(screen.getByRole('button', { name: '小班大颗粒积木：向前浏览' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '小班大颗粒积木：向后浏览' }))
    expect(scrollBy).toHaveBeenCalledWith({ left: 850, behavior: 'smooth' })
    brickRail.scrollLeft = 500
    fireEvent.scroll(brickRail)
    fireEvent.click(screen.getByRole('button', { name: '小班大颗粒积木：向前浏览' }))
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -850, behavior: 'smooth' })
    expect(fetchCatalog).not.toHaveBeenCalled()
  })

  it('滑到一门课末尾才读取其目录，追加 12 课且后续批次复用目录', async () => {
    render(<CourseHub courses={courses} />)
    const brickRail = rail('小班大颗粒积木')
    scrollNearEnd(brickRail)
    await waitFor(() => expect(tiles(brickRail)).toHaveLength(20))
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    expect(fetchCatalog).toHaveBeenCalledWith('/api/courses/5/catalog', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))
    expect(tiles(rail('Scratch 创探编程'))).toHaveLength(8)
    expect(screen.queryByRole('link', { name: '第21课 搭建作品 21' })).not.toBeInTheDocument()
    scrollNearEnd(brickRail, 2300)
    await waitFor(() => expect(tiles(brickRail)).toHaveLength(32))
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: '第32课 搭建作品 32' })).toHaveAttribute('href', '/courses/5/lessons/532')
  })

  it('点击横滑末尾的加载按钮也能继续浏览，预览已完整的小课无需请求', async () => {
    const short = makeCourse({ id: 4, title: '五子棋博弈论入门', tags: ['五子棋'], lesson_count: 2,
      preview_lessons: [lesson(401, 1, '认识棋盘'), lesson(402, 2, '认识棋子')] })
    render(<CourseHub courses={[...courses, short]} />)
    const shortRail = rail(short.title)
    scrollNearEnd(shortRail)
    expect(fetchCatalog).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: `${short.title}：加载更多课时` })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Scratch 创探编程：加载更多课时' }))
    await waitFor(() => expect(tiles(rail('Scratch 创探编程'))).toHaveLength(20))
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    expect(fetchCatalog).toHaveBeenCalledWith('/api/courses/3/catalog', expect.any(Object))
  })

  it('加载失败仍保留已有预览，能在原课程重试', async () => {
    fetchCatalog.mockRejectedValueOnce(new Error('offline'))
    render(<CourseHub courses={courses} />)
    const brickRail = rail('小班大颗粒积木')
    scrollNearEnd(brickRail)
    await waitFor(() => expect(screen.getByRole('button', { name: '小班大颗粒积木：加载更多课时' })).toHaveTextContent('重试'))
    expect(tiles(brickRail)).toHaveLength(8)
    expect(tiles(rail('Scratch 创探编程'))).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: '小班大颗粒积木：加载更多课时' }))
    await waitFor(() => expect(tiles(brickRail)).toHaveLength(20))
    expect(fetchCatalog).toHaveBeenCalledTimes(2)
  })

  it('同一横栏加载中不重复请求，离开页面时中止请求', async () => {
    let resolvePending!: (value: Response) => void
    fetchCatalog.mockImplementationOnce(() => new Promise(resolve => { resolvePending = resolve }))
    const { unmount } = render(<CourseHub courses={courses} />)
    const brickRail = rail('小班大颗粒积木')
    scrollNearEnd(brickRail)
    scrollNearEnd(brickRail)
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    const signal = fetchCatalog.mock.calls[0][1]?.signal
    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => resolvePending(response(brickLessons)))
  })

  it('显式课程返回仍恢复横栏数量和位置，同时覆盖旧课程与纵向位置', async () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ selected: 3, rails: { 5: { count: 32, x: 420 }, 3: { count: 8, x: 100 } }, y: 999 }))
    render(<CourseHub courses={courses.map(course => course.id === 5 ? { ...course, preview_lessons: brickLessons } : course)} initialCourseId={5} />)
    await waitFor(() => expect(tiles(rail('小班大颗粒积木'))).toHaveLength(32))
    expect(rail('小班大颗粒积木').scrollLeft).toBe(420)
    expect(rail('Scratch 创探编程').scrollLeft).toBe(100)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    expect(fetchCatalog).not.toHaveBeenCalled()
    fireEvent(window, new Event('pagehide'))
    expect(JSON.parse(sessionStorage.getItem(storageKey)!).selected).toBe(5)
  })

  it('返回时恢复页面和每条横栏的位置，仅重新读取已展开的课程', async () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ selected: 5, y: 456, rails: { 5: { count: 32, x: 1600 }, 3: { count: 8, x: 300 } } }))
    render(<CourseHub courses={courses} />)
    const brickRail = rail('小班大颗粒积木')
    await waitFor(() => expect(tiles(brickRail)).toHaveLength(32))
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    expect(fetchCatalog).toHaveBeenCalledWith('/api/courses/5/catalog', expect.any(Object))
    await waitFor(() => expect(brickRail.scrollLeft).toBe(1600))
    expect(rail('Scratch 创探编程').scrollLeft).toBe(300)
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 456, behavior: 'instant' }))
  })

  it('离开时保存所有横栏和目标课程，仅存视图状态', async () => {
    const { container } = render(<CourseHub courses={courses} />)
    const brickRail = rail('小班大颗粒积木')
    scrollNearEnd(brickRail)
    await waitFor(() => expect(tiles(brickRail)).toHaveLength(20))
    Object.defineProperty(brickRail, 'scrollWidth', { configurable: true, value: 5000 })
    brickRail.scrollLeft = 900
    fireEvent.scroll(brickRail)
    const programmingRail = rail('Scratch 创探编程')
    Object.defineProperty(programmingRail, 'scrollWidth', { configurable: true, value: 5000 })
    programmingRail.scrollLeft = 250
    fireEvent.scroll(programmingRail)
    vi.stubGlobal('scrollY', 800)
    // Prevent the test DOM from navigating while still exercising link capture.
    container.addEventListener('click', event => event.preventDefault())
    fireEvent.click(screen.getByRole('link', { name: '第2课 编程作品 2' }))
    const saved = JSON.parse(sessionStorage.getItem(storageKey)!)
    expect(saved).toEqual({ selected: 3, y: 800, rails: { 5: { count: 20, x: 900 }, 3: { count: 8, x: 250 } } })
  })

  it('在学入口直接进入真实课时，预览保留已完成标记', () => {
    render(<CourseHub courses={[makeCourse({
      id: 7, title: '大班大颗粒积木', tags: ['得宝'], lesson_count: 100,
      progress: { completed_lesson_count: 1, total_lesson_count: 100, status: 'in_progress', next_lesson_id: 702, milestone_completed_at: null },
      next_lesson: lesson(702, 2, '变速风扇'),
      preview_lessons: [lesson(701, 1, '扁担', { is_completed: true }), lesson(702, 2, '变速风扇')],
    })]} />)
    const cards = screen.getAllByRole('link', { name: /^继续学习：/ })
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('href', '/courses/7/lessons/702')
    expect(screen.queryByRole('heading', { name: /每一次尝试/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '第1课 扁担（已完成）' })).toBeInTheDocument()
    expect(fetchCatalog).not.toHaveBeenCalled()
  })

  it('每门在学课程都展示一个继续入口，未开始和已完成课程不混入', () => {
    const learning = (id: number): CourseListItem => makeCourse({
      id, title: `课程 ${id}`, lesson_count: 10,
      progress: { completed_lesson_count: 1, total_lesson_count: 10, status: 'in_progress', next_lesson_id: id * 100, milestone_completed_at: null },
      next_lesson: lesson(id * 100, 2, `待继续 ${id}`),
    })
    render(<CourseHub courses={[
      learning(5), learning(6), learning(7), makeCourse({ id: 8, next_lesson: lesson(800, 1, '还未开始') }),
      { ...learning(9), progress: { ...learning(9).progress!, status: 'completed' } },
    ]} />)
    const cards = screen.getAllByRole('link', { name: /^继续学习：/ })
    expect(cards.map(card => card.getAttribute('href'))).toEqual(['/courses/5/lessons/500', '/courses/6/lessons/600', '/courses/7/lessons/700'])
    expect(screen.queryByText('继续上次的课')).not.toBeInTheDocument()
  })

  it('空目录显示准备中，不发起无效请求', () => {
    render(<CourseHub courses={[]} />)
    expect(screen.getByText('技能课程即将上线，敬请期待。')).toBeInTheDocument()
    expect(fetchCatalog).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: /课时$/ })).not.toBeInTheDocument()
  })
})
