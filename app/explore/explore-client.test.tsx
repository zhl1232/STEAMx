import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ButtonHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExploreClient } from './explore-client'
import type { Project } from '@/lib/mappers/types'
import { HOUSEHOLD_MATERIAL_GROUPS } from '@/lib/explore/material-matching'

const clearLikesDeltaForProjects = vi.fn()
const toast = vi.fn()
let currentSearchParams = new URLSearchParams()
let latestIntersectionCallback: IntersectionObserverCallback | null = null
let intersectionCallbacks: IntersectionObserverCallback[] = []

vi.mock('next/navigation', () => ({
    useSearchParams: () => currentSearchParams,
}))

vi.mock('@/lib/context/project-context', () => ({
    useProjects: () => ({
        syncProjectInteractions: vi.fn(),
        clearLikesDeltaForProjects,
        completedProjects: new Set<number>(),
    }),
}))

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast,
    }),
}))

vi.mock('@/components/features/project-card', () => ({
    ProjectCard: ({ project, materialMatch }: { project: Project; materialMatch?: import('@/lib/explore/material-matching').MaterialMatch | null }) => (
        <div>{project.title}{materialMatch !== undefined ? <span data-testid="material-summary">{materialMatch ? `${materialMatch.ownedCount}/${materialMatch.requiredCount}` : '待核对'}</span> : null}</div>
    ),
}))

vi.mock('@/components/ui/loading-skeleton', () => ({
    ProjectCardSkeleton: () => <div>loading</div>,
}))

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, asChild: _asChild, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => (
        <button type="button" {...props}>
            {children}
        </button>
    ),
}))

vi.mock('@/components/ui/sheet', () => ({
    Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
        open ? <div data-testid="sheet">{children}</div> : null,
    SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('lucide-react')>()

    return {
        ...actual,
        SlidersHorizontal: () => <span>sliders</span>,
        X: () => <span>x</span>,
        Sparkles: () => <span>sparkles</span>,
    }
})

vi.mock('@/lib/config/categories', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/config/categories')>()
    return {
        ...actual,
        CATEGORY_CONFIG: {
            科学: ['物理'],
        },
    }
})

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}))

class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly scrollMargin = ''
    readonly thresholds = []

    constructor(callback: IntersectionObserverCallback) {
        latestIntersectionCallback = callback
        intersectionCallbacks.push(callback)
    }

    disconnect() {}
    observe() {}
    takeRecords() {
        return []
    }
    unobserve() {}
}

function makeProject(id: number, title: string): Project {
    return {
        id,
        title,
    } as Project
}

function triggerIntersection() {
    if (intersectionCallbacks.length === 0) {
        throw new Error('IntersectionObserver callback not registered')
    }

    for (const callback of intersectionCallbacks) {
        callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver,
        )
    }
}

function createAbortError() {
    return new DOMException('Aborted', 'AbortError')
}

