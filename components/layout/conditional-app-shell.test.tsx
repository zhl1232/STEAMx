import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConditionalAppShell } from './conditional-app-shell'

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

function renderShell(pathname: string, children: ReactNode = <div data-testid="page-owned-mobile-header" />) {
  mockUsePathname.mockReturnValue(pathname)

  return render(<ConditionalAppShell>{children}</ConditionalAppShell>)
}

describe('ConditionalAppShell mobile header policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: null })
  })

  it.each(['/leaderboard', '/admin', '/admin/projects/1', '/moderator/apply', '/playground'])(
    'does not add the shell mobile global header on %s',
    (pathname) => {
      renderShell(pathname)

      expect(screen.queryByTestId('shell-mobile-global-header')).not.toBeInTheDocument()
      expect(screen.getByTestId('page-owned-mobile-header')).toBeInTheDocument()
    },
  )

  it.each(['/shop', '/coins', '/settings', '/settings/profile'])(
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
