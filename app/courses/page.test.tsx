import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CourseOverview, CourseListItem } from '@/lib/courses/types'

const mocks = vi.hoisted(() => ({ overview: vi.fn(), listed: vi.fn(), board: vi.fn(), notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }) }))
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))
vi.mock('@/lib/content-classification', () => ({ getContentClassificationSettings: async () => ({ publicV1Enabled: false }) }))
vi.mock('@/lib/api/courses', () => ({ getCourseOverview: mocks.overview, listApprovedCourses: mocks.listed, getCourseSuccessor: async () => null }))
vi.mock('@/components/features/courses/course-board', () => ({ CourseBoard: (props: unknown) => { mocks.board(props); return <div>目录</div> }, CourseBoardError: ({ retryHref }: { retryHref: string }) => <a href={retryHref}>重试</a> }))
vi.mock('@/components/features/courses/course-share-button', () => ({ CourseShareButton: () => <button>分享</button> }))
vi.mock('@/components/features/courses/course-successor-banner', () => ({ CourseSuccessorBanner: () => null }))
import CoursesPage, { generateMetadata } from './page'

const selected: CourseOverview = { id: 5, title: '小班大颗粒积木', description: '动手搭建', image_url: null, tags: ['积木'],
  status: 'approved', is_listed: true, sort_order: 1, steam_weights: null, created_at: '', updated_at: '', progress: null,
  lessons: Array.from({ length: 25 }, (_, index) => ({ id: 900 + index, course_id: 5, title: `作品${index + 1}`, lesson_type: 'building_3d', sort_order: index,
    duration_minutes: null, track: null, level_label: null, summary: null, has_model: true, finished_image_url: '/model.webp', is_completed: false })) }
const listed: CourseListItem = { ...selected, lesson_count: 25, preview_lessons: [], progress: null }
const pageProps = (course?: string | string[]) => ({ searchParams: Promise.resolve({ course }) })
beforeEach(() => { vi.clearAllMocks(); mocks.overview.mockResolvedValue(selected); mocks.listed.mockResolvedValue([listed]) })

describe('课程目录服务端选择与访问边界', () => {
  it('显式课程将全部轻量课时交给目录，保留真实完成态和稳定序号', async () => {
    renderToStaticMarkup(await CoursesPage(pageProps('5')))
    const props = mocks.board.mock.calls[0][0] as { initialCourseId: number; courses: CourseListItem[] }
    expect(props.initialCourseId).toBe(5)
    expect(props.courses[0].preview_lessons).toHaveLength(25)
    expect(props.courses[0].preview_lessons?.at(-1)).toEqual({ id: 924, number: 25, title: '作品25', image_url: '/model.webp', is_completed: false })
    expect(props.courses[0].preview_lessons?.[0]).not.toHaveProperty('content')
  })
  it.each(['bad', '0', '-1', ['5', '6']])('非法或重复课程参数直接返回未找到：%j', async course => {
    await expect(CoursesPage(pageProps(course))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.overview).not.toHaveBeenCalled()
  })
  it('成功查询但找不到课程时返回未找到', async () => {
    mocks.overview.mockResolvedValue(null)
    await expect(CoursesPage(pageProps('999'))).rejects.toThrow('NEXT_NOT_FOUND')
  })
  it('已审核隐藏课只在明确请求时加入，使用 noindex follow 和自身 canonical', async () => {
    mocks.overview.mockResolvedValue({ ...selected, id: 1, is_listed: false })
    const metadata = await generateMetadata(pageProps('1'))
    expect(metadata.robots).toEqual({ index: false, follow: true })
    expect(metadata.alternates?.canonical).toMatch(/\/courses\?course=1$/)
    renderToStaticMarkup(await CoursesPage(pageProps('1')))
    const props = mocks.board.mock.calls[0][0] as { courses: CourseListItem[] }
    expect(props.courses.map(course => course.id)).toEqual([5, 1])
  })
  it('数据库异常提供当前课程重试入口，不误判404', async () => {
    mocks.overview.mockRejectedValue(new Error('database offline'))
    const html = renderToStaticMarkup(await CoursesPage(pageProps('5')))
    expect(html).toContain('href="/courses?course=5"')
    expect(html).toContain('重试')
    expect(mocks.notFound).not.toHaveBeenCalled()
    expect((await generateMetadata(pageProps('5'))).robots).toEqual({ index: false, follow: false })
  })
})
