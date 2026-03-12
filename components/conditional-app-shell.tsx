'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { BottomNav } from '@/components/bottom-nav'
import { HeaderSearch } from '@/components/header-search'
import { MainNav } from '@/components/main-nav'
import { NotificationBell } from '@/components/notification-bell'
import { ShareButton } from '@/components/share-button'
import { SteamLogo } from '@/components/logo'
import { UserButton } from '@/components/user-button'
import { ProjectProvider } from '@/context/project-context'
import { GamificationProvider } from '@/context/gamification-context'
import { LoginPromptProvider } from '@/context/login-prompt-context'
import { NotificationProvider } from '@/context/notification-context'
import { isPlaywrightSmokeClient } from '@/lib/testing/playwright-smoke'
import { cn } from '@/lib/utils'

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LoginPromptProvider>
      <GamificationProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </GamificationProvider>
    </LoginPromptProvider>
  )
}

export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const smokeMode = isPlaywrightSmokeClient()
  const isAuthPage = pathname === '/login'
  const isProfilePage = pathname === '/profile'
  const needsProjectProvider =
    pathname === '/' ||
    pathname.startsWith('/explore') ||
    pathname.startsWith('/project') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/users')

  const pageContent = needsProjectProvider ? <ProjectProvider>{children}</ProjectProvider> : children

  if (isAuthPage) {
    return <main className="flex-1 pb-0">{children}</main>
  }

  if (smokeMode) {
    return (
      <AppProviders>
        <div className="flex min-h-screen flex-col bg-background">
          <main className={cn('flex-1', 'pb-20 md:pb-0')}>{pageContent}</main>
        </div>
      </AppProviders>
    )
  }

  return (
    <AppProviders>
      <div className="flex min-h-screen flex-col bg-background">
        <header className={cn(
          "sticky top-0 z-50 w-full backdrop-blur transition-colors duration-300",
          isProfilePage
            ? "border-b border-white/10 bg-background/30 backdrop-blur-xl md:border-border/40 md:bg-background/95 md:supports-[backdrop-filter]:bg-background/60"
            : "border-b border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60"
        )}>
          <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
            <div className="md:hidden flex h-9 items-center shrink-0 mr-2">
              <Link href="/" className="flex items-center space-x-2">
                <SteamLogo className="h-6 w-6 shrink-0" />
                <span className="font-bold hidden sm:inline-block">STEAM 探索</span>
              </Link>
            </div>
            <div className="mr-4 hidden md:flex items-center">
              <Link className="mr-6 flex items-center space-x-2" href="/">
                <SteamLogo className="h-6 w-6 md:h-8 md:w-8" />
                <span className="hidden font-bold sm:inline-block text-lg">STEAM 探索</span>
              </Link>
              <MainNav />
            </div>
            <div className="flex flex-1 items-center justify-between gap-2 md:justify-end min-h-9">
              <div className="flex items-center w-full flex-1 min-w-0 md:w-auto md:flex-none">
                <Suspense fallback={<div className="w-[200px] h-9" />}>
                  <HeaderSearch />
                </Suspense>
              </div>
              <nav className="flex items-center gap-2 shrink-0">
                <div className="hidden md:block">
                  <ShareButton />
                </div>
                <NotificationBell />
                <UserButton />
              </nav>
            </div>
          </div>
        </header>
        <main className={cn('flex-1', 'pb-20 md:pb-0')}>{pageContent}</main>
        <BottomNav />
      </div>
    </AppProviders>
  )
}
