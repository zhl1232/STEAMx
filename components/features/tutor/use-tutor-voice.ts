'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'

import {
  createTutorPcmPlayer,
  decodeBase64ToArrayBuffer,
  type TutorPcmPlayer,
} from '@/components/features/tutor/tutor-pcm-player'
import { readTutorStreamEvents } from '@/components/features/tutor/tutor-stream-protocol'
import { claimTutorAudioSession, getTutorAudioSessionGeneration } from '@/components/features/tutor/tutor-audio-session'
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
import { TutorAudioCache, pcmWav } from './tutor-audio-cache'
import { DEFAULT_TUTOR_VOICE } from '@/lib/ai/tutor/voice-catalog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import type { AiCreditStatus } from '@/lib/ai/tutor/types'

const TUTOR_LONG_PRESS_HINT_VISIBLE_MS = 6500

type TutorVoiceRecordingMode = 'composer' | 'longPress'

function releaseAudioLease(ref: MutableRefObject<(() => void) | null>, lease = ref.current) {
  if (ref.current === lease) ref.current = null
  lease?.()
}

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
 * 小迪语音控制器：PCM 录音 + 转写、流式 TTS 朗读、语音偏好、长按说话桥接。
 * UI 无关，供 GlobalTutorFab 编排使用。
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
  const { user, profile } = useAuth()
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
  const recordingGenerationRef = useRef(0)
  const recordingStartingRef = useRef(false)
  const transcriptionAbortRef = useRef<AbortController | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceRecordingModeRef = useRef<TutorVoiceRecordingMode>('composer')
  const longPressActiveRef = useRef(false)
  const longPressReleasePendingRef = useRef(false)
  const speechAudioRef = useRef<HTMLAudioElement | null>(null)
  const speechObjectUrlRef = useRef<string | null>(null)
  const speechRequestIdRef = useRef(0)
  const speechFetchAbortRef = useRef<AbortController | null>(null)
  const pcmPlayerRef = useRef<TutorPcmPlayer | null>(null)
  const streamedSpeechActiveRef = useRef(false)
  const streamedGotAudioRef = useRef(false)
  const streamedSpeechKeyRef = useRef<string | null>(null)
  const recordingAudioReleaseRef = useRef<(() => void) | null>(null)
  const speechAudioReleaseRef = useRef<(() => void) | null>(null)
  const standaloneSpeechRequestRef = useRef<number | null>(null)
  const speechSessionGenerationRef = useRef<number | null>(null)

  const audioCacheRef = useRef(new TutorAudioCache())
  const audioBufferRef = useRef<{ chunks: ArrayBuffer[]; size: number; voice: string; sampleRate: number; complete: boolean }>({ chunks: [], size: 0, voice: DEFAULT_TUTOR_VOICE, sampleRate: 24000, complete: false })
  const nativeRequiredRef = useRef(false)
  const playNativeRef = useRef<((blob: Blob, key: string, requestId: number) => Promise<void>) | null>(null)
  const userIdRef = useRef(user?.id)
  useEffect(() => { userIdRef.current = user?.id }, [user?.id])
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

  const cancelVoiceRecording = useCallback(() => {
    recordingGenerationRef.current += 1
    recordingStartingRef.current = false
    transcriptionAbortRef.current?.abort()
    transcriptionAbortRef.current = null
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current)
    recordingTimerRef.current = null
    const recorder = recorderRef.current
    recorderRef.current = null
    void recorder?.cancel()
    voiceRecordingModeRef.current = 'composer'
    longPressActiveRef.current = false
    longPressReleasePendingRef.current = false
    setRecordingVoice(false)
    setRecordingStartedAt(null)
    setRecordingElapsedMs(0)
    setTranscribingVoice(false)
    releaseAudioLease(recordingAudioReleaseRef)
  }, [])

  const getPcmPlayer = () => {
    if (!pcmPlayerRef.current) {
      const requestId = speechRequestIdRef.current
      const player = createTutorPcmPlayer({
        onEnded: () => {
          if (requestId !== speechRequestIdRef.current || pcmPlayerRef.current !== player) return
          streamedSpeechActiveRef.current = false
          setPlayingSpeechKey(null)
          setSpeechLoadingKey(null)
          // An empty PCM stream may still be awaiting native-audio fallback.
          if (streamedGotAudioRef.current) releaseAudioLease(speechAudioReleaseRef)
        },
      })
      pcmPlayerRef.current = player
    }
    return pcmPlayerRef.current
  }

  const stopSpeechPlayback = useCallback(() => {
    audioBufferRef.current = { chunks: [], size: 0, voice: DEFAULT_TUTOR_VOICE, sampleRate: 24000, complete: false }
    nativeRequiredRef.current = false
    speechRequestIdRef.current += 1
    speechFetchAbortRef.current?.abort()
    speechFetchAbortRef.current = null
    streamedSpeechActiveRef.current = false
    streamedGotAudioRef.current = false
    streamedSpeechKeyRef.current = null
    speechSessionGenerationRef.current = null
    standaloneSpeechRequestRef.current = null
    pcmPlayerRef.current?.stop()
    pcmPlayerRef.current = null
    const audio = speechAudioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
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
    releaseAudioLease(speechAudioReleaseRef)
  }, [])

  const cancelAllVoice = useCallback(() => {
    cancelVoiceRecording()
    stopSpeechPlayback()
  }, [cancelVoiceRecording, stopSpeechPlayback])

  const pushStreamedPcm = useCallback((pcm: string, sampleRate?: number, speechKey?: string, voice?: string) => {
    if (!pcm) return null
    if (speechSessionGenerationRef.current !== getTutorAudioSessionGeneration()) return null
    if (!streamedSpeechActiveRef.current) {
      // 播放被用户主动停止时忽略余下的流，不要在回复结束后又自动重播。
      return streamedSpeechKeyRef.current ? false : null
    }
    if (speechKey && streamedSpeechKeyRef.current !== speechKey) return null

    const buffer = audioBufferRef.current
    const decoded = decodeBase64ToArrayBuffer(pcm)
    if (decoded.byteLength % 2 || (sampleRate && sampleRate !== 24000)) return false
    buffer.size += decoded.byteLength
    if (buffer.size > 8 * 1024 * 1024) { stopSpeechPlayback(); return false }
    buffer.chunks.push(decoded)
    buffer.voice = voice ?? buffer.voice
    buffer.sampleRate = sampleRate ?? 24000
    try {
      if (!nativeRequiredRef.current) getPcmPlayer().enqueue(decoded, sampleRate)
    } catch {
      // Reuse these exact PCM bytes as a WAV; never request a second synthesis.
      nativeRequiredRef.current = true
      pcmPlayerRef.current?.stop()
    }

    if (!streamedGotAudioRef.current) {
      streamedGotAudioRef.current = true
      setSpeechLoadingKey(null)
      setPlayingSpeechKey(streamedSpeechKeyRef.current)
    }
    return true
  }, [stopSpeechPlayback])

  const beginStreamedSpeech = useCallback(
    async (speechKey: string) => {
      cancelVoiceRecording()
      stopSpeechPlayback()
      speechAudioReleaseRef.current = claimTutorAudioSession('tutor', cancelAllVoice)
      speechSessionGenerationRef.current = getTutorAudioSessionGeneration()
      const speechRequestId = speechRequestIdRef.current
      streamedSpeechActiveRef.current = true
      streamedGotAudioRef.current = false
      streamedSpeechKeyRef.current = speechKey
      setSpeechLoadingKey(speechKey)
      try {
        await getPcmPlayer().resume()
        if (speechRequestIdRef.current !== speechRequestId) return
      } catch {
        if (speechRequestIdRef.current !== speechRequestId) return
        nativeRequiredRef.current = true
      }
    },
    [cancelAllVoice, cancelVoiceRecording, stopSpeechPlayback],
  )

  const finishStreamedSpeech = useCallback((speechKey?: string, complete = false, text = '') => {
    if (!streamedSpeechKeyRef.current) return null
    if (speechSessionGenerationRef.current !== getTutorAudioSessionGeneration()) return null
    if (speechKey && streamedSpeechKeyRef.current !== speechKey) return null
    if (!speechAudioReleaseRef.current) return streamedGotAudioRef.current
    if (speechKey) {
      streamedSpeechKeyRef.current = speechKey
      if (streamedGotAudioRef.current) setPlayingSpeechKey(speechKey)
    }
    const buffered = audioBufferRef.current
    // Native playback starts only after a complete stream. A truncated/empty
    // stream has no player that can fire onEnded, so release it here instead.
    // Later chat-finalization calls must not stop an already completed WAV.
    if (nativeRequiredRef.current && !buffered.complete && (!complete || !buffered.size)) {
      stopSpeechPlayback()
      return false
    }
    const activeSpeechKey = streamedSpeechKeyRef.current
    if (complete && !buffered.complete && buffered.size) {
      buffered.complete = true
      const blob = pcmWav(buffered.chunks, buffered.sampleRate)
      audioCacheRef.current.put(JSON.stringify([userIdRef.current, buffered.voice, activeSpeechKey, text]), blob)
      if (nativeRequiredRef.current) {
        void playNativeRef.current?.(blob, activeSpeechKey, speechRequestIdRef.current).catch(() => stopSpeechPlayback())
      }
    }
    if (!nativeRequiredRef.current) getPcmPlayer().markStreamComplete()
    if (!streamedGotAudioRef.current) {
      streamedSpeechActiveRef.current = false
      setSpeechLoadingKey(null)
      if (standaloneSpeechRequestRef.current !== speechRequestIdRef.current) {
        releaseAudioLease(speechAudioReleaseRef)
      }
    }
    return streamedGotAudioRef.current
  }, [stopSpeechPlayback])

  const playMpegBlob = useCallback(
    async (blob: Blob, speechKey: string, speechRequestId: number) => {
      if (speechRequestIdRef.current !== speechRequestId) return
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      speechObjectUrlRef.current = url
      speechAudioRef.current = audio
      setPlayingSpeechKey(speechKey)
      setSpeechLoadingKey(null)
      const finishNativeSpeech = () => {
        if (speechRequestIdRef.current === speechRequestId) stopSpeechPlayback()
      }
      audio.onended = finishNativeSpeech
      audio.onerror = finishNativeSpeech
      try {
        await audio.play()
      } catch (error) {
        if (speechRequestIdRef.current !== speechRequestId) return
        throw error
      }
    },
    [stopSpeechPlayback],
  )

  useEffect(() => { playNativeRef.current = playMpegBlob }, [playMpegBlob])

  const playSpeech = useCallback(
    async (text: string, speechKey: string, previewVoice?: string) => {
      if (!text.trim()) return
      if (playingSpeechKey === speechKey || speechLoadingKey === speechKey) { stopSpeechPlayback(); return }
      const activation = beginStreamedSpeech(speechKey)
      const requestId = speechRequestIdRef.current
      await activation
      if (speechRequestIdRef.current !== requestId) return
      standaloneSpeechRequestRef.current = requestId
      const controller = new AbortController()
      speechFetchAbortRef.current = controller
      try {
        // Revalidate membership before replay: expired members cannot reuse a premium voice cache.
        const accessResponse = await fetch('/api/tutor/speech/voices', { signal: controller.signal, cache: 'no-store' })
        if (!accessResponse.ok) throw new Error('暂时无法确认朗读设置，请重试。')
        const access = await accessResponse.json()
        if (speechRequestIdRef.current !== requestId) return
        if (previewVoice && !access.canChoose) throw new Error('会员可以试听并选择声音。')
        const voice = previewVoice ?? access.voice
        const cacheKey = JSON.stringify([userIdRef.current, voice, speechKey, text])
        const cached = audioCacheRef.current.get(cacheKey)
        if (cached) { await playMpegBlob(cached, speechKey, requestId); return }
        const response = await fetch('/api/tutor/speech/synthesize', {
          method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, ...(previewVoice ? { voice: previewVoice } : {}) }),
        })
        if (speechRequestIdRef.current !== requestId) return
        if (!response.ok) throw new Error(await readTutorSpeechError(response, '朗读暂时不可用，请稍后重试。'))
        if (response.headers.get('Content-Type')?.includes('text/event-stream') && response.body) {
          let complete = false
          for await (const event of readTutorStreamEvents(response.body)) {
            if (speechRequestIdRef.current !== requestId) return
            if (event.type === 'audio' && event.pcm) {
              const accepted = pushStreamedPcm(event.pcm, event.sampleRate, speechKey, event.voice ?? voice)
              if (accepted !== true) return
            } else if (event.type === 'error') {
              throw new Error(event.error || '朗读中断，请稍后重试。')
            } else if (event.type === 'audio_done') { complete = true; break }
          }
          if (speechRequestIdRef.current !== requestId) return
          if (!complete || !audioBufferRef.current.size) throw new Error('朗读中断，请稍后重试。')
          finishStreamedSpeech(speechKey, true, text)
        } else {
          const blob = await response.blob()
          if (speechRequestIdRef.current !== requestId) return
          audioCacheRef.current.put(cacheKey, blob)
          await playMpegBlob(blob, speechKey, requestId)
        }
      } catch (error) {
        if (speechRequestIdRef.current !== requestId || controller.signal.aborted) return
        stopSpeechPlayback()
        toast({ title: error instanceof Error ? error.message : '朗读暂时不可用，请稍后重试。', variant: 'destructive' })
      }
    }, [beginStreamedSpeech, finishStreamedSpeech, playMpegBlob, playingSpeechKey, speechLoadingKey, pushStreamedPcm, stopSpeechPlayback, toast],
  )

  useEffect(() => {
    const clear = () => { audioCacheRef.current.clear(); cancelAllVoice() }
    clear()
    window.addEventListener('tutor-voice-selection-changed', clear)
    const expires = profile?.membership_expires_at ? Date.parse(profile.membership_expires_at) : NaN
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleExpiry = () => {
      const remaining = expires - Date.now()
      if (!Number.isFinite(remaining)) return
      if (remaining <= 0) { clear(); return }
      timer = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647))
    }
    scheduleExpiry()
    return () => { window.removeEventListener('tutor-voice-selection-changed', clear); if (timer) clearTimeout(timer); clear() }
  }, [user?.id, profile?.membership_expires_at, quota?.isMember, contextKey, cancelAllVoice])

  const finishVoiceRecording = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || transcriptionAbortRef.current) return
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
    const generation = recordingGenerationRef.current
    const audioRelease = recordingAudioReleaseRef.current
    const controller = new AbortController()
    transcriptionAbortRef.current = controller
    const isCurrent = () => !controller.signal.aborted && generation === recordingGenerationRef.current && contextKeyRef.current === requestKey

    try {
      const recording = await recorder.stop()
      if (!isCurrent()) return
      if (recording.durationMs < 350 || recording.blob.size <= 0) {
        toast({ title: '没有录到声音，请再试一次。', variant: 'destructive' })
        return
      }

      const formData = new FormData()
      formData.append('audio', recording.blob, 'xiaodi-voice.pcm')
      formData.append('durationMs', String(Math.min(recording.durationMs, TUTOR_VOICE_MAX_RECORDING_MS)))
      const res = await fetch('/api/tutor/speech/transcribe', { method: 'POST', body: formData, signal: controller.signal })
      if (!res.ok) {
        throw new Error(await readTutorSpeechError(res, '小迪没有听清楚，请再说一次。'))
      }
      const payload = await res.json().catch(() => null)
      const transcript = typeof payload?.transcript === 'string' ? payload.transcript.trim() : ''
      if (!isCurrent()) return
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
      if (!isCurrent()) return
      toast({
        title: error instanceof Error ? error.message : '小迪没有听清楚，请再说一次。',
        variant: 'destructive',
      })
    } finally {
      releaseAudioLease(recordingAudioReleaseRef, audioRelease)
      if (isCurrent()) {
        transcriptionAbortRef.current = null
        setTranscribingVoice(false)
        voiceRecordingModeRef.current = 'composer'
        longPressActiveRef.current = false
        longPressReleasePendingRef.current = false
      }
    }
  }, [contextKeyRef, onComposerTranscript, onLongPressTranscript, toast, voicePreferences.voiceInputAutoPlay])

  const startVoiceRecording = useCallback(async (mode: TutorVoiceRecordingMode = 'composer') => {
    const resetLongPressState = () => {
      if (mode !== 'longPress') return
      longPressActiveRef.current = false
      longPressReleasePendingRef.current = false
      voiceRecordingModeRef.current = 'composer'
    }

    if (recordingVoice || transcribingVoice || recordingStartingRef.current) {
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

    const generation = ++recordingGenerationRef.current
    const requestKey = contextKeyRef.current
    let audioRelease: (() => void) | null = null
    recordingStartingRef.current = true
    try {
      stopSpeechPlayback()
      releaseAudioLease(recordingAudioReleaseRef)
      audioRelease = claimTutorAudioSession('tutor', cancelAllVoice)
      recordingAudioReleaseRef.current = audioRelease
      voiceRecordingModeRef.current = mode
      const recorder = await createTutorPcmRecorder()
      if (generation !== recordingGenerationRef.current || requestKey !== contextKeyRef.current) {
        await recorder.cancel()
        releaseAudioLease(recordingAudioReleaseRef, audioRelease)
        return
      }
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
      if (generation !== recordingGenerationRef.current || requestKey !== contextKeyRef.current) return
      releaseAudioLease(recordingAudioReleaseRef, audioRelease)
      voiceRecordingModeRef.current = 'composer'
      setRecordingStartedAt(null)
      setRecordingElapsedMs(0)
      resetLongPressState()
      toast({
        title: error instanceof Error ? error.message : '无法打开麦克风，请检查浏览器权限。',
        variant: 'destructive',
      })
    } finally {
      if (generation === recordingGenerationRef.current) recordingStartingRef.current = false
    }
  }, [busyRef, cancelAllVoice, contextKeyRef, finishVoiceRecording, promptLogin, quota, recordingVoice, stopSpeechPlayback, toast, transcribingVoice, user])

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

  // 面板关闭、场景/身份变化与卸载走同一条中断路径。
  useEffect(() => {
    if (!open) cancelAllVoice()
  }, [cancelAllVoice, open])

  // 卸载兜底清理
  useEffect(() => {
    return cancelAllVoice
  }, [cancelAllVoice])

  // 场景切换：语音状态全部归零，避免旧场景的录音/朗读串进新场景
  useEffect(() => {
    cancelAllVoice()
  }, [cancelAllVoice, contextKey, user?.id])

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
    // Invalidate a pending microphone/ASR before releasing any recorder. Dragging
    // cancels this gesture; only an ordinary pointer release may send its speech.
    cancelVoiceRecording()
  }, [cancelVoiceRecording])

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
    beginStreamedSpeech,
    pushStreamedPcm,
    finishStreamedSpeech,
    stopSpeechPlayback,
    toggleVoiceRecording,
    longPress,
  }
}
