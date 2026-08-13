'use client'

import { useCallback, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import { Loader2, Mic, Plus, Send, Sparkles, Square, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { VoiceFeedbackBar, type TutorVoiceFeedback } from '@/components/features/tutor/tutor-voice-feedback'
import { AI_CREDIT_COST_VISION } from '@/lib/membership'
import { cn } from '@/lib/utils'

/** 单条消息最多携带的图片数（与服务端引擎一致） */
export const MAX_CHAT_IMAGES = 4

const COMPOSER_MIN_HEIGHT_PX = 56
const COMPOSER_MAX_HEIGHT_PX = 128
const composerToolButtonClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent text-foreground/80 transition-[background-color,border-color,box-shadow,transform] hover:border-[hsl(var(--brand-blue)/0.2)] hover:bg-[hsl(var(--status-info-surface)/0.68)] hover:text-[hsl(var(--brand-blue))] active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.28)] disabled:cursor-not-allowed disabled:opacity-45'
const composerSendButtonClass =
  'h-10 w-10 shrink-0 rounded-full bg-[hsl(var(--brand-blue))] text-[hsl(var(--brand-blue-foreground))] shadow-[0_14px_26px_-14px_hsl(var(--brand-blue)/0.95)] transition-[background-color,box-shadow,transform] hover:bg-[hsl(var(--brand-blue)/0.92)] hover:shadow-[0_16px_30px_-14px_hsl(var(--brand-blue)/0.85)] active:scale-95 disabled:bg-[hsl(var(--surface-muted))] disabled:text-muted-foreground disabled:shadow-none disabled:opacity-70'

export type TutorComposerProps = {
  input: string
  onInputChange: (value: string) => void
  onSubmit: () => void
  busy: boolean
  uploadingImage: boolean
  recordingVoice: boolean
  transcribingVoice: boolean
  quotaExhausted: boolean
  pendingImages: string[]
  suggestedImages: string[]
  onAddSuggestedImage: (url: string) => void
  onRemovePendingImage: (url: string) => void
  /** 选中的图片文件（已过滤非图片），由编排层负责上传 */
  onPickFiles: (files: File[]) => void
  onToggleVoiceRecording: () => void
  voiceFeedback: TutorVoiceFeedback | null
  onStopSpeech: () => void
  showReviewAction: boolean
  onReview?: () => void
}

/** 小迪面板输入区：文本、图片、语音入口与发送 */
export function TutorComposer({
  input,
  onInputChange,
  onSubmit,
  busy,
  uploadingImage,
  recordingVoice,
  transcribingVoice,
  quotaExhausted,
  pendingImages,
  suggestedImages,
  onAddSuggestedImage,
  onRemovePendingImage,
  onPickFiles,
  onToggleVoiceRecording,
  voiceFeedback,
  onStopSpeech,
  showReviewAction,
  onReview,
}: TutorComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null)

  const resizeComposer = useCallback(() => {
    const el = composerTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, COMPOSER_MIN_HEIGHT_PX), COMPOSER_MAX_HEIGHT_PX)}px`
  }, [])

  useEffect(() => {
    resizeComposer()
  }, [input, resizeComposer])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      onSubmit()
    }
  }

  const handleFilePick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    event.target.value = ''
    if (files.length === 0) return
    onPickFiles(files)
  }

  return (
    <div className="space-y-2 border-t border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.82)] px-3.5 py-3 shadow-[inset_0_1px_0_hsl(var(--brand-blue-foreground)/0.5)]">
      {pendingImages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {pendingImages.map((image) => (
            <span key={image} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xs bg-muted">
              <OptimizedImage src={image} alt="待发图片" fill variant="thumbnail" className="object-cover" />
              <button
                type="button"
                onClick={() => onRemovePendingImage(image)}
                aria-label="移除图片"
                className="absolute right-0 top-0 inline-flex h-4 w-4 items-center justify-center rounded-bl-xs bg-black/55 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground">带图提问消耗 {AI_CREDIT_COST_VISION} 代币</span>
        </div>
      )}
      {suggestedImages.some((image) => !pendingImages.includes(image)) && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-[10px] text-muted-foreground">发我的照片：</span>
          {suggestedImages
            .filter((image) => !pendingImages.includes(image))
            .map((image) => (
              <button
                key={image}
                type="button"
                onClick={() => onAddSuggestedImage(image)}
                disabled={busy}
                aria-label="把这张照片发给小迪"
                className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xs bg-muted ring-1 ring-[hsl(var(--brand-blue)/0.2)] transition-transform hover:scale-105 disabled:opacity-50"
              >
                <OptimizedImage src={image} alt="场景照片" fill variant="thumbnail" className="object-cover" />
              </button>
            ))}
        </div>
      )}
      {voiceFeedback ? <VoiceFeedbackBar feedback={voiceFeedback} onStopSpeech={onStopSpeech} /> : null}
      <div className="rounded-md border border-[hsl(var(--brand-blue)/0.2)] bg-[hsl(var(--background)/0.86)] px-2.5 pb-2 pt-2.5 shadow-[0_18px_38px_-30px_hsl(var(--brand-blue)/0.8),inset_0_1px_0_hsl(var(--brand-blue-foreground)/0.52)] transition-[border-color,box-shadow] focus-within:border-[hsl(var(--brand-blue)/0.48)] focus-within:shadow-[0_0_0_3px_hsl(var(--brand-blue)/0.11),0_20px_42px_-32px_hsl(var(--brand-blue)/0.86)]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={handleFilePick}
        />
        <textarea
          ref={composerTextareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={recordingVoice ? '小迪正在听…' : transcribingVoice ? '小迪正在整理语音…' : '问小迪一个问题…'}
          className="min-h-9 max-h-[128px] w-full resize-none border-0 bg-transparent px-1.5 py-1 text-sm leading-5 text-foreground outline-hidden placeholder:text-muted-foreground/55 focus-visible:outline-hidden disabled:bg-transparent disabled:opacity-50"
          disabled={busy || recordingVoice || transcribingVoice || quotaExhausted}
        />
        <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || uploadingImage || pendingImages.length >= MAX_CHAT_IMAGES || quotaExhausted}
            aria-label="发图片给小迪"
            title="发图片给小迪"
            className={composerToolButtonClass}
          >
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" strokeWidth={2} />}
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onToggleVoiceRecording}
              disabled={transcribingVoice || (!recordingVoice && (busy || uploadingImage || quotaExhausted))}
              aria-label={recordingVoice ? '停止语音输入' : '语音输入'}
              title={recordingVoice ? '停止语音输入' : '语音输入'}
              className={cn(
                composerToolButtonClass,
                recordingVoice && 'border-[hsl(var(--status-danger)/0.35)] bg-[hsl(var(--status-danger-surface)/0.72)] text-[hsl(var(--status-danger))] shadow-[0_10px_20px_-16px_hsl(var(--status-danger)/0.9)]',
              )}
            >
              {transcribingVoice ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : recordingVoice ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            <Button
              type="button"
              size="icon"
              shape="pill"
              onClick={onSubmit}
              disabled={busy || uploadingImage || recordingVoice || transcribingVoice || (!input.trim() && pendingImages.length === 0) || quotaExhausted}
              aria-label="发送"
              title="发送"
              className={composerSendButtonClass}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {showReviewAction && onReview ? (
        <button
          type="button"
          onClick={onReview}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--brand-blue))] hover:underline"
        >
          <Sparkles className="h-3.5 w-3.5" />
          让导师看看我现在这步的产出
        </button>
      ) : null}
    </div>
  )
}
