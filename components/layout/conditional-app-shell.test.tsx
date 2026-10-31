import { useEffect, type ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConditionalAppShell, shouldShowSiteFooter } from './conditional-app-shell'
import { SiteFooter } from './site-footer'
import readerStyles from './textbook-reader.module.css'
import { readFileSync } from 'node:fs'
import type { Window as HappyWindow } from 'happy-dom'

const { mockUseAuth, mockUsePathname } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUsePathname: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/lib/context/gamification-context', () => ({
  GamificationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/context/login-prompt-context', () => ({
  LoginPromptProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLoginPrompt: () => ({ promptLogin: vi.fn() }),
}))

vi.mock('@/lib/context/notification-context', () => ({
  NotificationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/context/project-context', () => ({
  ProjectProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/testing/playwright-smoke', () => ({
  isPlaywrightSmokeClient: () => false,
}))

vi.mock('@/components/layout/bottom-nav', () => ({
  BottomNav: () => <nav data-testid="bottom-nav" />,
}))

vi.mock('@/components/features/gamification/daily-check-in-sync', () => ({
  DailyCheckInSync: () => <div data-testid="daily-check-in-sync" />,
}))

vi.mock('@/components/features/communications/platform-communications', () => ({
  PlatformCommunications: () => <aside data-testid="platform-communications" />,
}))

vi.mock('@/components/features/tutor/global-tutor-mount', () => ({
  GlobalTutorMount: () => null,
}))

vi.mock('@/components/layout/main-nav', () => ({
  MainNav: () => <nav data-testid="desktop-main-nav" />,
}))

vi.mock('@/components/layout/mobile-global-header', () => ({
  MobileGlobalHeader: () => <header data-testid="shell-mobile-global-header" />,
}))

vi.mock('@/components/layout/notification-bell', () => ({
  NotificationBell: () => null,
}))

vi.mock('@/components/layout/share-button', () => ({
  ShareButton: () => null,
}))

vi.mock('@/components/layout/theme-toggle', () => ({
  ThemeToggle: () => null,
}))

vi.mock('@/components/layout/user-button', () => ({
  UserButton: () => null,
}))

vi.mock('@/components/layout/logo', () => ({
  SteamLogo: () => <span data-testid="steam-logo" />,
}))

function renderShell(
  pathname: string,
  children: ReactNode = <div data-testid="page-owned-mobile-header" />,
  footer: ReactNode = <footer data-testid="site-footer">京ICP备2025129751号-3</footer>,
) {
  mockUsePathname.mockReturnValue(pathname)

  return render(<ConditionalAppShell footer={footer}>{children}</ConditionalAppShell>)
}

