'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Mic, Pause, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { useBuildingVoiceControls } from './use-building-voice-controls'

export type BuildingVoiceControlsProps = {
  courseId: number
  lessonId: number
  navigationKey: string
  stepIndex: number
  stepCount: number
  tutorOpen: boolean
  onCloseTutor: () => void
  onNavigate: (index: number) => void
}

export function BuildingVoiceControls({ tutorOpen, onCloseTutor, ...navigation }: BuildingVoiceControlsProps) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const control = useBuildingVoiceControls({ ...navigation, userId: user?.id ?? null })
  const [pauseReason, setPauseReason] = useState('')
  const { isActive, pause, status } = control

  useEffect(() => {
    if (tutorOpen && isActive) {
      setPauseReason('已打开小迪答疑，语音搭建已暂停。')
      pause()
    }
  }, [isActive, pause, tutorOpen])

  useEffect(() => {
    const pauseForLessonMedia = (event: Event) => {
      if (event.target instanceof HTMLMediaElement && event.target.closest('[data-building-lesson]') && isActive) {
        setPauseReason('课程媒体正在播放，语音搭建已暂停。')
        pause()
      }
    }
    document.addEventListener('play', pauseForLessonMedia, true)
    return () => document.removeEventListener('play', pauseForLessonMedia, true)
  }, [isActive, pause])

  const start = () => {
    if (!user) {
      promptLogin(() => undefined, {
        title: '登录后开启语音搭建',
        description: '语音翻页不扣答疑代币，也可以继续使用页面按钮搭建。',
      })
      return
    }
    // Starting this mode is an explicit switch away from other lesson audio.
    document.querySelectorAll<HTMLMediaElement>('[data-building-lesson] video, [data-building-lesson] audio').forEach((media) => {
      if (!media.paused) media.pause()
    })
    onCloseTutor()
    setPauseReason('')
    void control.start()
  }

  if (navigation.stepCount <= 0) return null

  const waiting = status === 'starting' || status === 'processing'
  const canResume = status === 'paused' || status === 'error'
  const feedback = status === 'paused' && pauseReason ? pauseReason : control.feedback

  return (
    <section aria-label="语音搭建" className="sticky top-0 z-50 shrink-0 border-b border-border/60 bg-background/90 px-3 py-1.5 backdrop-blur-md md:px-5" data-building-voice-controls>
      <div className="flex min-h-11 min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {waiting ? <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : <Mic aria-hidden="true" className={`h-4 w-4 shrink-0 ${status === 'listening' ? 'text-emerald-600' : 'text-muted-foreground'}`} />}
          <div className="min-w-0">
            <p className="text-sm font-medium">语音搭建{status === 'listening' ? ' · 正在听' : status === 'processing' ? ' · 识别中' : canResume ? ' · 已暂停' : ''}</p>
            {status === 'idle' ? <p className="text-xs text-muted-foreground">会员权益 · 目前免费体验</p> : null}
          </div>
        </div>
        {status === 'idle' || canResume ? (
          <Button type="button" size="sm" className="h-10 shrink-0 gap-1.5 rounded-full px-4" onClick={start}>
            <Play aria-hidden="true" className="h-4 w-4" />{canResume ? '继续' : '开启'}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="ghost" className="h-10 shrink-0 gap-1.5 rounded-full bg-foreground/[0.06] px-4" onClick={() => { setPauseReason(''); pause() }}>
            <Pause aria-hidden="true" className="h-4 w-4" />暂停
          </Button>
        )}
        {status !== 'idle' ? (
          <Button type="button" size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-full" aria-label="退出语音搭建" onClick={() => { setPauseReason(''); control.exit() }}>
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {status !== 'idle' ? (
        <p role="status" aria-live="polite" aria-atomic="true" className="pb-0.5 text-xs leading-relaxed text-muted-foreground">{feedback || '允许麦克风后，说“小迪，下一步”或“小迪，上一步”。'}</p>
      ) : null}
    </section>
  )
}
