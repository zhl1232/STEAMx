'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { BottomNav } from '@/components/layout/bottom-nav'
import { HeaderSearch } from '@/components/layout/header-search'
import { MainNav } from '@/components/layout/main-nav'
import { NotificationBell } from '@/components/layout/notification-bell'
import { ShareButton } from '@/components/layout/share-button'
import { SteamLogo } from '@/components/layout/logo'
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
  const hideMobileGlobalHeader =
    pathname.startsWith('/profile') ||
    pathname === '/community' ||
    pathname === '/messages' ||
    pathname.startsWith('/messages/') ||
    pathname.startsWith('/users/') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/project/') ||
    pathname.startsWith('/shop') ||
    pathname.startsWith('/coins') ||
    pathname.startsWith('/nature') ||
    pathname.startsWith('/bird-observation') ||
    pathname.startsWith('/legal/') ||
    pathname.startsWith('/explore/species/') ||
    pathname.startsWith('/explore/observations/') ||
    pathname.startsWith('/community/discussion/') ||
    pathname.startsWith('/community/challenge/')
  const showMobileGlobalHeader = !hideMobileGlobalHeader
  const showMobileSearch = pathname === '/' || pathname === '/explore'
  const needsProjectProvider =
    pathname.startsWith('/explore') ||
    pathname.startsWith('/project') ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/users')
  const includeHeavyUserProviders = !isHomePage

  const pageContent = needsProjectProvider ? <ProjectProvider>{children}</ProjectProvider> : children

  if (isAuthPage) {
    return <main className="flex-1 pb-0">{children}</main>
  }

  if (smokeMode) {
    return (
      <AppProviders includeGamification={includeHeavyUserProviders} includeNotifications={includeHeavyUserProviders}>
        <div className="flex min-h-screen flex-col bg-background">
          <main className={cn('flex-1', 'pb-20 md:pb-0')}>{pageContent}</main>
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
        <header className={cn(
          "sticky top-0 z-50 w-full border-b border-border/70 bg-background/88 shadow-[0_10px_36px_-26px_rgba(15,23,42,0.32)] backdrop-blur-xl transition-colors duration-300 pt-[env(safe-area-inset-top)] supports-[backdrop-filter]:bg-background/78",
          !showMobileGlobalHeader && "hidden md:block",
          isProfilePage
            ? "md:border-white/10 md:bg-background/66"
            : ""
        )}>
          <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-6">
            <div className="md:hidden flex h-9 items-center shrink-0 mr-2">
              <Link href="/" className="flex items-center space-x-2">
                <SteamLogo className="h-6 w-6 shrink-0" />
                {!showMobileSearch && <span className="font-heading text-base font-semibold hidden sm:inline-block">STEAM 探索</span>}
              </Link>
            </div>
            <div className="mr-4 hidden md:flex items-center">
              <Link className="mr-6 flex items-center space-x-2" href="/">
                <SteamLogo className="h-6 w-6 md:h-8 md:w-8" />
                <span className="hidden font-heading text-lg font-semibold sm:inline-block">STEAM 探索</span>
              </Link>
              <MainNav />
            </div>
            <div className="flex flex-1 items-center justify-between gap-2 md:justify-end min-h-9">
              <div className={cn(
                "items-center min-w-0 md:flex md:w-auto md:flex-none",
                showMobileSearch ? "flex w-full flex-1" : "hidden w-auto flex-none md:flex"
              )}>
                <Suspense fallback={<div className={cn("h-9", showMobileSearch ? "w-full max-w-sm" : "w-[200px]")} />}>
                  <HeaderSearch />
                </Suspense>
              </div>
              <nav className="flex items-center gap-2 shrink-0">
                <div className="hidden md:block">
                  <ShareButton />
                </div>
                <div className="hidden md:block">
                  <NotificationBell />
                </div>
                <div className={cn("md:hidden", !user && "hidden")}>
                  <NotificationBell />
                </div>
                <div className={cn("hidden md:block", !user && "md:hidden")}>
                  <UserButton />
                </div>
                {!user && (
                  <div className="md:hidden">
                    <UserButton />
                  </div>
                )}
              </nav>
            </div>
          </div>
        </header>
        <main className={cn('flex-1', 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0')}>{pageContent}</main>
        <BottomNav />
      </div>
    </AppProviders>
  )
}
