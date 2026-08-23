'use client'


import Link from 'next/link'
import { usePathname } from 'next/navigation'


import { BottomNav } from '@/components/layout/bottom-nav'
import { DailyCheckInSync } from '@/components/features/gamification/daily-check-in-sync'
import { GlobalTutorMount } from '@/components/features/tutor/global-tutor-mount'
import { TutorProvider } from '@/components/features/tutor/tutor-context'
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
import { BRAND_NAME } from '@/lib/brand'

const pageOwnedMobileHeaderRoots = [
  '/courses',
  '/profile',
  '/messages',
  '/users',
  '/settings',
  '/project',
  '/works',
  '/shop',
  '/coins',
  '/nature',
  '/legal',
  '/share',
  '/pbl',
  '/resources',
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

// 这几层必须无条件渲染。之前按登录态增删包装层，登录态从 null 变成用户时整棵子树
// 在 React 看来换了位置，已经渲染好的页面会被卸载重挂（首屏 1～2 秒后 <main> 整个重建，
// 页面内的客户端状态全部丢失）。两个 Provider 在匿名态本身就是空转，不需要靠条件渲染省开销。
function AppProviders({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  return (
    <LoginPromptProvider>
      <GamificationProvider>
        {user ? <DailyCheckInSync /> : null}
        <NotificationProvider>{children}</NotificationProvider>
      </GamificationProvider>
    </LoginPromptProvider>
  )
}

export function shouldShowSiteFooter(pathname: string) {
  if (pathname === '/login') return false
  if (pathname.startsWith('/share')) return false
  if (pathname.startsWith('/admin')) return false
  if (pathname === '/nature/submit') return false
  if (pathname.startsWith('/playground/')) return false
  if (/^\/courses\/\d+\/lessons\/\d+/.test(pathname)) return false
  return true
}

export function ConditionalAppShell({
  children,
  footer,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const pathname = usePathname()
  const { user } = useAuth()
  const smokeMode = isPlaywrightSmokeClient()
  const isAuthPage = pathname === '/login'

  const isProfilePage = pathname.startsWith('/profile')
  const isCourseLessonPage = /^\/courses\/\d+\/lessons\/\d+/.test(pathname)
  const hideMobileBottomNav =
    pathname === '/project' ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/pbl/') ||
    pathname.startsWith('/playground/') ||
    pathname.startsWith('/works/') ||
    pathname === '/nature/submit' ||
    /^\/nature\/observations\/[^/]+$/.test(pathname) ||
    pathname.startsWith('/project/') ||
    isCourseLessonPage
  const hideGlobalHeader = pathname.startsWith('/share')
  const hideMobileGlobalHeader = hasPageOwnedMobileHeader(pathname)
  const showMobileGlobalHeader = !hideMobileGlobalHeader
  const needsProjectProvider =
    pathname.startsWith('/explore') ||
    pathname.startsWith('/project') ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/users')

  const pageContent = needsProjectProvider ? <ProjectProvider>{children}</ProjectProvider> : children
  const showSiteFooter = Boolean(footer) && !smokeMode && shouldShowSiteFooter(pathname)
  const mainNeedsMobileNavPadding = !hideMobileBottomNav && !showSiteFooter

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
      <AppProviders>
        <TutorProvider>
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
          <GlobalTutorMount />
        </div>
        </TutorProvider>
      </AppProviders>
    )
  }

  return (
    <AppProviders>
      <TutorProvider>
      <a href="#main-content" className="skip-link">
        跳到主内容
      </a>
      <div
        className="flex min-h-screen flex-col bg-background"
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
                <span className="nav-logo-text hidden whitespace-nowrap text-[20px] lg:inline-block xl:text-[24px]">{BRAND_NAME}</span>
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
          className={cn(
            'flex-1',
            mainNeedsMobileNavPadding ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : 'pb-0',
            'md:pb-0',
          )}
        >
          {pageContent}
        </main>
        {showSiteFooter ? (
          <div className={hideMobileBottomNav ? undefined : 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0'}>
            {footer}
          </div>
        ) : null}
        {!hideMobileBottomNav ? <BottomNav /> : null}
        <GlobalTutorMount />
      </div>
      </TutorProvider>
    </AppProviders>
  )
}
