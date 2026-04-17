"use client"

import { useLayoutEffect } from "react"
import { usePathname } from "next/navigation"

export function ProjectDetailScrollTop() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hash) return
    if (window.scrollY <= 0) return

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    })
  }, [pathname])

  return null
}
