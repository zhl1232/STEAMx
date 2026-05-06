'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'

import { BottomNav } from '@/components/layout/bottom-nav'
import { HeaderSearch } from '@/components/layout/header-search'
import { MainNav } from '@/components/layout/main-nav'
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
  const isExplorePage = pathname === '/explore'
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
  const showMobileSearch = isExplorePage
  const showMobileSearchShortcut = isHomePage
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
        <header className={cn(
          "sticky top-0 z-50 w-full border-b border-[#dfe8f2] bg-white/92 shadow-[0_10px_36px_-28px_rgba(27,70,126,0.25)] backdrop-blur-xl transition-colors duration-300 pt-[env(safe-area-inset-top)] supports-[backdrop-filter]:bg-white/82 dark:border-[#243348] dark:bg-[#070b12]/94 dark:shadow-none dark:supports-[backdrop-filter]:bg-[#070b12]/84",
          hideGlobalHeader && "hidden",
          !showMobileGlobalHeader && "hidden md:block",
          isProfilePage
            ? "md:border-white/10 md:bg-background/66"
            : ""
        )}>
          <div className="mx-auto flex h-[3.75rem] max-w-[1840px] items-center px-4 min-[390px]:px-5 md:h-16 md:px-8">
            <div className="mr-2 flex h-10 shrink-0 items-center md:hidden">
              <Link href="/" className="flex items-center space-x-2">
                <SteamLogo className="h-7 w-7 shrink-0 min-[390px]:h-8 min-[390px]:w-8" />
                {!showMobileSearch && (
                  <span className={cn(
                    "font-sans font-bold text-[#143f7d] dark:text-[#8bbdff] md:font-heading",
                    isHomePage || isExplorePage ? "inline-block text-[18px] min-[390px]:text-[20px]" : "hidden text-base sm:inline-block"
                  )}>STEAM 探索</span>
                )}
              </Link>
            </div>
            <div className="mr-3 hidden md:flex items-center xl:mr-4">
              <Link className="mr-6 flex items-center space-x-2" href="/">
                <SteamLogo className="h-6 w-6 md:h-8 md:w-8" />
                <span className="hidden whitespace-nowrap font-heading text-[20px] font-extrabold text-[#143f7d] dark:text-[#8bbdff] lg:inline-block xl:text-[24px]">STEAM 探索</span>
              </Link>
              <MainNav />
            </div>
            <div className="flex min-h-9 flex-1 items-center justify-between gap-2 md:justify-end">
              <div className={cn(
                "items-center min-w-0 md:flex md:w-auto md:flex-none",
                showMobileSearch ? "flex w-full flex-1" : "hidden w-auto flex-none md:flex"
              )}>
                <Suspense fallback={<div className={cn("h-9", showMobileSearch ? "w-full max-w-sm" : "w-[200px]")} />}>
                  <HeaderSearch />
                </Suspense>
              </div>
              <nav className="flex shrink-0 items-center gap-1.5 min-[390px]:gap-2">
                {showMobileSearchShortcut ? (
                  <Link
                    href={isExplorePage ? "#explore-search" : "/explore"}
                    className="grid h-10 w-10 place-items-center rounded-full text-[#26364c] transition hover:bg-[#eef5ff] dark:text-[#d9e4f2] dark:hover:bg-[#172234] md:hidden"
                    aria-label="搜索项目"
                  >
                    <Search className="h-6 w-6" strokeWidth={2.1} />
                  </Link>
                ) : null}
                <div className="hidden md:block">
                  <ThemeToggle />
                </div>
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
        <main className={cn('flex-1', hideMobileBottomNav ? 'pb-0' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]', 'md:pb-0')}>{pageContent}</main>
        {!hideMobileBottomNav ? <BottomNav /> : null}
      </div>
    </AppProviders>
  )
}
