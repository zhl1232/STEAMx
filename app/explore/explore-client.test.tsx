import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ButtonHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExploreClient } from './explore-client'
import type { Project } from '@/lib/mappers/types'

const clearLikesDeltaForProjects = vi.fn()
const toast = vi.fn()
let currentSearchParams = new URLSearchParams()
let latestIntersectionCallback: IntersectionObserverCallback | null = null

vi.mock('next/navigation', () => ({
    useSearchParams: () => currentSearchParams,
}))

vi.mock('@/lib/context/project-context', () => ({
    useProjects: () => ({
        clearLikesDeltaForProjects,
    }),
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
    Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
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

vi.mock('@/lib/config/categories', () => ({
    CATEGORY_CONFIG: {
        科学: ['物理'],
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}))

class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds = []

    constructor(callback: IntersectionObserverCallback) {
        latestIntersectionCallback = callback
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
    if (!latestIntersectionCallback) {
        throw new Error('IntersectionObserver callback not registered')
    }

    latestIntersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
    )
}

function createAbortError() {
    return new DOMException('Aborted', 'AbortError')
}

describe('ExploreClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        currentSearchParams = new URLSearchParams()
        latestIntersectionCallback = null
        vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
        vi.stubGlobal('fetch', vi.fn())
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

        act(() => {
            triggerIntersection()
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

        act(() => {
            triggerIntersection()
        })

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        await user.click(screen.getByRole('button', { name: /科学/ }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(loadMoreSignal?.aborted).toBe(true))
        expect(await screen.findByText('筛选项目')).toBeInTheDocument()
        expect(screen.queryByText('第三页项目')).not.toBeInTheDocument()
    })

    it('scopes tags by category and reveals more tags on demand', async () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                projects: [makeProject(2, '科学项目')],
                hasMore: false,
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

        await user.click(screen.getByRole('button', { name: /筛选/ }))

        expect(screen.getByRole('button', { name: '1星' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '编织' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '折射' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /展开更多标签/ }))

        expect(screen.getByRole('button', { name: '观察' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '折射' })).toBeInTheDocument()
    })
})
