'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronUp } from 'lucide-react'
import { XiaoDi } from './xiaodi'
import type { useTutorSheet } from './use-tutor-sheet'
import styles from './tutor-panel.module.css'

/** The summary is plain text, never rendered Markdown/HTML. */
export function tutorSheetSummary(messages: readonly { role: string; content: string }[]) {
  const answer = messages.findLast((message) => message.role === 'assistant')?.content
  if (!answer) return '问小迪一个问题'
  const text = answer
    .replace(/\[(?:audio|lesson|challenge|resource|species|game|project|course):[^|\]\n]+\|([^\]\n]*)\]/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+\.\s+)/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? `小迪：${text.slice(0, 160)}` : '问小迪一个问题'
}

export function TutorMobileSheet({ sheet, summary, children }: {
  sheet: ReturnType<typeof useTutorSheet>
  summary: string
  children: ReactNode
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (sheet.collapsed && bodyRef.current?.contains(document.activeElement)) {
      summaryRef.current?.focus({ preventScroll: true })
    }
  }, [sheet.collapsed])

  return (
    <>
      {sheet.collapsed && (
        <button ref={summaryRef} type="button" className={styles.summary} aria-label="展开小迪对话" aria-expanded={false} onClick={sheet.expand}>
          <span className={styles.avatar} aria-hidden><XiaoDi state="idle" size={40} /></span>
          <span className={styles.summaryText}>{summary}</span>
          <ChevronUp size={18} aria-hidden />
        </button>
      )}
      <div ref={bodyRef} className={styles.body} aria-hidden={sheet.collapsed || undefined} inert={sheet.collapsed || undefined}>
        {sheet.isMobile && (
          <button type="button" className={styles.grip} {...sheet.handleProps}>
            <span aria-hidden />
          </button>
        )}
        {children}
      </div>
    </>
  )
}
