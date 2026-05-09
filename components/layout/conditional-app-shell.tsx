'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'


import { BottomNav } from '@/components/layout/bottom-nav'
import { HeaderSearch } from '@/components/layout/header-search'
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
    content = <GamificationProvider>{content}</GamificationProvider>
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
  const hideMobileBottomNav =
    pathname === '/project' ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/community/discussion/') ||
    pathname.startsWith('/community/challenge/') ||
    pathname === '/nature/submit' ||
    /^\/nature\/observations\/[^/]+$/.test(pathname) ||
    pathname.startsWith('/project/')
  const hideGlobalHeader = pathname.startsWith('/share')
  const hideMobileGlobalHeader =
    hideGlobalHeader ||
    pathname === '/explore' ||
    pathname.startsWith('/profile') ||
    pathname === '/community' ||
    pathname === '/messages' ||
    pathname.startsWith('/messages/') ||
    pathname.startsWith('/users/') ||
    pathname.startsWith('/settings') ||
    pathname === '/project' ||
    pathname.startsWith('/project/') ||
    pathname.startsWith('/shop') ||
    pathname.startsWith('/coins') ||
    pathname.startsWith('/nature') ||
    pathname.startsWith('/legal/') ||
    pathname.startsWith('/explore/species/') ||
    pathname.startsWith('/explore/observations/') ||
    pathname.startsWith('/community/discussion/') ||
    pathname.startsWith('/community/challenge/')
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
  const includeHeavyUserProviders = !isHomePage && !skipHeavyProvidersForAnonymousNature

  const pageContent = needsProjectProvider ? <ProjectProvider>{children}</ProjectProvider> : children

  if (isAuthPage) {
    return <main className="flex-1 pb-0">{children}</main>
  }

  if (smokeMode) {
    return (
      <AppProviders includeGamification={includeHeavyUserProviders} includeNotifications={includeHeavyUserProviders}>
        <div className="flex min-h-screen flex-col bg-background">
          <main className={cn('flex-1', hideMobileBottomNav ? 'pb-0' : 'pb-20', 'md:pb-0')}>{pageContent}</main>
        </div>
      </AppProviders>
    )
  }

  return (
    <AppProviders includeGamification={includeHeavyUserProviders} includeNotifications={includeHeavyUserProviders}>
      <div
        className="flex min-h-screen flex-col bg-background"
        style={{ ['--mobile-global-header-height' as string]: showMobileGlobalHeader ? '4rem' : '0rem' }}
      >
        {/* 移动端统一 Header */}
        {showMobileGlobalHeader ? (
          <MobileGlobalHeader />
        ) : null}
        {/* 桌面端 Header */}
        <header className={cn(
          "sticky top-0 z-50 w-full border-b border-[#dfe8f2] bg-white/92 shadow-[0_10px_36px_-28px_rgba(27,70,126,0.25)] backdrop-blur-xl transition-colors duration-300 pt-[env(safe-area-inset-top)] supports-[backdrop-filter]:bg-white/82 dark:border-[#243348] dark:bg-[#070b12]/94 dark:shadow-none dark:supports-[backdrop-filter]:bg-[#070b12]/84",
          hideGlobalHeader && "hidden",
          "hidden md:block",
          isProfilePage
            ? "md:border-white/10 md:bg-background/66"
            : ""
        )}>
          <div className="mx-auto flex h-16 max-w-[1840px] items-center px-8">
            <div className="mr-3 flex items-center xl:mr-4">
              <Link className="mr-6 flex items-center space-x-2" href="/">
                <SteamLogo className="h-8 w-8" />
                <span className="hidden whitespace-nowrap font-heading text-[20px] font-extrabold text-[#143f7d] dark:text-[#8bbdff] lg:inline-block xl:text-[24px]">STEAM 探索</span>
              </Link>
              <MainNav />
            </div>
            <div className="flex min-h-9 flex-1 items-center justify-end gap-2">
              <div className="flex items-center">
                <Suspense fallback={<div className="h-9 w-[200px]" />}>
                  <HeaderSearch />
                </Suspense>
              </div>
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
        <main className={cn('flex-1', hideMobileBottomNav ? 'pb-0' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]', 'md:pb-0')}>{pageContent}</main>
        {!hideMobileBottomNav ? <BottomNav /> : null}
      </div>
    </AppProviders>
  )
}
