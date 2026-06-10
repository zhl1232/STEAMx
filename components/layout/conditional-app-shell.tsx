'use client'


import Link from 'next/link'
import { usePathname } from 'next/navigation'


import { BottomNav } from '@/components/layout/bottom-nav'
import { DailyCheckInSync } from '@/components/features/gamification/daily-check-in-sync'
import { MainNav } from '@/components/layout/main-nav'
import { MobileGlobalHeader } from '@/components/layout/mobile-global-header'
import { NotificationBell } from '@/components/layout/notification-bell'
import { ShareButton } from '@/components/layout/share-button'
import { SteamLogo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { UserButton } from '@/components/layout/user-button'
import { useAuth } from '@/lib/context/auth-context'
import { ProjectProvider } from '@/lib/context/project-context'
import { GamificationProvider } from '@/lib/context/gamification-context'
import { LoginPromptProvider } from '@/lib/context/login-prompt-context'
import { NotificationProvider } from '@/lib/context/notification-context'
import { isPlaywrightSmokeClient } from '@/lib/testing/playwright-smoke'
import { cn } from '@/lib/utils'

const pageOwnedMobileHeaderRoots = [
  '/profile',
  '/messages',
  '/users',
  '/settings',
  '/project',
  '/shop',
  '/coins',
  '/nature',
  '/legal',
  '/share',
  '/pbl',
  '/resources',
  '/explore/species',
  '/explore/observations',
  '/leaderboard',
  '/admin',
  '/moderator',
  '/playground',
] as const

function isPathOrDescendant(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`)
}

export function hasPageOwnedMobileHeader(pathname: string) {
  return (
    pathname === '/explore' ||
    pathname === '/create' ||
    pageOwnedMobileHeaderRoots.some((root) => isPathOrDescendant(pathname, root))
  )
}

function AppProviders({
  children,
  includeGamification,
  includeNotifications,
}: {
  children: React.ReactNode
  includeGamification: boolean
  includeNotifications: boolean
}) {
  let content = children

  if (includeNotifications) {
    content = <NotificationProvider>{content}</NotificationProvider>
  }

  if (includeGamification) {
    content = (
      <GamificationProvider>
        <DailyCheckInSync />
        {content}
      </GamificationProvider>
    )
  }

  return <LoginPromptProvider>{content}</LoginPromptProvider>
}

export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const smokeMode = isPlaywrightSmokeClient()
  const isAuthPage = pathname === '/login'
  const isHomePage = pathname === '/'

  const isProfilePage = pathname.startsWith('/profile')
  const isScratchLessonPage = /^\/courses\/\d+\/lessons\/\d+/.test(pathname)
  const hideMobileBottomNav =
    pathname === '/project' ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/pbl/') ||
    pathname === '/nature/submit' ||
    /^\/nature\/observations\/[^/]+$/.test(pathname) ||
    pathname.startsWith('/project/') ||
    isScratchLessonPage
  const hideGlobalHeader = pathname.startsWith('/share')
  const hideMobileGlobalHeader = hasPageOwnedMobileHeader(pathname)
  const showMobileGlobalHeader = !hideMobileGlobalHeader
  const isNatureRoute = pathname === '/nature' || pathname.startsWith('/nature/')
  const needsGamificationOnAnonymousNature =
    pathname === '/nature/submit' || pathname.startsWith('/nature/submitted/')
  const needsProjectProvider =
    pathname.startsWith('/explore') ||
    pathname.startsWith('/project') ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/users')
  const skipHeavyProvidersForAnonymousNature =
    isNatureRoute && !user && !needsGamificationOnAnonymousNature
  const includeGamificationProvider = Boolean(user) || (!isHomePage && !skipHeavyProvidersForAnonymousNature)
  const includeNotificationProvider = !skipHeavyProvidersForAnonymousNature

  const pageContent = needsProjectProvider ? <ProjectProvider>{children}</ProjectProvider> : children

  if (isAuthPage) {
    return (
      <>
        <a href="#main-content" className="skip-link">
          跳到主内容
        </a>
        <main id="main-content" className="flex-1 pb-0">
          {children}
        </main>
      </>
    )
  }

  if (smokeMode) {
    return (
      <AppProviders includeGamification={includeGamificationProvider} includeNotifications={includeNotificationProvider}>
        <a href="#main-content" className="skip-link">
          跳到主内容
        </a>
        <div className="flex min-h-screen flex-col bg-background">
          <main
            id="main-content"
            className={cn('flex-1', hideMobileBottomNav ? 'pb-0' : 'pb-20', 'md:pb-0')}
          >
            {pageContent}
          </main>
        </div>
      </AppProviders>
    )
  }

  return (
    <AppProviders includeGamification={includeGamificationProvider} includeNotifications={includeNotificationProvider}>
      <a href="#main-content" className="skip-link">
        跳到主内容
      </a>
      <div
        className={cn('flex flex-col bg-background', isScratchLessonPage ? 'h-screen overflow-hidden' : 'min-h-screen')}
        style={{ ['--mobile-global-header-height' as string]: showMobileGlobalHeader ? '3rem' : '0rem' }}
      >
        {/* 移动端统一 Header */}
        {showMobileGlobalHeader ? (
          <MobileGlobalHeader />
        ) : null}
        {/* 桌面端 Header */}
        <header className={cn(
          "app-desktop-header",
          hideGlobalHeader && "hidden",
          "hidden md:block",
          isProfilePage
            ? "md:border-white/10 md:bg-background/66"
            : ""
        )}>
          <div className="app-header-bar">
            <div className="mr-3 flex items-center xl:mr-4">
              <Link className="mr-6 flex items-center space-x-2" href="/">
                <SteamLogo className="h-8 w-8" />
                <span className="nav-logo-text hidden whitespace-nowrap text-[20px] lg:inline-block xl:text-[24px]">STEAM 探索</span>
              </Link>
              <MainNav />
            </div>
            <div className="flex min-h-9 flex-1 items-center justify-end gap-2">
              <nav className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
                <ShareButton />
                <NotificationBell />
                <div className={cn(!user && "hidden")}>
                  <UserButton />
                </div>
                {!user ? <UserButton /> : null}
              </nav>
            </div>
          </div>
        </header>
        <main
          id="main-content"
          className={cn('flex-1', hideMobileBottomNav ? 'pb-0' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]', 'md:pb-0', isScratchLessonPage && 'overflow-hidden')}
        >
          {pageContent}
        </main>
        {!hideMobileBottomNav ? <BottomNav /> : null}
      </div>
    </AppProviders>
  )
}
