import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WelcomeActions } from './welcome-actions'

const route = vi.hoisted(() => ({ pathname: '/messages' }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  route.pathname = '/messages'
})

describe('welcome actions', () => {
  it('has one primary action, no group instruction, and a real support target', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ settings: { contact_href: '/about#contact' } })))
    const onRead = vi.fn()
    render(<WelcomeActions onRead={onRead} />)
    expect(screen.getByRole('link', { name: '选一个开始' }).getAttribute('href')).toBe('/start')
    expect(screen.queryByText(/申请入群|请备注|查看探索指南/)).toBeNull()
    await waitFor(() => expect(screen.getByRole('link', { name: '联系客服' }).getAttribute('href')).toBe('/about#support'))
    fireEvent.click(screen.getByRole('link', { name: '联系客服' }))
    expect(onRead).toHaveBeenCalledTimes(1)
  })
  it('does not link newcomers back to the start page they are already on', () => {
    route.pathname = '/start'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<WelcomeActions onRead={() => {}} />)
    expect(screen.queryByRole('link', { name: '选一个开始' })).toBeNull()
    expect(screen.getByRole('link', { name: '联系客服' }).getAttribute('href')).toBe('/about#support')
  })
  it('keeps a configured safe internal support page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ settings: { contact_href: '/help#support' } })))
    render(<WelcomeActions onRead={() => {}} />)
    await waitFor(() => expect(screen.getByRole('link', { name: '联系客服' }).getAttribute('href')).toBe('/help#support'))
  })
})
