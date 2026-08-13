'use client'

import { Loader2, VolumeX } from 'lucide-react'

import { cn } from '@/lib/utils'

const VOICE_WAVE_BARS = [8, 14, 10, 16, 9]

export type TutorVoiceFeedback = {
  tone: 'recording' | 'processing' | 'speaking'
  title: string
  detail: string
  elapsedMs?: number
  canStopSpeech?: boolean
}

export function formatVoiceElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function VoiceFeedbackBar({
  feedback,
  compact = false,
  onStopSpeech,
}: {
  feedback: TutorVoiceFeedback
  compact?: boolean
  onStopSpeech?: () => void
}) {
  const isRecording = feedback.tone === 'recording'
  const isProcessing = feedback.tone === 'processing'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-sm border px-3 py-2 text-xs shadow-[0_14px_30px_-24px_hsl(var(--brand-blue)/0.68)]',
        isRecording
          ? 'border-[hsl(var(--status-danger)/0.2)] bg-[hsl(var(--status-danger-surface)/0.62)] text-[hsl(var(--status-danger))]'
          : 'border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--status-info-surface)/0.58)] text-[hsl(var(--brand-blue))]',
        compact && 'shadow-[0_16px_34px_-18px_hsl(var(--surface-shadow)/0.55)]',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isRecording
            ? 'bg-[hsl(var(--status-danger)/0.12)]'
            : 'bg-[hsl(var(--brand-blue)/0.12)]',
        )}
        aria-hidden
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <VoiceWave tone={isRecording ? 'recording' : 'speaking'} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold leading-4 text-foreground/88">
          {feedback.title}
        </span>
        <span className="block truncate text-[10px] leading-4 text-muted-foreground">
          {feedback.detail}
        </span>
      </span>
      {feedback.elapsedMs != null ? (
        <span className="shrink-0 rounded-full bg-[hsl(var(--surface-raised)/0.86)] px-2 py-0.5 font-mono text-[10px] text-foreground/72">
          {formatVoiceElapsed(feedback.elapsedMs)}
        </span>
      ) : null}
      {feedback.canStopSpeech && onStopSpeech ? (
        <button
          type="button"
          onClick={onStopSpeech}
          aria-label="停止朗读"
          title="停止朗读"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-raised)/0.9)] text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--surface-raised))] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.28)]"
        >
          <VolumeX className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

function VoiceWave({ tone }: { tone: 'recording' | 'speaking' }) {
  return (
    <span className="flex h-4 items-center gap-0.5" aria-hidden>
      {VOICE_WAVE_BARS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={cn(
            'w-0.5 rounded-full opacity-80 motion-safe:animate-pulse',
            tone === 'recording'
              ? 'bg-[hsl(var(--status-danger))]'
              : 'bg-[hsl(var(--brand-blue))]',
          )}
          style={{
            height,
            animationDelay: `${index * 110}ms`,
            animationDuration: '900ms',
          }}
        />
      ))}
    </span>
  )
}
