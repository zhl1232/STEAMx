"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

function ThemeClassSync() {
  const { theme, resolvedTheme } = useTheme()

  React.useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return

      const root = document.documentElement
      const isBlackGold = theme === "black-gold"
      const activeTheme = theme === "system" ? resolvedTheme : theme

      root.classList.toggle("black-gold", isBlackGold)
      root.classList.toggle("dark", isBlackGold || activeTheme === "dark")
    })

    return () => {
      cancelled = true
    }
  }, [theme, resolvedTheme])

  return null
}

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeClassSync />
      {children}
    </NextThemesProvider>
  )
}
