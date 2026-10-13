import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import CoursesPage from '@/app/courses/page'

const query = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/lib/api/courses', () => ({ listApprovedCourses: query.list }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))
vi.mock('@/lib/content-classification', () => ({ getContentClassificationSettings: async () => ({ publicV1Enabled: false }) }))
vi.mock('@/lib/seo/metadata', () => ({ buildPageMetadata: (value: unknown) => value }))
vi.mock('@/lib/seo/json-ld', () => ({ buildBreadcrumbJsonLd: () => ({}) }))
vi.mock('@/components/seo/json-ld', () => ({ JsonLd: () => null }))
vi.mock('@/components/layout/mobile-global-header', () => ({ MobileGlobalHeader: () => null }))
vi.mock('@/components/features/courses/course-board', () => ({
  CourseBoard: ({ initialFilter }: { initialFilter: string }) => <div data-testid="selected-category">{initialFilter}</div>,
  CourseBoardError: ({ retryHref }: { retryHref: string }) => <a href={retryHref}>重试</a>,
}))
afterEach(() => { cleanup(); query.list.mockReset() })

describe('course entry search params', () => {
  it.each(['brick', 'programming'])('initializes the chosen category %s', async category => {
    query.list.mockResolvedValue([])
    render(await CoursesPage({ searchParams: Promise.resolve({ category }) }))
    expect(screen.getByTestId('selected-category').textContent).toBe(category)
  })
  it('preserves the selected category on a failed load', async () => {
    query.list.mockRejectedValue(new Error('offline'))
    render(await CoursesPage({ searchParams: Promise.resolve({ category: 'programming' }) }))
    expect(screen.getByRole('link', { name: '重试' }).getAttribute('href')).toBe('/courses?category=programming')
  })
  it('uses recommendations without valid search params', async () => {
    query.list.mockResolvedValue([])
    render(await CoursesPage({ searchParams: Promise.resolve({ category: ['brick', 'programming'] }) }))
    expect(screen.getByTestId('selected-category').textContent).toBe('recommended')
  })
})
