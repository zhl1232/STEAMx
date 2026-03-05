"use client"

import { cn } from "@/lib/utils"
import { Crown, GraduationCap, NotebookPen } from "lucide-react"
import { useState } from "react"

type UserRole = 'user' | 'teacher' | 'moderator' | 'admin'

interface RoleBadgeProps {
  role: UserRole
  className?: string
  /** 尺寸：sm=评论区紧凑, md=卡片区默认, lg=个人主页醒目 */
  size?: 'sm' | 'md' | 'lg'
}

const ROLE_CONFIG: Record<Exclude<UserRole, 'user'>, {
  Icon: typeof Crown
  label: string
  bg: string
  border: string
  icon: string
}> = {
  admin: {
    Icon: Crown,
    label: '超级管理员',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  moderator: {
    Icon: NotebookPen,
    label: '学习委员',
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  teacher: {
    Icon: GraduationCap,
    label: '认证导师',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
}

const SIZE_MAP = {
  sm: 'h-5 w-5 [&>svg]:h-3 [&>svg]:w-3',
  md: 'h-6 w-6 [&>svg]:h-3.5 [&>svg]:w-3.5',
  lg: 'h-8 w-8 [&>svg]:h-4 [&>svg]:w-4',
} as const

/**
 * RoleBadge - 角色身份标识组件
 * 以独立的 Icon + Tooltip 形式渲染在昵称/头像旁，
 * 不影响用户的名字颜色商品。
 *
 * user 角色不渲染任何内容。
 */
export function RoleBadge({ role, className, size = 'md' }: RoleBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (role === 'user') return null

  const config = ROLE_CONFIG[role]
  if (!config) return null

  const IconComponent = config.Icon

  return (
    <span
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full border',
          'cursor-default select-none',
          'transition-all duration-200 hover:opacity-90',
          config.bg,
          config.border,
          config.icon,
          SIZE_MAP[size],
          className,
        )}
        aria-label={config.label}
      >
        <IconComponent className="shrink-0" strokeWidth={2.2} />
      </span>

      {/* 轻量 Tooltip */}
      {showTooltip && (
        <span
          className={cn(
            'absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5',
            'px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap',
            'bg-popover text-popover-foreground',
            'border shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150',
          )}
        >
          {config.label}
        </span>
      )}
    </span>
  )
}
