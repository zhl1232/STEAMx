import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ButtonHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExploreClient } from './explore-client'
import type { Project } from '@/lib/mappers/types'

const clearLikesDeltaForProjects = vi.fn()
const toast = vi.fn()
let mockAuth = {
    user: null as { id: string } | null,
    loading: false,
}
let mockGamification = {
    level: 1,
    progress: 0,
    levelProgress: 0,
    levelTotalNeeded: 100,
    unlockedBadges: new Set<string>(),
    userStats: undefined as { projectsCompleted: number } | undefined,
}
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

vi.mock('@/lib/context/auth-context', () => ({
    useAuth: () => mockAuth,
}))

vi.mock('@/lib/context/gamification-context', () => ({
    useGamification: () => mockGamification,
}))

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast,
    }),
}))

vi.mock('@/components/features/project-card', () => ({
    ProjectCard: ({ project }: { project: Project }) => <div>{project.title}</div>,
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
        mockAuth = {
            user: null,
            loading: false,
        }
        mockGamification = {
            level: 1,
            progress: 0,
            levelProgress: 0,
            levelTotalNeeded: 100,
            unlockedBadges: new Set<string>(),
            userStats: undefined,
        }
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

    it('shows a progress-saving prompt for signed-out users', () => {
        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore={false}
                categories={['全部', '科学']}
            />,
        )

        expect(screen.getByText('保存你的探索进度')).toBeInTheDocument()
        expect(screen.getByText('登录后可累计完成项目、经验值和成就勋章，回到这里继续下一步。')).toBeInTheDocument()
        expect(screen.getByText(/不知道从哪开始？试试「新手推荐」/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '登录保存进度' })).toHaveAttribute('href', '/login')
    })

    it('shows exploration progress for signed-in users', () => {
        mockAuth = {
            user: { id: 'user-1' },
            loading: false,
        }
        mockGamification = {
            level: 4,
            progress: 62.5,
            levelProgress: 250,
            levelTotalNeeded: 400,
            unlockedBadges: new Set(['first_step', 'explorer']),
            userStats: { projectsCompleted: 3 },
        }

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore={false}
                categories={['全部', '科学']}
            />,
        )

        expect(screen.getByText('你的探索进度')).toBeInTheDocument()
        expect(screen.getByText('Lv.4')).toBeInTheDocument()
        expect(screen.getByText('62%')).toBeInTheDocument()
        expect(screen.getByText('距离下一级还差 150 XP')).toBeInTheDocument()
        expect(screen.getByText('3 个')).toBeInTheDocument()
        expect(screen.getByText('2 枚')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '查看探索记录' })).toHaveAttribute('href', '/profile/library')
    })

    it('keeps completed projects in a syncing state until stats load', () => {
        mockAuth = {
            user: { id: 'user-1' },
            loading: false,
        }
        mockGamification = {
            level: 2,
            progress: 25,
            levelProgress: 75,
            levelTotalNeeded: 300,
            unlockedBadges: new Set(),
            userStats: undefined,
        }

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore={false}
                categories={['全部', '科学']}
            />,
        )

        expect(screen.getByText('完成项目')).toBeInTheDocument()
        expect(screen.getByText('同步中')).toBeInTheDocument()
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

        await user.click(screen.getByRole('button', { name: /科学/ }))
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
        await user.click(screen.getByRole('button', { name: /科学/ }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(loadMoreSignal?.aborted).toBe(true))
        expect(await screen.findByText('筛选项目')).toBeInTheDocument()
        expect(screen.queryByText('第三页项目')).not.toBeInTheDocument()
    })

    it('scopes tags by category and opens the tag picker for the full list', async () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                projects: [makeProject(2, '科学项目')],
                hasMore: false,
                total: 1,
            }),
        } as Response)

        const user = userEvent.setup()

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore={false}
                categories={['全部', '科学', '艺术']}
                availableTags={[
                    '磁力', '观察', '实验', '记录', '动手', '材料', '安全', '流程', '现象', '编织',
                    '声音', '测量', '光影', '空气', '反应', '能量', '导电', '结构', '温度', '速度',
                    '轨迹', '对比', '验证', '模型', '工具', '折射',
                ]}
                tagScope={{
                    all: [
                        '磁力', '观察', '实验', '记录', '动手', '材料', '安全', '流程', '现象', '编织',
                        '声音', '测量', '光影', '空气', '反应', '能量', '导电', '结构', '温度', '速度',
                        '轨迹', '对比', '验证', '模型', '工具', '折射',
                    ],
                    byCategory: {
                        科学: [
                            '磁力', '观察', '实验', '记录', '动手', '材料', '安全', '流程', '现象',
                            '声音', '测量', '光影', '空气', '反应', '能量', '导电', '结构', '温度', '速度',
                            '轨迹', '对比', '验证', '模型', '工具', '折射',
                        ],
                        艺术: ['编织'],
                    },
                    bySubCategory: {
                        物理: ['磁力', '观察'],
                    },
                }}
            />,
        )

        await user.click(screen.getByRole('button', { name: '科学' }))
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole('button', { name: '筛选' }))

        expect(screen.getByRole('button', { name: '1星' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '编织' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '折射' })).not.toBeInTheDocument()

        expect(screen.queryByText(/还有 \d+ 个/)).not.toBeInTheDocument()

        await user.click(screen.getByTestId('explore-more-tags'))

        expect(screen.getByTestId('explore-tag-picker')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '观察' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '折射' })).toBeInTheDocument()
    })

    it('shows results chrome after category filtering', async () => {
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

        expect(screen.getByRole('button', { name: '最新上架' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /科学/ }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        expect(screen.queryByRole('button', { name: '最新上架' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: '返回探索' })).toBeInTheDocument()
        expect(screen.getByText('共找到 42 个项目')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '推荐' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '最新' })).toBeInTheDocument()
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
        expect(screen.getByRole('button', { name: '热门推荐' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: '最新上架' })).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByRole('button', { name: '新手推荐' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('keeps preset tabs available in explore mode when beginner-friendly is active', async () => {
        currentSearchParams = new URLSearchParams('difficulty=1-2&sortBy=popular')
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                projects: [makeProject(2, '最新项目')],
                hasMore: false,
                total: 2,
            }),
        } as Response)

        const user = userEvent.setup()

        render(
            <ExploreClient
                initialProjects={[makeProject(1, '初始项目')]}
                initialHasMore={false}
                categories={['全部', '科学']}
            />,
        )

        expect(screen.getByRole('button', { name: '新手推荐' })).toHaveAttribute('aria-pressed', 'true')

        await user.click(screen.getByRole('button', { name: '最新上架' }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        expect(await screen.findByText('最新项目')).toBeInTheDocument()
    })
})
