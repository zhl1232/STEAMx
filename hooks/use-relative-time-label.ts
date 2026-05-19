"use client"

import { useEffect, useState } from "react"

import { formatRelativeTime } from "@/lib/project/format-relative-time"

/** Relative label after mount; stable `fallback` during SSR and first paint to avoid hydration mismatch. */
export function useRelativeTimeLabel(
  iso: string | null | undefined,
  fallback = "",
) {
  const [label, setLabel] = useState(fallback)

  useEffect(() => {
    const update = () => setLabel(formatRelativeTime(iso) || fallback)
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [iso, fallback])

  return label
}
