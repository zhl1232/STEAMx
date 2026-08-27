'use client'

import { useEffect } from 'react'

/**
 * Registers the root-scoped service worker in production only.
 * Dev registration is skipped to avoid stale Turbopack / HMR caches.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        console.warn('[pwa] service worker registration failed', error)
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null
}
