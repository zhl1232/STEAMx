'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'

import {
  createTutorPcmRecorder,
  getTutorVoicePreferences,
  markTutorLongPressHintShown,
  setTutorVoicePreference,
  shouldShowTutorLongPressHint,
  TUTOR_VOICE_HINT_STATE_STORAGE_KEY,
  TUTOR_VOICE_MAX_RECORDING_MS,
  TUTOR_VOICE_PREFERENCES_CHANGE_EVENT,
  type TutorPcmRecorder,
  type TutorVoicePreferences,
} from '@/components/features/tutor/tutor-voice'
import type { TutorVoiceFeedback } from '@/components/features/tutor/tutor-voice-feedback'
import type { TutorChatMessage } from '@/components/features/tutor/use-tutor-chat-stream'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import type { AiCreditStatus } from '@/lib/ai/tutor/types'

const TUTOR_LONG_PRESS_HINT_VISIBLE_MS = 6500

type TutorVoiceRecordingMode = 'composer' | 'longPress'

async function readTutorSpeechError(res: Response, fallback: string) {
  const payload = await res.json().catch(() => null)
  if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error
  }
  return fallback
}

export type TutorLongPressBridge = {
  /** 是否满足开始长按录音的条件（面板打开与否由拖拽层判断） */
  canBegin: (pointerType: string) => boolean
  /** pointerdown 重新武装计时前，清掉上一次长按残留状态 */
  reset: () => void
  /** 长按计时到点：隐藏提示并开始录音 */
  begin: () => void
  /** 长按途中转为拖拽：提前结束录音 */
  cancelForDrag: () => void
  /** 手指抬起；返回 true 表示这次抬起被长按消费（调用方需拦截 click） */
  release: () => boolean
}

export type UseTutorVoiceOptions = {
  open: boolean
  mounted: boolean
  hideOnMobile: boolean
  contextKey: string
  /** 最新场景 key；转写响应回来时用于丢弃过期场景的结果 */
  contextKeyRef: MutableRefObject<string>
  quota: AiCreditStatus | null
  /** 发送中标记（由流式控制器维护）；录音入口用它做互斥 */
  busyRef: MutableRefObject<boolean>
  /** 面板输入框录音完成：把转写文本交回输入框（须为稳定引用） */
  onComposerTranscript: (transcript: string) => void
  /** 关闭态长按录音完成：直接发送（须为稳定引用） */
  onLongPressTranscript: (transcript: string, options: { forceReadReply: boolean }) => void
}

/**
 * 小迪语音控制器：PCM 录音 + 转写、TTS 朗读、语音偏好、长按说话桥接、
 * 自动朗读队列。UI 无关，供 GlobalTutorFab 编排使用。
 */
