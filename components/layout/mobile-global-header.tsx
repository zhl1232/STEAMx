'use client'

import type { ReactNode, FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import Link from 'next/link'
import { Search, X } from 'lucide-react'

import { NotificationBell } from '@/components/layout/notification-bell'
import { SteamLogo } from '@/components/layout/logo'
import { UserButton } from '@/components/layout/user-button'
import { cn } from '@/lib/utils'

interface MobileGlobalHeaderProps {
  /** 左侧显示模式：'logo' 显示 Logo+标题，'title' 显示自定义标题文字，'search' 显示内嵌搜索框 */
  variant?: 'logo' | 'title' | 'search'
  /** variant='title' 时的标题文字 */
  title?: ReactNode
  /** 是否显示搜索快捷入口（链接到 /explore），仅 variant='logo' | 'title' 时生效 */
  showSearch?: boolean
  /** 是否显示通知铃铛（组件内部已处理登录态） */
  showNotification?: boolean
  /** 是否显示用户按钮（组件内部已处理登录态） */
  showUserButton?: boolean
  /** 右侧自定义操作区（会附加到默认按钮之后） */
  rightSlot?: ReactNode
  /** 额外的 className */
  className?: string

  /** variant='search' 时的受控搜索值 */
  searchValue?: string
  /** variant='search' 时的占位符 */
  searchPlaceholder?: string
  /** variant='search' 时的输入变化回调（实时） */
  onSearchChange?: (value: string) => void
  /** variant='search' 时的提交回调（按下回车或失焦提交） */
  onSearchSubmit?: (value: string) => void
}

/**
 * 统一的移动端全局 Header 组件。
 *
 * 样式基准来自 conditional-app-shell.tsx 中的全局 header。
 * 仅在移动端显示（md:hidden）。
 *
 * 所有使用自定义移动端 header 的页面（首页、探索、社区、自然、Profile 等）
 * 均应使用本组件，以确保视觉一致性。
 */
export function MobileGlobalHeader({
  variant = 'logo',
  title,
  showSearch = false,
  showNotification = true,
  showUserButton = true,
  rightSlot,
  className,
  searchValue,
  searchPlaceholder = '搜索项目、材料、作者...',
  onSearchChange,
  onSearchSubmit,
}: MobileGlobalHeaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [internalValue, setInternalValue] = useState(searchValue ?? '')

  // 将外部受控值同步到内部 state（保持非受控时的兼容）
  useEffect(() => {
    if (searchValue !== undefined) {
      setInternalValue(searchValue)
    }
  }, [searchValue])

  const currentValue = searchValue !== undefined ? searchValue : internalValue

  const handleChange = (next: string) => {
    if (searchValue === undefined) {
      setInternalValue(next)
    }
    onSearchChange?.(next)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearchSubmit?.(currentValue.trim())
  }

  const handleClear = () => {
    handleChange('')
    // 清空后让焦点留在输入框
    inputRef.current?.focus()
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-[#dfe8f2] bg-white/92 shadow-[0_10px_36px_-28px_rgba(27,70,126,0.25)] backdrop-blur-xl pt-[env(safe-area-inset-top)] supports-[backdrop-filter]:bg-white/82 dark:border-[#243348] dark:bg-[#070b12]/94 dark:shadow-none dark:supports-[backdrop-filter]:bg-[#070b12]/84 md:hidden',
        className,
      )}
    >
      <div className="flex h-[3.75rem] items-center px-4 min-[390px]:px-5">
        {/* 左侧 */}
        <div className={cn('shrink-0 flex h-10 items-center', variant === 'search' ? 'mr-2' : 'mr-2')}>
          {variant === 'logo' ? (
            <Link href="/" className="flex items-center space-x-2">
              <SteamLogo className="h-7 w-7 shrink-0 min-[390px]:h-8 min-[390px]:w-8" />
              <span className="font-sans text-[18px] font-bold text-[#143f7d] dark:text-[#8bbdff] min-[390px]:text-[20px]">
                STEAM 探索
              </span>
            </Link>
          ) : variant === 'search' ? (
            <Link href="/" aria-label="首页" className="flex items-center">
              <SteamLogo className="h-8 w-8 shrink-0" />
            </Link>
          ) : (
            <h1 className="text-[22px] font-semibold leading-none text-foreground min-[390px]:text-[24px]">
              {title}
            </h1>
          )}
        </div>

        {/* 中间：搜索框（仅 variant='search'） */}
        {variant === 'search' ? (
          <form
            role="search"
            onSubmit={handleSubmit}
            className="min-w-0 flex-1"
          >
            <label className="relative block">
              <span className="sr-only">搜索</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                value={currentValue}
                onChange={(event) => handleChange(event.target.value)}
                placeholder={searchPlaceholder}
                enterKeyHint="search"
                className="h-10 w-full rounded-[14px] border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.9)] pl-9 pr-9 text-[14px] font-medium text-foreground placeholder:text-muted-foreground/70 focus:border-[hsl(var(--brand-blue))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-blue)/0.18)]"
              />
              {currentValue ? (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="清空搜索"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-[hsl(var(--surface-muted))] hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>
          </form>
        ) : null}

        {/* 右侧操作区 */}
        <nav
          className={cn(
            'flex shrink-0 items-center justify-end gap-1.5 min-[390px]:gap-2',
            variant === 'search' ? 'ml-2' : 'flex-1',
          )}
        >
          {variant !== 'search' && showSearch ? (
            <Link
              href="/explore"
              className="grid h-10 w-10 place-items-center rounded-full text-[#26364c] transition hover:bg-[#eef5ff] dark:text-[#d9e4f2] dark:hover:bg-[#172234]"
              aria-label="搜索项目"
            >
              <Search className="h-6 w-6" strokeWidth={2.1} />
            </Link>
          ) : null}
          {showNotification ? <NotificationBell /> : null}
          {showUserButton ? <UserButton /> : null}
          {rightSlot}
        </nav>
      </div>
    </header>
  )
}
