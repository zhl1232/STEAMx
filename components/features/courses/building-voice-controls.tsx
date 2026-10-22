'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Mic, Pause, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { useBuildingVoicePreparation } from './use-building-voice-preparation'
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
  /** 状态变化时通知外层（手机顶栏麦克风图标显示是否正在听） */
  onStatusChange?: (status: string) => void
  onAvailabilityChange?: (ready: boolean) => void
  courseReady?: boolean
}

export function BuildingVoiceControls({ tutorOpen, onCloseTutor, onStatusChange, onAvailabilityChange, courseReady = false, ...navigation }: BuildingVoiceControlsProps) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const preparation = useBuildingVoicePreparation({ ...navigation, userId: user?.id ?? null, courseReady })
  const control = useBuildingVoiceControls({ ...navigation, userId: user?.id ?? null, acquireEngine: preparation.acquire })
  const [pauseReason, setPauseReason] = useState('')
  const { isActive, pause, status } = control

  useEffect(() => { onAvailabilityChange?.(preparation.ready || isActive) }, [onAvailabilityChange, preparation.ready, isActive])

  useEffect(() => {
    onStatusChange?.(status)
  }, [onStatusChange, status])

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

  if (!preparation.ready && !isActive) {
    const busy = ['downloading', 'cached', 'initializing'].includes(preparation.status)
    const detail = !user ? '登录后可使用课程语音，翻页按钮仍可正常使用。' : preparation.problem || (preparation.status === 'error' ? '语音准备失败，请检查网络后重试。' :
      preparation.status === 'deferred' ? '为节省流量，尚未下载语音资源。需要时可主动准备，首次约 50 MB。' :
      preparation.status === 'downloading' ? '正在缓存语音资源。可以关闭此面板继续上课。' :
      preparation.status === 'initializing' || preparation.status === 'cached' ? '资源已读取，正在检查设备内识别引擎。' : '语音将在课程资源就绪后准备，不会自动开启麦克风。')
    return <section aria-label="语音设置" className="p-3" data-building-voice-controls>
      <p role="status" className="text-sm">{detail}</p>
      <Button type="button" size="sm" className="mt-2" disabled={busy || !courseReady || preparation.problem.includes('不支持')} onClick={user ? preparation.prepare : () => promptLogin(() => undefined, { title: '登录后开启语音搭建' })}>
        {!user ? '登录后准备语音' : busy ? '正在准备' : preparation.status === 'error' || preparation.problem ? '重试语音准备' : '准备语音（约 50 MB）'}
      </Button>
    </section>
  }

  const waiting = status === 'starting'
  const canResume = status === 'paused' || status === 'error'
  const feedback = status === 'paused' && pauseReason ? pauseReason : control.feedback

  return (
    <section aria-label="语音搭建" className="sticky top-0 z-50 shrink-0 border-b border-border/60 bg-background/90 px-3 py-1.5 backdrop-blur-md md:px-5" data-building-voice-controls>
      <div className="flex min-h-11 min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {waiting ? <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : <Mic aria-hidden="true" className={`h-4 w-4 shrink-0 ${status === 'listening' ? 'text-emerald-600' : 'text-muted-foreground'}`} />}
          <div className="min-w-0">
            <p className="text-sm font-medium">语音搭建{status === 'listening' ? ' · 正在听' : canResume ? ' · 已暂停' : ''}</p>
            {status === 'idle' ? <p className="text-xs text-muted-foreground">会员权益 · 目前免费体验 · 设备内识别</p> : null}
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
