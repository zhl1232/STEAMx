"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Keyboard, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type Shortcut = {
  key: string
  label: string
}

interface KeyboardHelpProps {
  shortcuts: Shortcut[]
  className?: string
}

export function KeyboardHelp({ shortcuts, className }: KeyboardHelpProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?") {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className={cn("absolute bottom-3 right-3", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="键盘快捷键"
      >
        <Keyboard className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-12 right-0 z-50 min-w-[180px] rounded-xs border bg-popover p-3 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">快捷键</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="space-y-2">
              {shortcuts.map(({ key: k, label }) => (
                <li key={k} className="flex items-center justify-between gap-2 text-sm">
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {k}
                  </kbd>
                  <span className="text-muted-foreground">{label}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