describe('ExploreClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        sessionStorage.clear()
        currentSearchParams = new URLSearchParams()
        latestIntersectionCallback = null
        intersectionCallbacks = []
        vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: RequestInfo | URL) => {
                const url = String(input)
                if (url.includes('/api/explore/recommendations')) {
                return {
                    ok: true,
                    json: async () => ({
                        projects: [],
                        hasMore: false,
                        total: 0,
                        mode: 'personalized',
                    }),
                } as Response
                }

                return {
                    ok: false,
                    text: async () => '',
                } as Response
            }),
        )
    })

    it('shows subcategories for the category chosen above and does not repeat category controls in filters', async () => {
        currentSearchParams = new URLSearchParams({ category: '科学' })
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[]} initialHasMore={false} categories={['全部', '科学']} />)
        await user.click(screen.getByTestId('explore-mobile-filters'))
        const sheet = within(screen.getByTestId('sheet'))
        expect(sheet.getByRole('spinbutton', { name: '孩子年龄' })).toBeInTheDocument()
        expect(sheet.getByRole('button', { name: '物理' })).toBeInTheDocument()
        expect(sheet.queryByRole('button', { name: '科学' })).not.toBeInTheDocument()
        await user.click(sheet.getByRole('button', { name: '取消' }))
        await user.click(screen.getByTestId('explore-category-strip').querySelector('button')!)
        await user.click(screen.getByTestId('explore-mobile-filters'))
        expect(within(screen.getByTestId('sheet')).queryByText('子分类')).not.toBeInTheDocument()
    })

    it('omits the kits shortcut and clears retired source conditions while retaining category and sorting', () => {
        currentSearchParams = new URLSearchParams({ tags: '趣味实验,科教版', category: '科学', sortBy: 'latest' })
        render(<ExploreClient initialProjects={[]} initialHasMore={false} />)
        expect(screen.queryByRole('link', { name: '按套装找' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '趣味实验' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '科教版' })).not.toBeInTheDocument()
        const url = new URL(window.location.href)
        expect(url.searchParams.has('tags')).toBe(false)
        expect(url.searchParams.get('category')).toBe('科学')
        expect(url.searchParams.get('sortBy')).toBe('latest')
    })

    it('ignores unsupported URL tags without showing hidden conditions or chips', async () => {
        currentSearchParams = new URLSearchParams({ tags: '磁力,八' })
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[]} initialHasMore={false} availableTags={['磁力', '八']} />)
        expect(screen.queryByTestId('explore-filter-summary')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '趣味实验' })).not.toBeInTheDocument()
        await user.click(screen.getByTestId('explore-mobile-filters'))
        const sheet = within(screen.getByTestId('sheet'))
        expect(sheet.queryByText('标签')).not.toBeInTheDocument()
        expect(sheet.queryByRole('button', { name: '八' })).not.toBeInTheDocument()
        expect(sheet.queryByTestId('explore-more-tags')).not.toBeInTheDocument()
        expect(fetch).not.toHaveBeenCalled()
    })

    it('ignores grade-only URLs on initial render and later URL navigation', async () => {
        currentSearchParams = new URLSearchParams({ tags: '初中' })
        const props = { initialProjects: [makeProject(1, '未筛选项目')], initialHasMore: false,
            initialFiltersKey: '', categories: ['全部', '科学'] }
        const { rerender } = render(<ExploreClient {...props} />)
        expect(screen.getByRole('combobox', { name: '项目排序' })).toHaveTextContent('推荐')
        expect(screen.getByText('未筛选项目')).toBeInTheDocument()
        currentSearchParams = new URLSearchParams({ tags: '科教版,初中' })
        rerender(<ExploreClient {...props} />)
        await waitFor(() => expect(screen.queryByRole('button', { name: '科教版' })).not.toBeInTheDocument())
        currentSearchParams = new URLSearchParams({ tags: '二年级,高中' })
        rerender(<ExploreClient {...props} />)
        await waitFor(() => expect(screen.getByRole('combobox', { name: '项目排序' })).toHaveTextContent('推荐'))
    })

    it('rebuilds page one when the saved filters differ from the SSR payload', async () => {
        currentSearchParams = new URLSearchParams('category=科学')
        sessionStorage.setItem('explore-scroll-restore-v3', JSON.stringify({
            filtersKey: 'category=%E7%A7%91%E5%AD%A6',
            scrollY: 240,
            nextPage: 1,
        }))
        vi.stubGlobal('scrollTo', vi.fn())
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0)
            return 0
        })
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockImplementation(async (input) => {
            const url = String(input)
            if (!url.includes('/api/projects')) {
                return { ok: true, json: async () => ({ projects: [], hasMore: false, total: 0 }) } as Response
            }
            return {
                ok: true,
                json: async () => ({ projects: [makeProject(2, '筛选后的项目')], hasMore: false, total: 1 }),
            } as Response
        })

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '过期 SSR 项目')]}
                initialHasMore={false}
                initialFiltersKey="tags=科教版"
                categories={['全部']}
            />,
        )

        expect(await screen.findByText('筛选后的项目')).toBeInTheDocument()
        expect(screen.queryByText('过期 SSR 项目')).not.toBeInTheDocument()
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('page=0'), expect.objectContaining({ signal: expect.any(AbortSignal) }))
    })

    it('uses matching SSR data without fetching page one again', async () => {
        currentSearchParams = new URLSearchParams('category=科学')
        sessionStorage.setItem('explore-scroll-restore-v3', JSON.stringify({
            filtersKey: 'category=%E7%A7%91%E5%AD%A6',
            scrollY: 240,
            nextPage: 1,
        }))
        vi.stubGlobal('scrollTo', vi.fn())
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0)
            return 0
        })
        const fetchMock = vi.mocked(fetch)

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '匹配的 SSR 项目')]}
                initialHasMore={false}
                initialFiltersKey="category=%E7%A7%91%E5%AD%A6"
                categories={['全部']}
            />,
        )

        expect(await screen.findByText('匹配的 SSR 项目')).toBeInTheDocument()
        await waitFor(() => expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/projects'), expect.anything()))
    })

    it('repairs stale SSR data even when no scroll checkpoint is available', async () => {
        currentSearchParams = new URLSearchParams('category=科学')
        vi.stubGlobal('scrollTo', vi.fn())
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockImplementation(async (input) => {
            const url = String(input)
            if (!url.includes('/api/projects')) return { ok: true, json: async () => ({ projects: [] }) } as Response
            return { ok: true, json: async () => ({ projects: [makeProject(7, '无记录点的新项目')], hasMore: false, total: 1 }) } as Response
        })

        render(<ExploreClient initialProjects={[makeProject(1, '过期 SSR 项目')]} initialHasMore={false} initialFiltersKey="tags=科教版" categories={['全部']} />)

        expect(await screen.findByText('无记录点的新项目')).toBeInTheDocument()
        expect(screen.queryByText('过期 SSR 项目')).not.toBeInTheDocument()
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('page=0'), expect.anything())
    })

    it('restores every missing page from page zero when SSR data is stale', async () => {
        currentSearchParams = new URLSearchParams('category=科学')
        sessionStorage.setItem('explore-scroll-restore-v3', JSON.stringify({
            filtersKey: 'category=%E7%A7%91%E5%AD%A6', scrollY: 240, nextPage: 3,
        }))
        vi.stubGlobal('scrollTo', vi.fn())
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockImplementation(async (input) => {
            const url = String(input)
            if (!url.includes('/api/projects')) return { ok: true, json: async () => ({ projects: [] }) } as Response
            const page = Number(new URL(url, 'http://localhost').searchParams.get('page'))
            return { ok: true, json: async () => ({ projects: [makeProject(page + 10, `恢复第 ${page} 页`)], hasMore: page < 2, total: 3 }) } as Response
        })

        render(<ExploreClient initialProjects={[makeProject(1, '过期 SSR 项目')]} initialHasMore={false} initialFiltersKey="tags=科教版" categories={['全部']} />)

        expect(await screen.findByText('恢复第 0 页')).toBeInTheDocument()
        expect(screen.getByText('恢复第 1 页')).toBeInTheDocument()
        expect(screen.getByText('恢复第 2 页')).toBeInTheDocument()
        expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/projects')).map(([input]) => String(input))).toEqual(expect.arrayContaining([
            expect.stringContaining('page=0'), expect.stringContaining('page=1'), expect.stringContaining('page=2'),
        ]))
    })

    it('shows a retry action when the first restore page fails', async () => {
        currentSearchParams = new URLSearchParams('category=科学')
        sessionStorage.setItem('explore-scroll-restore-v3', JSON.stringify({
            filtersKey: 'category=%E7%A7%91%E5%AD%A6', scrollY: 240, nextPage: 1,
        }))
        vi.stubGlobal('scrollTo', vi.fn())
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
        const fetchMock = vi.mocked(fetch)
        let restoreAttempts = 0
        fetchMock.mockImplementation(async (input) => {
            const url = String(input)
            if (!url.includes('/api/projects')) return { ok: true, json: async () => ({ projects: [] }) } as Response
            restoreAttempts += 1
            if (restoreAttempts === 1) return { ok: false, text: async () => 'restore failed' } as Response
            return { ok: true, json: async () => ({ projects: [makeProject(8, '重试成功项目')], hasMore: false, total: 1 }) } as Response
        })

        render(<ExploreClient initialProjects={[makeProject(1, '过期 SSR 项目')]} initialHasMore={false} initialFiltersKey="tags=科教版" categories={['全部']} />)

        const retry = await screen.findByRole('button', { name: '重试加载' })
        await waitFor(() => expect(retry).toBeEnabled())
        await userEvent.click(retry)
        expect(await screen.findByText('重试成功项目')).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('retries the first missing page after a partial restore failure', async () => {
        currentSearchParams = new URLSearchParams('category=科学')
        sessionStorage.setItem('explore-scroll-restore-v3', JSON.stringify({
            filtersKey: 'category=%E7%A7%91%E5%AD%A6', scrollY: 240, nextPage: 3,
        }))
        vi.stubGlobal('scrollTo', vi.fn())
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
        const fetchMock = vi.mocked(fetch)
        let pageOneAttempts = 0
        fetchMock.mockImplementation(async (input) => {
            const url = String(input)
            if (!url.includes('/api/projects')) return { ok: true, json: async () => ({ projects: [] }) } as Response
            const page = Number(new URL(url, 'http://localhost').searchParams.get('page'))
            if (page === 1 && pageOneAttempts++ === 0) return { ok: false, text: async () => 'page one failed' } as Response
            return { ok: true, json: async () => ({ projects: [makeProject(page + 20, `补齐第 ${page} 页`)], hasMore: page < 2, total: 3 }) } as Response
        })

        render(<ExploreClient initialProjects={[makeProject(1, '过期 SSR 项目')]} initialHasMore={false} initialFiltersKey="tags=科教版" categories={['全部']} />)

        const retry = await screen.findByRole('button', { name: '重试加载' })
        expect(await screen.findByText('补齐第 0 页')).toBeInTheDocument()
        await waitFor(() => expect(retry).toBeEnabled())
        await userEvent.click(retry)
        expect(await screen.findByText('补齐第 1 页')).toBeInTheDocument()
        expect(screen.getByText('补齐第 0 页')).toBeInTheDocument()
    })

    it('cancels a pending restore when a new filter is applied', async () => {
        currentSearchParams = new URLSearchParams('category=科学')
        sessionStorage.setItem('explore-scroll-restore-v3', JSON.stringify({
            filtersKey: 'category=%E7%A7%91%E5%AD%A6', scrollY: 240, nextPage: 1,
        }))
        vi.stubGlobal('scrollTo', vi.fn())
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockImplementation((input, init) => {
            const url = String(input)
            if (!url.includes('/api/projects')) return Promise.resolve({ ok: true, json: async () => ({ projects: [] }) } as Response)
            if (url.includes('page=0')) {
                return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(createAbortError()), { once: true }))
            }
            return Promise.resolve({ ok: true, json: async () => ({ projects: [makeProject(99, '新筛选项目')], hasMore: false, total: 1 }) } as Response)
        })

        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[makeProject(1, '过期 SSR 项目')]} initialHasMore={false} initialFiltersKey="tags=科教版" categories={['全部', '科学']} />)
        await user.click(screen.getByRole('combobox', { name: '项目排序' }))
        await user.click(screen.getByRole('option', { name: '最新发布' }))

        expect(await screen.findByText('新筛选项目')).toBeInTheDocument()
        expect(screen.queryByText('过期 SSR 项目')).not.toBeInTheDocument()
    })

    it('exposes real pagination links for the latest list', () => {
        currentSearchParams = new URLSearchParams('sortBy=latest&page=1')
        render(<ExploreClient initialProjects={[makeProject(1, '分页项目')]} initialHasMore initialPage={1} categories={['全部']} />)
        expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute('href', '/explore?sortBy=latest&page=2')
        expect(screen.getByRole('link', { name: '第一页' })).toHaveAttribute('href', '/explore?sortBy=latest')
    })

    it('keeps the next page index when a filter request fails', async () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock
            .mockResolvedValueOnce({
                ok: false,
                text: async () => 'boom',
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    projects: [makeProject(3, '第三页项目')],
                    hasMore: false,
                    total: 3,
                }),
            } as Response)

        const user = userEvent.setup()

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore
                initialPage={2}
                categories={['全部', '科学']}
            />,
        )

        await user.click(screen.getByRole('button', { name: '科学' }))
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

        await act(async () => {
            triggerIntersection()
            await Promise.resolve()
        })

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        expect(fetchMock.mock.calls[1]?.[0]).toContain('page=3')
        expect(await screen.findByText('第三页项目')).toBeInTheDocument()
    })

    it('aborts an in-flight load-more request before applying filtered results', async () => {
        const fetchMock = vi.mocked(fetch)
        let loadMoreSignal: AbortSignal | undefined

        fetchMock.mockImplementation((input, init) => {
            const url = String(input)

            if (url.includes('page=1')) {
                loadMoreSignal = init?.signal ?? undefined
                return new Promise<Response>((_, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(createAbortError()), { once: true })
                })
            }

            if (url.includes('category=%E7%A7%91%E5%AD%A6')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        projects: [makeProject(9, '筛选项目')],
                        hasMore: false,
                        total: 1,
                    }),
                } as Response)
            }

            throw new Error(`Unexpected fetch url: ${url}`)
        })

        const user = userEvent.setup()

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore
                categories={['全部', '科学']}
            />,
        )

        await screen.findByText('初始项目')
        await waitFor(() => expect(latestIntersectionCallback).not.toBeNull())

        await act(async () => {
            triggerIntersection()
            await Promise.resolve()
        })

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        await user.click(screen.getByRole('button', { name: '科学' }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(loadMoreSignal?.aborted).toBe(true))
        expect(await screen.findByText('筛选项目')).toBeInTheDocument()
        expect(screen.queryByText('第三页项目')).not.toBeInTheDocument()
    })

    it('keeps a full-page loading placeholder outside the project grid', async () => {
        const fetchMock = vi.mocked(fetch)
        let resolveLoadMore: ((response: Response) => void) | undefined
        fetchMock.mockImplementation((input) => {
            const url = String(input)
            if (url.includes('page=1')) {
                return new Promise<Response>((resolve) => {
                    resolveLoadMore = resolve
                })
            }

            return Promise.resolve({
                ok: true,
                json: async () => ({ projects: [], hasMore: false, total: 1 }),
            } as Response)
        })

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore
                categories={['全部', '科学']}
            />,
        )

        await waitFor(() => expect(latestIntersectionCallback).not.toBeNull())

        await act(async () => {
            triggerIntersection()
            await Promise.resolve()
        })

        const placeholder = await screen.findByTestId('explore-load-more-placeholder')
        expect(placeholder).toHaveAttribute('aria-busy', 'true')
        expect(placeholder.querySelectorAll('[data-testid="explore-project-grid"]').length).toBe(0)
        expect(screen.getByTestId('explore-project-grid')).not.toContainElement(placeholder)
        expect(screen.getAllByText('loading')).toHaveLength(12)

        await act(async () => {
            resolveLoadMore?.({
                ok: true,
                json: async () => ({ projects: [makeProject(2, '下一页项目')], hasMore: false, total: 2 }),
            } as Response)
            await Promise.resolve()
        })

        await waitFor(() => expect(screen.getByText('下一页项目')).toBeInTheDocument())
        expect(screen.queryByTestId('explore-load-more-placeholder')).not.toBeInTheDocument()
    })

    it('keeps more filters focused on difficulty, age, and the selected category subcategories', async () => {
        currentSearchParams = new URLSearchParams({ category: '科学', tags: '趣味实验,磁力' })
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[]} initialHasMore={false} categories={['全部', '科学']} availableTags={['磁力', '观察']} />)
        await user.click(screen.getByTestId('explore-desktop-filters'))
        const sheet = within(screen.getByTestId('sheet'))
        expect(sheet.getByRole('button', { name: '入门' })).toBeInTheDocument()
        expect(sheet.getByRole('button', { name: '物理' })).toBeInTheDocument()
        expect(sheet.getByRole('spinbutton', { name: '孩子年龄' })).toBeInTheDocument()
        expect(sheet.queryByRole('button', { name: '科学' })).not.toBeInTheDocument()
        expect(sheet.queryByText('标签')).not.toBeInTheDocument()
        expect(sheet.queryByRole('button', { name: '磁力' })).not.toBeInTheDocument()
    })

    it('groups age and result count and removes the summary when only the materials theme remains', async () => {
        currentSearchParams = new URLSearchParams('tags=日常材料&age=3')
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ projects: [makeProject(1, '材料项目')], hasMore: false, total: 1 }),
        } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[makeProject(1, '材料项目')]} initialHasMore={false} initialTotal={401} />)
        const summary = within(screen.getByTestId('explore-filter-summary'))
        expect(summary.getByRole('button', { name: /优先 3 岁/ })).toBeInTheDocument()
        expect(summary.getByText('401 个项目')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '返回探索' })).not.toBeInTheDocument()
        await user.click(summary.getByRole('button', { name: /优先 3 岁/ }))
        await waitFor(() => expect(screen.queryByTestId('explore-filter-summary')).not.toBeInTheDocument())
        const request = new URL(String(vi.mocked(fetch).mock.calls.at(-1)?.[0]), 'http://localhost')
        expect(request.searchParams.get('age')).toBeNull()
        expect(request.searchParams.get('tags')).toBe('日常材料')
    })

    it('keeps themes and independent sorting visible after category filtering', async () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                projects: [makeProject(2, '科学项目')],
                hasMore: false,
                total: 42,
            }),
        } as Response)

        const user = userEvent.setup()

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore={false}
                initialTotal={1}
                categories={['全部', '科学']}
            />,
        )

        expect(screen.getByRole('combobox', { name: '项目排序' })).toHaveTextContent('推荐')
        expect(screen.queryByRole('button', { name: '趣味实验' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '科教版' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: '科学' }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        expect(screen.queryByRole('button', { name: '热门推荐' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '趣味实验' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '科教版' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '返回探索' })).not.toBeInTheDocument()
        expect(screen.queryByTestId('explore-filter-summary')).not.toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: '项目排序' })).toHaveTextContent('推荐')
        await user.click(screen.getByRole('combobox', { name: '项目排序' }))
        expect(screen.getByRole('option', { name: '最新发布' })).toBeInTheDocument()
        await user.keyboard('{Escape}')
        expect(await screen.findByText('科学项目')).toBeInTheDocument()
    })

    it('does not expose the removed weekly-hot quick entry', () => {
        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore={false}
                categories={['全部', '科学']}
            />,
        )

        expect(screen.queryByRole('button', { name: '本周热门' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '最新上架' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '新手推荐' })).not.toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: '项目排序' })).toHaveTextContent('推荐')
        expect(screen.queryByRole('button', { name: '趣味实验' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '科教版' })).not.toBeInTheDocument()
    })

    it('shows the public materials entry without opening its picker on the popular tab', () => {
        render(<ExploreClient initialProjects={[]} initialHasMore={false} />)
        expect(screen.getByRole('button', { name: '日常材料' })).toBeInTheDocument()
        expect(screen.queryByTestId('household-material-picker')).not.toBeInTheDocument()
    })

    it('opens the materials picker on a direct public materials URL', () => {
        currentSearchParams = new URLSearchParams({ tags: '日常材料' })
        render(<ExploreClient initialProjects={[]} initialHasMore={false} />)
        expect(screen.getByRole('button', { name: '日常材料' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByTestId('household-material-picker')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '返回探索' })).not.toBeInTheDocument()
    })

    it('loads the materials theme and removes its picker and summaries when toggled off', async () => {
        const sample = { ...makeProject(738, '彩虹爬爬爬'), materials: ['纸巾1张', '浅盘1个'] }
        vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ projects: [sample], hasMore: false, total: 1 }) } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[sample]} initialHasMore={false} />)
        expect(screen.queryByTestId('material-summary')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: '日常材料' }))
        await waitFor(() => expect(screen.getByRole('button', { name: '日常材料' })).not.toBeDisabled())
        expect(decodeURIComponent(String(vi.mocked(fetch).mock.calls[0][0]))).toContain('tags=日常材料')
        expect(screen.getByRole('button', { name: '日常材料' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByTestId('material-summary')).toHaveTextContent('0/2')
        expect(screen.getByTestId('household-material-picker')).toHaveTextContent('我家有什么')
        expect(screen.queryByRole('button', { name: '返回探索' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: '日常材料' }))
        await waitFor(() => expect(screen.queryByTestId('material-summary')).not.toBeInTheDocument())
        expect(screen.queryByTestId('household-material-picker')).not.toBeInTheDocument()
    })

    it('restores owned materials on a direct URL and keeps matching when narrowing by category', () => {
        currentSearchParams = new URLSearchParams({ tags: '日常材料' })
        sessionStorage.setItem('steamx:owned-materials:v1', JSON.stringify(['tissue', 'unknown']))
        const props = { initialProjects: [{ ...makeProject(738, '彩虹爬爬爬'), materials: ['纸巾1张'] }], initialHasMore: false }
        const { rerender } = render(<ExploreClient {...props} />)
        expect(screen.getByRole('button', { name: '日常材料' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByTestId('material-summary')).toHaveTextContent('1/1')
        expect(screen.getByRole('button', { name: '纸巾' })).toHaveAttribute('aria-pressed', 'true')
        currentSearchParams = new URLSearchParams({ tags: '日常材料', category: '科学' })
        rerender(<ExploreClient {...props} />)
        expect(screen.getByTestId('material-summary')).toHaveTextContent('1/1')
    })

    it('restores a category selection without counting its unconfirmed specifications as matched', () => {
        currentSearchParams = new URLSearchParams({ tags: '日常材料' })
        const bottles = HOUSEHOLD_MATERIAL_GROUPS.find(({ label }) => label === '瓶子')!
        sessionStorage.setItem('steamx:owned-materials:v1', JSON.stringify([bottles.id]))
        const sample = { ...makeProject(1157, '瓶子实验'), materials: ['带盖透明塑料瓶1个'], householdRequirements: [['bottle']] }
        render(<ExploreClient initialProjects={[sample]} initialHasMore={false} />)
        expect(screen.getByTestId('material-summary')).toHaveTextContent('1/1')
        expect(screen.getByTestId('household-material-picker')).toHaveTextContent('已按已有材料排序')
        expect(screen.getByTestId('household-material-picker')).not.toHaveTextContent('1 个项目材料已匹配')
    })

    it('ranks by missing types after selection and restores the fewest-materials order on clear', async () => {
        currentSearchParams = new URLSearchParams({ tags: '日常材料' })
        const user = userEvent.setup()
        const samples = [
            { ...makeProject(738, '彩虹爬爬爬'), materials: ['纸巾1张', '水溶性水彩笔数色', '浅盘1个', '清水'] },
            { ...makeProject(102, '翻滚杯玩具'), materials: ['纸杯', '橡皮泥', '贴纸'] },
        ]
        const { container } = render(<ExploreClient initialProjects={samples} initialHasMore={false} />)
        const order = () => [...container.querySelectorAll('[data-explore-project-id]')].map((node) => node.getAttribute('data-explore-project-id'))
        expect(order()).toEqual(['102', '738'])
        await user.click(screen.getByRole('button', { name: '纸巾' }))
        await user.click(screen.getByRole('button', { name: '水' }))
        expect(order()).toEqual(['738', '102'])
        expect(screen.getAllByTestId('material-summary')[0]).toHaveTextContent('2/4')
        expect(JSON.parse(sessionStorage.getItem('steamx:owned-materials:v1')!)).toEqual(['纸巾', '水'].map((label) => HOUSEHOLD_MATERIAL_GROUPS.find((group) => group.label === label)!.id))
        expect(fetch).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: '清空已选材料' }))
        expect(order()).toEqual(['102', '738'])
        expect(JSON.parse(sessionStorage.getItem('steamx:owned-materials:v1')!)).toEqual([])
    })

    it('uses explicit alternatives for real project summaries and searches the expanded picker', async () => {
        currentSearchParams = new URLSearchParams({ tags: '日常材料' })
        const user = userEvent.setup()
        const sample = {
            ...makeProject(353, '材料组合项目'),
            materials: ['组合材料原文'],
            householdRequirements: [['tissue', 'paper'], ['scissors']],
        }
        render(<ExploreClient initialProjects={[sample]} initialHasMore={false} />)
        expect(screen.getByTestId('material-summary')).toHaveTextContent('0/2')
        await user.click(screen.getByRole('button', { name: '纸巾' }))
        expect(screen.getByTestId('material-summary')).toHaveTextContent('1/2')
        await user.click(screen.getByRole('button', { name: '更多材料' }))
        await user.type(screen.getByRole('textbox', { name: '搜索材料' }), '剪刀')
        await user.click(screen.getByRole('button', { name: '剪刀' }))
        await user.click(screen.getByRole('button', { name: '选好了，查看项目' }))
        expect(screen.getByTestId('material-summary')).toHaveTextContent('2/2')
        expect(screen.getByTestId('household-material-picker')).toHaveTextContent('1 个项目材料已匹配')
    }, 15000) // Exercise the full material catalog under parallel test load.

    it('degrades legacy beginner URL into results mode without removed pills', async () => {
        currentSearchParams = new URLSearchParams('difficulty=1-2&sortBy=popular')

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore={false}
                categories={['全部', '科学']}
            />,
        )

        expect(screen.queryByRole('button', { name: '新手推荐' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '最新上架' })).not.toBeInTheDocument()
        // Difficulty remains an advanced condition; the independent theme controls stay available.
        expect(screen.queryByRole('button', { name: '热门推荐' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '返回探索' })).not.toBeInTheDocument()
    })

    it('shows explicit latest sorting independently from the theme shortcuts', () => {
        currentSearchParams = new URLSearchParams('sortBy=latest')

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore={false}
                categories={['全部', '科学']}
            />,
        )

        expect(screen.queryByRole('button', { name: '最新上架' })).not.toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: '项目排序' })).toHaveTextContent('最新')
        expect(screen.queryByRole('button', { name: '趣味实验' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '科教版' })).not.toBeInTheDocument()
    })

    it('keeps the applied query when a draft search fails', async () => {
        currentSearchParams = new URLSearchParams('q=旧词&category=科学')
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValue({ ok: false, text: async () => 'failed' } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[makeProject(1, '初始项目')]} initialHasMore={false} categories={['全部', '科学']} />)

        const inputs = screen.getAllByPlaceholderText('搜索项目、材料、作者...')
        await user.clear(inputs[0])
        await user.type(inputs[0], '新词')
        await user.keyboard('{Enter}')

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(screen.getByRole('button', { name: /旧词/ })).toBeInTheDocument()
        expect(inputs[0]).toHaveValue('新词')
    })

    it('does not leak an unsubmitted draft into category filtering', async () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ projects: [], hasMore: false, total: 0 }) } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[makeProject(1, '初始项目')]} initialHasMore={false} categories={['全部', '科学']} />)

        const input = screen.getAllByPlaceholderText('搜索项目、材料、作者...')[0]
        await user.type(input, '草稿')
        await user.click(screen.getByRole('button', { name: '科学' }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain('category=%E7%A7%91%E5%AD%A6')
        expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('q=')
        expect(input).toHaveValue('草稿')
    })

    it('clears search while preserving other applied filters', async () => {
        currentSearchParams = new URLSearchParams('q=旧词&category=科学')
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ projects: [], hasMore: false, total: 0 }) } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[makeProject(1, '初始项目')]} initialHasMore={false} categories={['全部', '科学']} />)

        await user.click(screen.getAllByRole('button', { name: '清空搜索' })[0])
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
        expect(requestUrl).not.toContain('q=')
        expect(requestUrl).toContain('category=%E7%A7%91%E5%AD%A6')
    })

    it('keeps a failed clear visibly empty while retaining the applied query', async () => {
        currentSearchParams = new URLSearchParams('q=旧词')
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValue({ ok: false, text: async () => 'failed' } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[makeProject(1, '初始项目')]} initialHasMore={false} categories={['全部', '科学']} />)
        const input = screen.getAllByPlaceholderText('搜索项目、材料、作者...')[0]
        await user.click(screen.getAllByRole('button', { name: '清空搜索' })[0])
        expect(input).toHaveValue('')
        expect(screen.getByRole('button', { name: /旧词/ })).toBeInTheDocument()
    })

    it('does not let a delayed search response replace a newer draft', async () => {
        const fetchMock = vi.mocked(fetch)
        let resolveSearch!: (response: Response) => void
        fetchMock.mockImplementation(async (input) => {
            if (String(input).includes('/api/projects')) {
                return new Promise<Response>((resolve) => { resolveSearch = resolve })
            }
            return { ok: true, json: async () => ({ projects: [], hasMore: false, total: 0 }) } as Response
        })
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[makeProject(1, '初始项目')]} initialHasMore={false} categories={['全部', '科学']} />)
        const input = screen.getAllByPlaceholderText('搜索项目、材料、作者...')[0]
        await user.type(input, '慢查询')
        await user.keyboard('{Enter}')
        await waitFor(() => expect(resolveSearch).toBeTypeOf('function'))
        await user.type(input, '新草稿')
        resolveSearch({ ok: true, json: async () => ({ projects: [makeProject(2, '慢结果')], hasMore: false, total: 1 }) } as Response)
        await waitFor(() => expect(screen.getByTestId('explore-project-grid')).toHaveTextContent('慢结果'))
        expect(input).toHaveValue('慢查询新草稿')
    })
    it('discards difficulty and age draft edits on cancel', async () => {
        currentSearchParams = new URLSearchParams({ category: '科学', tags: '趣味实验', sortBy: 'latest' })
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[]} initialHasMore={false} />)
        await user.click(screen.getByTestId('explore-desktop-filters'))
        let sheet = within(screen.getByTestId('sheet'))
        await user.click(sheet.getByRole('button', { name: '入门' }))
        await user.type(sheet.getByRole('spinbutton', { name: '孩子年龄' }), '8')
        await user.click(sheet.getByRole('button', { name: '取消' }))
        expect(screen.queryByRole('button', { name: '趣味实验' })).not.toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: '项目排序' })).toHaveTextContent('最新')
        expect(fetch).not.toHaveBeenCalled()
        await user.click(screen.getByTestId('explore-desktop-filters'))
        sheet = within(screen.getByTestId('sheet'))
        expect(sheet.getByRole('button', { name: '入门' })).toHaveAttribute('aria-pressed', 'false')
        expect(sheet.getByRole('spinbutton', { name: '孩子年龄' })).toHaveValue(null)
    })

    it.each([0, 1])('resets common filters from reset control %s while preserving category, themes, query, and sorting', async (resetIndex) => {
        currentSearchParams = new URLSearchParams({ category: '科学', subCategory: '物理', difficulty: 'beginner', age: '8', q: '电池', tags: '趣味实验,科教版', sortBy: 'latest' })
        vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ projects: [], hasMore: false, total: 0 }) } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[]} initialHasMore={false} />)
        await user.click(screen.getByTestId('explore-desktop-filters'))
        const sheet = within(screen.getByTestId('sheet'))
        // The DOM harness does not apply responsive CSS; exercise both reset locations.
        await user.click(sheet.getAllByRole('button', { name: '重置' })[resetIndex])
        await user.click(sheet.getByRole('button', { name: '查看结果' }))
        await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1))
        const request = new URL(String(vi.mocked(fetch).mock.calls[0][0]), 'http://localhost')
        expect(request.searchParams.get('category')).toBe('科学')
        expect(request.searchParams.get('tags')).toBeNull()
        expect(request.searchParams.get('q')).toBe('电池')
        expect(request.searchParams.get('sortBy')).toBe('latest')
        expect(request.searchParams.get('subCategory')).toBeNull()
        expect(request.searchParams.get('difficulty')).toBeNull()
        expect(request.searchParams.get('age')).toBeNull()
    })

    it('changes independent sorting without clearing the selected theme', async () => {
        currentSearchParams = new URLSearchParams({ tags: '趣味实验' })
        vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ projects: [], hasMore: false, total: 0 }) } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[]} initialHasMore={false} />)
        await user.click(screen.getByRole('combobox', { name: '项目排序' }))
        await user.click(screen.getByRole('option', { name: '最新发布' }))
        await waitFor(() => expect(screen.getByRole('combobox', { name: '项目排序' })).not.toBeDisabled())
        const request = new URL(String(vi.mocked(fetch).mock.calls.at(-1)?.[0]), 'http://localhost')
        expect(request.searchParams.get('sortBy')).toBe('latest')
        expect(request.searchParams.get('tags')).toBeNull()
        expect(screen.queryByRole('button', { name: '趣味实验' })).not.toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: '项目排序' })).toHaveTextContent('最新')
    })

    it('drops unsupported URL tags from the next category request while retaining supported themes', async () => {
        currentSearchParams = new URLSearchParams({ tags: '编织,趣味实验' })
        vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ projects: [], hasMore: false, total: 0 }) } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[]} initialHasMore={false} categories={['全部', '科学']} availableTags={['编织', '磁力']} tagScope={{ all: ['编织', '磁力'], byCategory: { 科学: ['磁力'] }, bySubCategory: {} }} />)
        expect(screen.queryByTestId('explore-filter-summary')).not.toBeInTheDocument()
        await user.click(screen.getByTestId('explore-category-strip').querySelectorAll('button')[1])
        await waitFor(() => expect(screen.getByRole('button', { name: '日常材料' })).not.toBeDisabled())
        const request = new URL(String(vi.mocked(fetch).mock.calls.at(-1)?.[0]), 'http://localhost')
        expect(request.searchParams.get('category')).toBe('科学')
        expect(request.searchParams.get('tags')).toBeNull()
        expect(screen.queryByTestId('explore-filter-summary')).not.toBeInTheDocument()
    })

    it('hides sorting for materials while preserving the selected normal sort for leaving that theme', async () => {
        currentSearchParams = new URLSearchParams({ tags: '日常材料', sortBy: 'latest' })
        vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ projects: [], hasMore: false, total: 0 }) } as Response)
        const user = userEvent.setup()
        render(<ExploreClient initialProjects={[]} initialHasMore={false} />)
        expect(screen.queryByText('材料优先')).not.toBeInTheDocument()
        expect(screen.queryByRole('combobox', { name: '项目排序' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: '日常材料' }))
        await waitFor(() => expect(screen.getByRole('combobox', { name: '项目排序' })).toHaveTextContent('最新'))
    })

})
