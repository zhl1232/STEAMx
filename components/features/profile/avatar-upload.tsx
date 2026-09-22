'use client'

import { useId, useRef, useState } from 'react'
import { Camera, Check, Upload } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { useToast } from '@/hooks/use-toast'
import { DEFAULT_AVATAR_FILES } from '@/lib/profile/avatar-options'
import { RAW_INPUT_CEILING_MB } from '@/lib/utils/image-compression'
import { cn } from '@/lib/utils'

interface AvatarUploadProps {
  value: string
  persistedUploadUrl?: string
  pendingUploadUrl?: string
  onFileSelect: (file: File) => void
  onDefaultSelect?: (url: string) => void
  disabled?: boolean
  priority?: boolean
  showCameraBadge?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export function AvatarUpload({
  value, persistedUploadUrl, pendingUploadUrl, onFileSelect, onDefaultSelect,
  disabled, priority = false, showCameraBadge, expanded: controlledExpanded, onExpandedChange,
}: AvatarUploadProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = controlledExpanded ?? internalExpanded
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerId = useId()
  const { toast } = useToast()
  const options = [
    ...(pendingUploadUrl ? [{ url: pendingUploadUrl, label: '新选的头像' }] : []),
    ...(persistedUploadUrl ? [{ url: persistedUploadUrl, label: '已上传的头像' }] : []),
    ...DEFAULT_AVATAR_FILES.map((file, index) => ({ url: `/avatars/${file}`, label: `默认头像 ${index + 1}` })),
  ]

  const selectFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: '请选择 JPG、PNG、GIF 或 WebP 图片', variant: 'destructive' })
      return
    }
    if (file.size > RAW_INPUT_CEILING_MB * 1024 * 1024) {
      toast({ title: `原图不能超过 ${RAW_INPUT_CEILING_MB}MB`, variant: 'destructive' })
      return
    }
    onFileSelect(file)
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setInternalExpanded(!expanded); onExpandedChange?.(!expanded) }}
        aria-expanded={expanded}
        aria-controls={pickerId}
        aria-label="更换头像"
        data-profile-field="avatar_url"
        className="group relative rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <span className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-border/70 bg-muted md:h-28 md:w-28">
          {value ? <OptimizedImage src={value} alt="当前头像" fill variant="avatar" priority={priority} className="object-cover" /> : <Camera className="h-8 w-8 text-muted-foreground" />}
        </span>
        {showCameraBadge ? (
          <span aria-hidden="true" className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
            <Camera className="h-4 w-4" />
          </span>
        ) : null}
      </button>
      <span className="text-xs text-muted-foreground">点击头像更换</span>
      {expanded ? (
        <div id={pickerId} role="group" aria-label="头像选择器" className="w-full max-w-sm space-y-4">
          <div className="grid grid-cols-4 justify-items-center gap-3 md:grid-cols-3">
            {options.map(option => (
              <button
                key={option.url}
                type="button"
                disabled={disabled}
                aria-label={option.label}
                aria-pressed={value === option.url}
                onClick={() => onDefaultSelect?.(option.url)}
                className={cn(
                  'relative h-12 w-12 rounded-full border-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 md:h-14 md:w-14',
                  value === option.url ? 'border-primary ring-2 ring-primary/25 ring-offset-2 ring-offset-background' : 'border-transparent hover:border-muted-foreground/40',
                )}
              >
                {/* Presets are local SVGs; pending files use a local object URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={option.url} alt="" className="h-full w-full rounded-full object-cover" />
                {value === option.url ? (
                  <span aria-hidden="true" className="absolute -bottom-1 -right-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="h-3 w-3" /></span>
                ) : null}
              </button>
            ))}
          </div>
          <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
            <Upload className="h-4 w-4" />上传照片
          </button>
          <p className="text-center text-xs leading-5 text-muted-foreground">JPG、PNG、GIF、WebP<br />原图最大 {RAW_INPUT_CEILING_MB}MB，自动压缩后上传</p>
        </div>
      ) : null}
      <input ref={inputRef} type="file" aria-label="上传头像文件" accept={ACCEPTED_TYPES.join(',')} className="hidden" disabled={disabled}
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) selectFile(file)
        }} />
    </div>
  )
}