describe('ConditionalAppShell mobile header policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: null })
  })

  it('reclaims first-lesson chrome in portrait and landscape and restores it when leaving', () => {
    const style = document.createElement('style')
    const css = readFileSync('components/layout/textbook-reader.module.css', 'utf8')
      .replaceAll('.chrome', `.${readerStyles.chrome}`).replaceAll('.page', `.${readerStyles.page}`)
    // happy-dom treats comma-separated queries as AND. Two equivalent rules
    // retain browser OR semantics while exercising the actual scoped stylesheet.
    style.textContent = css.replace('(max-width: 767px), (max-height: 500px)', '(max-width: 767px)')
      + css.replace('(max-width: 767px), (max-height: 500px)', '(max-height: 500px)')
    document.head.append(style)
    const footer = <footer data-testid="site-footer">页脚</footer>
    mockUsePathname.mockReturnValue('/textbook/p1a-1-1')
    const view = render(<ConditionalAppShell footer={footer}><div>课本</div></ConditionalAppShell>)
    try {
      for (const [width, height] of [[390, 844], [844, 390], [390, 844]]) {
        (window as unknown as HappyWindow).happyDOM.setViewport({ width, height })
        style.textContent += ' '
        expect(screen.queryByTestId('shell-mobile-global-header')).toBeNull()
        expect(screen.queryByTestId('bottom-nav')).toBeNull()
        expect(getComputedStyle(screen.getByTestId('site-footer').parentElement!).display).toBe('none')
        expect(getComputedStyle(view.container.querySelector('.app-desktop-header')!).display).toBe('none')
      }
      for (const route of ['/textbook', '/textbook/p1a-1-2', '/']) {
        mockUsePathname.mockReturnValue(route)
        view.rerender(<ConditionalAppShell footer={footer}><div>其他页面</div></ConditionalAppShell>)
        expect(screen.getByTestId('shell-mobile-global-header')).toBeInTheDocument()
        expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
        expect(screen.getByTestId('site-footer').parentElement).not.toHaveClass(readerStyles.chrome)
      }
    } finally {
      style.remove()
      ;(window as unknown as HappyWindow).happyDOM.setViewport({ width: 1024, height: 768 })
    }
  })

  it.each(['/leaderboard', '/admin', '/admin/projects/1', '/moderator/apply', '/playground', '/works/18'])(
    'does not add the shell mobile global header on %s',
    (pathname) => {
      renderShell(pathname)

      expect(screen.queryByTestId('shell-mobile-global-header')).not.toBeInTheDocument()
      expect(screen.getByTestId('page-owned-mobile-header')).toBeInTheDocument()
    },
  )

  it.each(['/shop', '/coins', '/settings', '/settings/profile', '/about'])(
    'lets the mobile function route %s own its header',
    (pathname) => {
      renderShell(pathname)

      expect(screen.queryByTestId('shell-mobile-global-header')).not.toBeInTheDocument()
      expect(screen.getByTestId('page-owned-mobile-header')).toBeInTheDocument()
    },
  )

  it('keeps the shell mobile global header on the home route', () => {
    renderShell('/', <div data-testid="page-content" />)

    expect(screen.getByTestId('shell-mobile-global-header')).toBeInTheDocument()
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
  })

  it.each(['/store', '/store/products/123', '/store/checkout', '/store/orders', '/store/orders/123', '/store/support', '/store/coupons'])(
    'uses the focused commerce navigation on %s',
    (pathname) => {
      renderShell(pathname)

      expect(screen.queryByTestId('shell-mobile-global-header')).not.toBeInTheDocument()
      expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument()
      expect(screen.queryByTestId('desktop-main-nav')).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: '返回主站' })).toHaveAttribute('href', '/')
      expect(screen.getByTestId('page-owned-mobile-header')).toBeInTheDocument()
      expect(screen.getByTestId('site-footer').parentElement).toHaveClass('hidden', 'md:block')
    },
  )

  it('keeps site navigation on similarly named non-commerce routes', () => {
    renderShell('/storefront')

    expect(screen.getByTestId('shell-mobile-global-header')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
    expect(screen.getByTestId('desktop-main-nav')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '返回主站' })).not.toBeInTheDocument()
  })

  it('gives the physics lab the shared mobile account header and site navigation', () => {
    renderShell('/playground/physics-lab', <div data-testid="physics-workspace" />)
    expect(screen.getByTestId('shell-mobile-global-header')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
    expect(screen.getByTestId('physics-workspace')).toBeInTheDocument()
  })

  it('does not mount daily check-in sync for anonymous users on the home route', () => {
    renderShell('/', <div data-testid="page-content" />)

    expect(screen.queryByTestId('daily-check-in-sync')).not.toBeInTheDocument()
  })

  it('mounts daily check-in sync for authenticated users on the home route', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })

    renderShell('/', <div data-testid="page-content" />)

    expect(screen.getByTestId('daily-check-in-sync')).toBeInTheDocument()
  })

  it('keeps the bottom nav on the playground hub but hides it on playground game routes', () => {
    const { unmount } = renderShell('/playground', <div data-testid="page-content" />)

    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()

    unmount()
    renderShell('/playground/minesweeper', <div data-testid="page-content" />)

    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument()

    unmount()
    renderShell('/works/18', <div data-testid="page-content" />)

    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument()
  })

  it.each([null, { id: 'user-1' }])('keeps the public help guide reachable with user %j', (user) => {
    mockUseAuth.mockReturnValue({ user })
    renderShell('/', <div data-testid="page-content" />, <SiteFooter />)

    expect(screen.getByRole('link', { name: '新手开始' })).toHaveAttribute('href', '/start')
  })

  it('shows the site footer on public pages and hides it on immersive routes', () => {
    const { unmount } = renderShell('/', <div data-testid="page-content" />)

    expect(screen.getByTestId('site-footer')).toBeInTheDocument()

    unmount()
    renderShell('/playground/minesweeper', <div data-testid="page-content" />)

    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument()
  })

  it.each(['/create', '/explore', '/nature', '/profile'])(
    'lets the primary mobile entry route %s own its header',
    (pathname) => {
      renderShell(pathname)

      expect(screen.queryByTestId('shell-mobile-global-header')).not.toBeInTheDocument()
      expect(screen.getByTestId('page-owned-mobile-header')).toBeInTheDocument()
    },
  )

  it.each(['/courses', '/courses/2', '/courses/2/lessons/9', '/courses/2/lessons/9/preview'])(
    'lets course routes %s own their mobile header',
    (pathname) => {
      renderShell(pathname)

      expect(screen.queryByTestId('shell-mobile-global-header')).not.toBeInTheDocument()
      expect(screen.getByTestId('page-owned-mobile-header')).toBeInTheDocument()
    },
  )
})

describe('shouldShowSiteFooter', () => {
  it('keeps the footer on public pages and hides it on login, games, lessons, and admin', () => {
    expect(shouldShowSiteFooter('/')).toBe(true)
    expect(shouldShowSiteFooter('/project/12')).toBe(true)
    expect(shouldShowSiteFooter('/legal/privacy')).toBe(true)
    expect(shouldShowSiteFooter('/login')).toBe(false)
    expect(shouldShowSiteFooter('/playground/minesweeper')).toBe(false)
    expect(shouldShowSiteFooter('/courses/2/lessons/9')).toBe(false)
    expect(shouldShowSiteFooter('/admin')).toBe(false)
  })
})

describe('ConditionalAppShell provider tree stability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: null })
  })

  function MountProbe({ onMount }: { onMount: () => void }) {
    useEffect(() => {
      onMount()
    }, [onMount])

    return <div data-testid="page-content" />
  }

  // 包装层数量随登录态变化会让 React 把整棵页面子树当成新节点重挂，
  // 首屏渲染好的页面会在鉴权返回后被整个丢掉重建。
  it.each(['/', '/nature', '/nature/observations/1', '/explore', '/store', '/store/orders'])(
    'keeps the page subtree mounted on %s when auth resolves',
    (pathname) => {
      const onMount = vi.fn()
      mockUsePathname.mockReturnValue(pathname)
      const children = <MountProbe onMount={onMount} />

      const { rerender } = render(<ConditionalAppShell>{children}</ConditionalAppShell>)
      expect(onMount).toHaveBeenCalledTimes(1)

      mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
      rerender(<ConditionalAppShell>{children}</ConditionalAppShell>)

      expect(onMount).toHaveBeenCalledTimes(1)
    },
  )
})
