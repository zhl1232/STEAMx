'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/** 原生折叠：正文始终由服务端输出；兼容旧链接指向折叠内容的锚点。 */
export function GuideDisclosure({ id, title, children }: {
  id?: string
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    let frame = 0
    const revealTarget = () => {
      cancelAnimationFrame(frame)
      let id: string
      try { id = decodeURIComponent(window.location.hash.slice(1)) } catch { return }
      if (!id) return
      const target = document.getElementById(id)
      const details = ref.current
      if (!target || !details || !details.contains(target)) return
      details.open = true
      frame = requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
    }
    revealTarget()
    window.addEventListener('hashchange', revealTarget)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', revealTarget)
    }
  }, [])

  return (
    <details ref={ref} id={id} className="scroll-mt-24 rounded-sm border border-border bg-card">
      <summary className="min-h-11 cursor-pointer rounded-sm px-4 py-3 text-sm font-semibold text-foreground marker:text-[hsl(var(--topic-accent))] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {title}
      </summary>
      <div className="space-y-6 border-t border-border px-4 py-5 text-sm leading-7 text-muted-foreground md:px-6">
        {children}
      </div>
    </details>
  )
}
