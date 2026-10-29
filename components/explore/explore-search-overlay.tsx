'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const RECENT_KEY = 'explore-recent-searches'
const RECENT_LIMIT = 8
// 均为站内已有结果的真实关键词（2026-10 核对）。
export const EXPLORE_HOT_SEARCH_TERMS = ['磁铁', '机器人', '化学', '电路', '彩虹', '太阳能'] as const

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, RECENT_LIMIT) : []
  } catch {
    return []
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {}
}

export function rememberExploreSearch(term: string) {
  const value = term.trim()
  if (!value) return
  writeRecent([value, ...readRecent().filter((v) => v !== value)].slice(0, RECENT_LIMIT))
}

interface ExploreSearchOverlayProps {
  open: boolean
  initialValue: string
  onClose: () => void
  onSubmit: (value: string) => void
}

const termClass =
  'inline-flex min-h-11 items-center rounded-full border border-[#d5dbe3] px-3.5 text-[14px] font-medium text-foreground active:bg-[hsl(var(--surface-muted))] dark:border-white/25'

export function ExploreSearchOverlay({ open, initialValue, onClose, onSubmit }: ExploreSearchOverlayProps) {
  const [value, setValue] = useState(initialValue)
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const composingRef = useRef(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const submit = (term: string) => {
    const q = term.trim()
    if (q) rememberExploreSearch(q)
    onSubmit(q)
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (composingRef.current) return
    submit(value)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent
        hideCloseButton
        aria-describedby={undefined}
        data-testid="explore-search-overlay"
        className="inset-0 left-0 top-0 z-[80] flex h-dvh max-h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-[hsl(var(--app-canvas))] p-0 shadow-none data-[state=open]:animate-none data-[state=closed]:animate-none sm:rounded-none"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          setValue(initialValue)
          setRecent(readRecent())
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          inputRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus()
        }}
      >
        <DialogTitle className="sr-only">搜索项目</DialogTitle>
        <div className="flex items-center gap-2 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
          <form role="search" onSubmit={handleSubmit} className="min-w-0 flex-1">
            <label className="relative block">
              <span className="sr-only">搜索项目</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onCompositionStart={() => { composingRef.current = true }}
                onCompositionEnd={() => { composingRef.current = false }}
                placeholder="搜索项目"
                enterKeyHint="search"
                className="h-11 w-full rounded-full border border-[hsl(var(--brand-blue)/0.56)] bg-[hsl(var(--surface-raised))] pl-9 pr-12 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--brand-blue)/0.15)] [&::-webkit-search-cancel-button]:hidden"
              />
              {value ? (
                <button
                  type="button"
                  aria-label="清空输入"
                  onClick={() => { setValue(''); inputRef.current?.focus() }}
                  className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>
          </form>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 shrink-0 px-1 text-[15px] font-semibold text-[hsl(var(--brand-blue))]">
            取消
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {recent.length > 0 ? (
            <section className="pt-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-foreground">最近搜索</h2>
                <button
                  type="button"
                  onClick={() => { writeRecent([]); setRecent([]) }}
                  className="min-h-11 min-w-11 text-[14px] font-medium text-muted-foreground"
                >
                  清除
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((term) => (
                  <button key={term} type="button" onClick={() => submit(term)} className={termClass}>{term}</button>
                ))}
              </div>
            </section>
          ) : null}
          <section className="pt-6">
            <h2 className="mb-3 text-[15px] font-semibold text-foreground">大家都在搜</h2>
            <div className="flex flex-wrap gap-2">
              {EXPLORE_HOT_SEARCH_TERMS.map((term) => (
                <button key={term} type="button" onClick={() => submit(term)} className={termClass}>{term}</button>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