export function useTutorVoice({
  open,
  mounted,
  hideOnMobile,
  contextKey,
  contextKeyRef,
  quota,
  busyRef,
  onComposerTranscript,
  onLongPressTranscript,
}: UseTutorVoiceOptions) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()

  const [recordingVoice, setRecordingVoice] = useState(false)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0)
  const [transcribingVoice, setTranscribingVoice] = useState(false)
  const [voicePreferences, setVoicePreferences] = useState<TutorVoicePreferences>(() => getTutorVoicePreferences(null))
  const [coarsePointer, setCoarsePointer] = useState(false)
  const [showVoiceHint, setShowVoiceHint] = useState(false)
  const [speechLoadingKey, setSpeechLoadingKey] = useState<string | null>(null)
  const [playingSpeechKey, setPlayingSpeechKey] = useState<string | null>(null)

  const recorderRef = useRef<TutorPcmRecorder | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceRecordingModeRef = useRef<TutorVoiceRecordingMode>('composer')
  const longPressActiveRef = useRef(false)
  const longPressReleasePendingRef = useRef(false)
  const speechAudioRef = useRef<HTMLAudioElement | null>(null)
  const speechObjectUrlRef = useRef<string | null>(null)
  const speechRequestIdRef = useRef(0)
  const pendingAutoReadTextRef = useRef<string | null>(null)
  const pendingAutoReadForceRef = useRef(false)

  const autoReadReplies = voicePreferences.autoReadReplies

  useEffect(() => {
    const syncPreferences = () => setVoicePreferences(getTutorVoicePreferences())

    syncPreferences()
    window.addEventListener(TUTOR_VOICE_PREFERENCES_CHANGE_EVENT, syncPreferences)
    window.addEventListener('storage', syncPreferences)
    return () => {
      window.removeEventListener(TUTOR_VOICE_PREFERENCES_CHANGE_EVENT, syncPreferences)
      window.removeEventListener('storage', syncPreferences)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const syncPointer = () => setCoarsePointer(media.matches)

    syncPointer()
    media.addEventListener('change', syncPointer)
    return () => media.removeEventListener('change', syncPointer)
  }, [])

  useEffect(() => {
    if (
      !mounted ||
      open ||
      hideOnMobile ||
      !coarsePointer ||
      !voicePreferences.mobileLongPressInput ||
      !voicePreferences.showLongPressHint
    ) {
      setShowVoiceHint(false)
      return
    }

    if (!shouldShowTutorLongPressHint(localStorage.getItem(TUTOR_VOICE_HINT_STATE_STORAGE_KEY))) return

    setShowVoiceHint(true)
    markTutorLongPressHintShown()
    const timeout = setTimeout(() => setShowVoiceHint(false), TUTOR_LONG_PRESS_HINT_VISIBLE_MS)
    return () => clearTimeout(timeout)
  }, [
    coarsePointer,
    hideOnMobile,
    mounted,
    open,
    voicePreferences.mobileLongPressInput,
    voicePreferences.showLongPressHint,
  ])

  useEffect(() => {
    if (!recordingVoice || recordingStartedAt == null) return

    const syncElapsed = () => setRecordingElapsedMs(Date.now() - recordingStartedAt)
    syncElapsed()
    const timer = setInterval(syncElapsed, 250)
    return () => clearInterval(timer)
  }, [recordingStartedAt, recordingVoice])

  const stopSpeechPlayback = useCallback(() => {
    speechRequestIdRef.current += 1
    const audio = speechAudioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    if (speechObjectUrlRef.current) {
      URL.revokeObjectURL(speechObjectUrlRef.current)
    }
    speechAudioRef.current = null
    speechObjectUrlRef.current = null
    setPlayingSpeechKey(null)
    setSpeechLoadingKey(null)
  }, [])

  const playSpeech = useCallback(
    async (text: string, speechKey: string) => {
      if (!text.trim()) return
      if (playingSpeechKey === speechKey) {
        stopSpeechPlayback()
        return
      }

      stopSpeechPlayback()
      const speechRequestId = speechRequestIdRef.current
      setSpeechLoadingKey(speechKey)

      try {
        const res = await fetch('/api/tutor/speech/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })

        if (!res.ok) {
          throw new Error(await readTutorSpeechError(res, '小迪语音暂时不可用，请稍后再试。'))
        }

        const blob = await res.blob()
        if (speechRequestIdRef.current !== speechRequestId) return
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        speechObjectUrlRef.current = url
        speechAudioRef.current = audio
        setPlayingSpeechKey(speechKey)
        setSpeechLoadingKey(null)

        audio.onended = stopSpeechPlayback
        audio.onerror = stopSpeechPlayback
        try {
          await audio.play()
        } catch (error) {
          if (speechRequestIdRef.current !== speechRequestId) return
          throw error
        }
      } catch (error) {
        if (speechRequestIdRef.current !== speechRequestId) return
        stopSpeechPlayback()
        toast({
          title: error instanceof Error ? error.message : '小迪语音暂时不可用，请稍后再试。',
          variant: 'destructive',
        })
      }
    },
    [playingSpeechKey, stopSpeechPlayback, toast],
  )

  const finishVoiceRecording = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || transcribingVoice) return
    recorderRef.current = null
    const recordingMode = voiceRecordingModeRef.current
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setRecordingVoice(false)
    setRecordingStartedAt(null)
    setTranscribingVoice(true)
    const requestKey = contextKeyRef.current

    try {
      const recording = await recorder.stop()
      if (recording.durationMs < 350 || recording.blob.size <= 0) {
        toast({ title: '没有录到声音，请再试一次。', variant: 'destructive' })
        return
      }

      const formData = new FormData()
      formData.append('audio', recording.blob, 'xiaodi-voice.pcm')
      formData.append('durationMs', String(Math.min(recording.durationMs, TUTOR_VOICE_MAX_RECORDING_MS)))
      const res = await fetch('/api/tutor/speech/transcribe', { method: 'POST', body: formData })
      if (!res.ok) {
        throw new Error(await readTutorSpeechError(res, '小迪没有听清楚，请再说一次。'))
      }
      const payload = await res.json().catch(() => null)
      const transcript = typeof payload?.transcript === 'string' ? payload.transcript.trim() : ''
      if (contextKeyRef.current !== requestKey) return
      if (!transcript) {
        toast({ title: '小迪没有听清楚，请再说一次。', variant: 'destructive' })
        return
      }
      if (recordingMode === 'longPress') {
        onLongPressTranscript(transcript, { forceReadReply: voicePreferences.voiceInputAutoPlay })
      } else {
        onComposerTranscript(transcript)
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : '小迪没有听清楚，请再说一次。',
        variant: 'destructive',
      })
    } finally {
      setTranscribingVoice(false)
      voiceRecordingModeRef.current = 'composer'
      longPressActiveRef.current = false
      longPressReleasePendingRef.current = false
    }
  }, [contextKeyRef, onComposerTranscript, onLongPressTranscript, toast, transcribingVoice, voicePreferences.voiceInputAutoPlay])

  const startVoiceRecording = useCallback(async (mode: TutorVoiceRecordingMode = 'composer') => {
    const resetLongPressState = () => {
      if (mode !== 'longPress') return
      longPressActiveRef.current = false
      longPressReleasePendingRef.current = false
      voiceRecordingModeRef.current = 'composer'
    }

    if (recordingVoice || transcribingVoice) {
      resetLongPressState()
      return
    }
    if (!user) {
      resetLongPressState()
      promptLogin(() => undefined, {
        title: '登录后找小迪',
        description: '登录后即可用语音和小迪对话。',
      })
      return
    }
    if (busyRef.current || (quota != null && !quota.canChat)) {
      resetLongPressState()
      return
    }

    try {
      stopSpeechPlayback()
      voiceRecordingModeRef.current = mode
      const recorder = await createTutorPcmRecorder()
      recorderRef.current = recorder
      setRecordingElapsedMs(0)
      setRecordingStartedAt(Date.now())
      setRecordingVoice(true)
      recordingTimerRef.current = setTimeout(() => {
        void finishVoiceRecording()
      }, TUTOR_VOICE_MAX_RECORDING_MS)
      if (mode === 'longPress' && longPressReleasePendingRef.current) {
        longPressReleasePendingRef.current = false
        void finishVoiceRecording()
      }
    } catch (error) {
      voiceRecordingModeRef.current = 'composer'
      setRecordingStartedAt(null)
      setRecordingElapsedMs(0)
      resetLongPressState()
      toast({
        title: error instanceof Error ? error.message : '无法打开麦克风，请检查浏览器权限。',
        variant: 'destructive',
      })
    }
  }, [busyRef, finishVoiceRecording, promptLogin, quota, recordingVoice, stopSpeechPlayback, toast, transcribingVoice, user])

  const toggleVoiceRecording = useCallback(() => {
    if (recordingVoice) {
      void finishVoiceRecording()
    } else {
      void startVoiceRecording('composer')
    }
  }, [finishVoiceRecording, recordingVoice, startVoiceRecording])

  const toggleAutoReadReplies = useCallback((checked: boolean) => {
    setVoicePreferences((current) => ({ ...current, autoReadReplies: checked }))
    setTutorVoicePreference('autoReadReplies', checked)
  }, [])

  // 面板关闭：结束录音相关的一切，但保留正在进行的 TTS 朗读队列清理
  useEffect(() => {
    if (!open) {
      stopSpeechPlayback()
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      void recorderRef.current?.cancel()
      recorderRef.current = null
      setRecordingVoice(false)
      setRecordingStartedAt(null)
      setRecordingElapsedMs(0)
      longPressActiveRef.current = false
      longPressReleasePendingRef.current = false
    }
  }, [open, stopSpeechPlayback])

  // 卸载兜底清理
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current)
      void recorderRef.current?.cancel()
      speechAudioRef.current?.pause()
      if (speechObjectUrlRef.current) URL.revokeObjectURL(speechObjectUrlRef.current)
    }
  }, [])

  // 场景切换：语音状态全部归零，避免旧场景的录音/朗读串进新场景
  useEffect(() => {
    stopSpeechPlayback()
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    void recorderRef.current?.cancel()
    recorderRef.current = null
    setRecordingVoice(false)
    setRecordingStartedAt(null)
    setRecordingElapsedMs(0)
    setTranscribingVoice(false)
    pendingAutoReadTextRef.current = null
    pendingAutoReadForceRef.current = false
    longPressActiveRef.current = false
    longPressReleasePendingRef.current = false
  }, [contextKey, stopSpeechPlayback])

  /** 回复完成后登记待自动朗读的文本 */
  const queueAutoRead = useCallback((text: string, force: boolean) => {
    pendingAutoReadTextRef.current = text
    pendingAutoReadForceRef.current = force
  }, [])

  /** 消息列表稳定后消费自动朗读队列（由编排组件在 effect 中调用） */
  const consumePendingAutoRead = useCallback(
    (messages: TutorChatMessage[]) => {
      const pendingText = pendingAutoReadTextRef.current
      if (!pendingText) return
      if (!autoReadReplies && !pendingAutoReadForceRef.current) {
        pendingAutoReadTextRef.current = null
        pendingAutoReadForceRef.current = false
        return
      }
      const lastIndex = messages.length - 1
      const last = messages[lastIndex]
      if (last?.role !== 'assistant' || last.error || last.streaming || last.content !== pendingText) return
      pendingAutoReadTextRef.current = null
      pendingAutoReadForceRef.current = false
      void playSpeech(last.content, `chat-${lastIndex}`)
    },
    [autoReadReplies, playSpeech],
  )

  const canBeginLongPress = useCallback(
    (pointerType: string) =>
      coarsePointer &&
      voicePreferences.mobileLongPressInput &&
      pointerType !== 'mouse' &&
      !busyRef.current &&
      !recordingVoice &&
      !transcribingVoice &&
      !(quota != null && !quota.canChat),
    [busyRef, coarsePointer, quota, recordingVoice, transcribingVoice, voicePreferences.mobileLongPressInput],
  )

  const resetLongPress = useCallback(() => {
    longPressActiveRef.current = false
    longPressReleasePendingRef.current = false
  }, [])

  const beginLongPress = useCallback(() => {
    longPressActiveRef.current = true
    setShowVoiceHint(false)
    void startVoiceRecording('longPress')
  }, [startVoiceRecording])

  const cancelLongPressForDrag = useCallback(() => {
    if (!longPressActiveRef.current) return
    longPressActiveRef.current = false
    longPressReleasePendingRef.current = false
    if (recorderRef.current) {
      void finishVoiceRecording()
    }
  }, [finishVoiceRecording])

  const releaseLongPress = useCallback(() => {
    if (!longPressActiveRef.current) return false
    longPressActiveRef.current = false
    if (recorderRef.current) {
      void finishVoiceRecording()
    } else {
      // 录音还没准备好（麦克风权限弹窗等）：标记待结束，录音一就绪立即收尾
      longPressReleasePendingRef.current = true
    }
    return true
  }, [finishVoiceRecording])

  const longPress = useMemo<TutorLongPressBridge>(
    () => ({
      canBegin: canBeginLongPress,
      reset: resetLongPress,
      begin: beginLongPress,
      cancelForDrag: cancelLongPressForDrag,
      release: releaseLongPress,
    }),
    [beginLongPress, canBeginLongPress, cancelLongPressForDrag, releaseLongPress, resetLongPress],
  )

  const voiceFeedback: TutorVoiceFeedback | null = recordingVoice
    ? {
        tone: 'recording',
        title: voiceRecordingModeRef.current === 'longPress' ? '正在听，松开后发送' : '小迪正在听',
        detail: voiceRecordingModeRef.current === 'longPress' ? '保持说话' : '点方块结束录音',
        elapsedMs: recordingElapsedMs,
      }
    : transcribingVoice
      ? {
          tone: 'processing',
          title: '正在识别语音',
          detail: voiceRecordingModeRef.current === 'longPress' ? '识别后自动发送' : '把语音转成文字',
        }
      : speechLoadingKey
        ? {
            tone: 'processing',
            title: '正在准备朗读',
            detail: '生成小迪的声音',
            canStopSpeech: true,
          }
        : playingSpeechKey
          ? {
              tone: 'speaking',
              title: '小迪正在说',
              detail: '回复播放中',
              canStopSpeech: true,
            }
          : null

  return {
    voicePreferences,
    autoReadReplies,
    toggleAutoReadReplies,
    coarsePointer,
    showVoiceHint,
    recordingVoice,
    transcribingVoice,
    speechLoadingKey,
    playingSpeechKey,
    voiceFeedback,
    playSpeech,
    stopSpeechPlayback,
    toggleVoiceRecording,
    queueAutoRead,
    consumePendingAutoRead,
    longPress,
  }
}
