"use client"

import Link from "next/link"
import { useEffect, useSyncExternalStore, type ComponentProps } from "react"

import {
  isReturnTrackedPath,
  readReturnHrefRaw,
  rememberReturnHref,
  resolveReturnHref,
} from "@/lib/navigation/return-href"

const subscribeNoop = () => () => {}
const SNAPSHOT_SEPARATOR = "\n"

// Stable string snapshot (pathname + stored map) so useSyncExternalStore does not loop.
function getReturnSnapshot(): string {
  return `${window.location.pathname}${SNAPSHOT_SEPARATOR}${readReturnHrefRaw() ?? ""}`
}

/** Back target for the current page: remembered referrer page, else `fallbackHref`. */
export function useReturnHref(fallbackHref: string): string {
  const snapshot = useSyncExternalStore(subscribeNoop, getReturnSnapshot, () => null)
  if (!snapshot) return fallbackHref
  const separator = snapshot.indexOf(SNAPSHOT_SEPARATOR)
  return resolveReturnHref(snapshot.slice(separator + 1) || null, snapshot.slice(0, separator), fallbackHref)
}

/** `<Link>` whose href is the remembered referrer page (falls back to `fallbackHref`). */
export function ReturnLink({ fallbackHref, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { fallbackHref: string }) {
  const href = useReturnHref(fallbackHref)
  return <Link href={href} {...props} />
}

/**
 * Mounted once in the root layout. Records the current URL when the user clicks
 * an internal link into a tracked section (see RETURN_TRACKED_PREFIXES).
 */
export function ReturnHrefTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin || !isReturnTrackedPath(url.pathname)) return
      rememberReturnHref(url.pathname, `${window.location.pathname}${window.location.search}`)
    }
    // Capture phase so the record lands before client-side navigation starts.
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  return null
}
