'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { SteamLogo } from '@/components/logo'
import { MainNav } from '@/components/main-nav'
import { UserButton } from '@/components/user-button'
import { NotificationBell } from '@/components/notification-bell'
import { HeaderSearch } from '@/components/header-search'
import { ShareButton } from '@/components/share-button'
import { BottomNav } from '@/components/bottom-nav'
import { cn } from '@/lib/utils'

/** 在登录/注册等沉浸式页面隐藏顶部搜索、登录按钮与底部 Tab，仅保留返回入口 */
export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!isAuthPage && (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
            <div className="md:hidden flex h-9 items-center shrink-0 mr-2">
              <Link href="/" className="flex items-center space-x-2">
                <SteamLogo className="h-6 w-6 shrink-0" />
                <span className="font-bold hidden sm:inline-block">STEAM</span>
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
      )}
      <main className={cn('flex-1', isAuthPage ? 'pb-0' : 'pb-20 md:pb-0')}>
        {children}
      </main>
      {!isAuthPage && <BottomNav />}
    </div>
  )
}
