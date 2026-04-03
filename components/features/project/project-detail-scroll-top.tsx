"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export function ProjectDetailScrollTop() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hash) return
    if (window.scrollY <= 0) return

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [pathname])

  return null
}
