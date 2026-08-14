'use client'

import Link from 'next/link'
import { AlertCircle, BadgeCheck, Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface InteractionConfirmationDialogProps {
  open: boolean
  loading?: boolean
  error?: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

export function InteractionConfirmationDialog({
  open,
  loading = false,
  error,
  onOpenChange,
  onConfirm,
}: InteractionConfirmationDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !loading) onOpenChange(false)
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md gap-5 rounded-md p-5 sm:p-6">
        <DialogHeader className="text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <DialogTitle>互动前安全确认</DialogTitle>
              <DialogDescription className="leading-6">
                发布作品、评论或私信前，需要完成一次本人确认。公开内容仍可正常浏览。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <p className="text-xs leading-6 text-muted-foreground">
          未成年人请在监护人指导下使用。确认即表示你同意遵守{' '}
          <Link href="/legal/terms" className="text-primary underline-offset-2 hover:underline">
            《服务条款》
          </Link>{' '}和{' '}
          <Link href="/legal/privacy" className="text-primary underline-offset-2 hover:underline">
            《隐私政策》
          </Link>。
        </p>

        {error ? (
          <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-destructive">
            <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            暂不确认
          </Button>
          <Button type="button" className="w-full sm:w-auto" disabled={loading} onClick={() => void onConfirm()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            完成确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
