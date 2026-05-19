import type { ElementType, ReactNode } from "react"

import { cn } from "@/lib/utils"

type ShellVariant = "wide" | "standard" | "reading" | "narrow"

const shellClass: Record<ShellVariant, string> = {
  wide: "app-shell-wide",
  standard: "app-shell-standard",
  reading: "app-shell-reading",
  narrow: "app-shell-narrow",
}

export interface AppShellProps {
  variant?: ShellVariant
  as?: ElementType
  className?: string
  children?: ReactNode
}

/** 宽版内容仪表盘：首页、探索、项目、社区、自然、个人、商店、排行榜 */
export function AppWideShell({ as: Comp = "div", className, children, ...props }: AppShellProps & { as?: ElementType }) {
  return (
    <Comp className={cn(shellClass.wide, className)} {...props}>
      {children}
    </Comp>
  )
}

/** 标准列表与次级页面 */
export function AppStandardShell({ as: Comp = "div", className, children, ...props }: AppShellProps & { as?: ElementType }) {
  return (
    <Comp className={cn(shellClass.standard, className)} {...props}>
      {children}
    </Comp>
  )
}

/** 设置、帮助、法律等阅读型页面 */
export function AppReadingShell({ as: Comp = "div", className, children, ...props }: AppShellProps & { as?: ElementType }) {
  return (
    <Comp className={cn(shellClass.reading, className)} {...props}>
      {children}
    </Comp>
  )
}

export function AppShell({
  variant = "standard",
  as: Comp = "div",
  className,
  children,
  ...props
}: AppShellProps) {
  return (
    <Comp className={cn(shellClass[variant], className)} {...props}>
      {children}
    </Comp>
  )
}
