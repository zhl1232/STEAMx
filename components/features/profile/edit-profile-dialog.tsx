'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ProfileEditor, type ProfileEditorHandle, type ProfileEditorTarget } from './profile-editor'

export type { ProfileEditorTarget } from './profile-editor'

interface EditProfileDialogProps {
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialTarget?: ProfileEditorTarget
  onCloseAutoFocus?: (event: Event) => void
}

export function EditProfileDialog({
  children, open: controlledOpen, onOpenChange, initialTarget = 'overview', onCloseAutoFocus,
}: EditProfileDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null)
  const editorRef = useRef<ProfileEditorHandle>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = controlledOpen ?? internalOpen
  const setOpen = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }
  const close = () => setOpen(false)
  const requestClose = () => {
    if (editorRef.current) editorRef.current.requestLeave(close)
    else close()
  }

  useEffect(() => {
    if (!open || !window.visualViewport) return
    const visualViewport = window.visualViewport
    const update = () => setViewport({ height: visualViewport.height, top: visualViewport.offsetTop })
    update()
    visualViewport.addEventListener('resize', update)
    visualViewport.addEventListener('scroll', update)
    return () => {
      visualViewport.removeEventListener('resize', update)
      visualViewport.removeEventListener('scroll', update)
    }
  }, [open])

  const viewportStyle = {
    // Full-screen geometry must follow keyboard/rotation changes without modal zoom.
    animation: 'none',
    ...(viewport ? {
      '--profile-editor-height': `${viewport.height}px`,
      '--profile-editor-top': `${viewport.top}px`,
    } : {}),
  } as CSSProperties

  return (
    <Dialog open={open} onOpenChange={next => { if (next) setOpen(true); else requestClose() }}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent
        hideCloseButton
        style={viewportStyle}
        className="left-0 top-[var(--profile-editor-top,0px)] flex h-[var(--profile-editor-height,100dvh)] max-h-[var(--profile-editor-height,100dvh)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 transition-none sm:rounded-none md:left-1/2 md:top-1/2 md:h-auto md:max-h-[85dvh] md:w-[calc(100%-3rem)] md:max-w-[880px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border"
        onOpenAutoFocus={event => { event.preventDefault(); closeRef.current?.focus() }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="relative shrink-0 border-b border-border/70 px-16 py-4 pt-[calc(1rem+env(safe-area-inset-top))] text-left md:px-6 md:py-5">
          <DialogTitle className="text-left text-lg font-semibold">编辑资料</DialogTitle>
          <DialogDescription className="text-left text-xs">让大家更好地认识你</DialogDescription>
          <button
            ref={closeRef}
            type="button"
            aria-label="关闭编辑资料"
            onClick={requestClose}
            className="absolute left-2 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:left-auto md:right-3 md:top-3"
          >
            <ChevronLeft className="h-5 w-5 md:hidden" />
            <X className="hidden h-5 w-5 md:block" />
          </button>
        </DialogHeader>
        <ProfileEditor ref={editorRef} mode="dialog" initialTarget={initialTarget} onSaved={close} onCancel={close} />
      </DialogContent>
    </Dialog>
  )
}
