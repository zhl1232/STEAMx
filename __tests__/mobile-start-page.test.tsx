import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import StartPage from '@/app/start/page'
import { PLATFORM_START_ACTIONS } from '@/lib/product/onboarding'

vi.mock('@/lib/seo/metadata', () => ({ buildPageMetadata: (value: unknown) => value }))
afterEach(cleanup)

describe('start page', () => {
  it('shows four equal choices and does not prescribe an observation task', () => {
    render(<StartPage />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('今天想和孩子做点什么？')
    const nav = screen.getByRole('navigation', { name: '选择开始方向' })
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
    for (const action of PLATFORM_START_ACTIONS) {
      expect(within(nav).getByRole('link', { name: new RegExp(action.label) }).getAttribute('href')).toBe(action.href)
    }
    expect(screen.queryByText(/开始这次观察|观察身边的一棵树|申请入群/)).toBeNull()
    expect(screen.getByRole('link', { name: '先随便看看' }).getAttribute('href')).toBe('/explore')
    expect(screen.getByRole('link', { name: '联系客服' }).getAttribute('href')).toBe('/support')
  })
})
