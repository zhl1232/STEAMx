'use client'
import { useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
const key = 'recent-experiment-kit'
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener('experiment-kit-change', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('experiment-kit-change', callback)
  }
}
function getSnapshot() { try { return localStorage.getItem(key) } catch { return null } }
export function RecentKit({ slug, name }: { slug?: string; name?: string }) {
  const saved = useSyncExternalStore(subscribe, getSnapshot, () => null)
  useEffect(() => {
    if (!slug || !name) return
    try {
      localStorage.setItem(key, JSON.stringify({ slug, name }))
      window.dispatchEvent(new Event('experiment-kit-change'))
    } catch { /* Browsing also works without storage. */ }
  }, [slug, name])
  let recent: { slug: string; name: string } | null = null
  try {
    const value = JSON.parse(saved ?? 'null')
    if (value && typeof value.slug === 'string' && /^[a-z0-9-]+$/.test(value.slug) && typeof value.name === 'string') recent = value
  } catch { /* Ignore stale browser data. */ }
  if (slug || !recent) return null
  return <p className="my-5 flex items-center gap-4 text-sm"><Link className="underline" href={`/kits/${recent.slug}`}>上次查看：{recent.name}</Link><button onClick={() => {
    try { localStorage.removeItem(key) } catch { /* Storage is optional. */ }
    window.dispatchEvent(new Event('experiment-kit-change'))
  }}>清除</button></p>
}
