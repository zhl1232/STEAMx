'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { claimTutorAudioSession } from '@/components/features/tutor/tutor-audio-session'
import {
  createBuildingVoiceCapture,
  type BuildingVoiceCapture,
  type BuildingVoiceRecording,
} from './building-voice-capture'

export type BuildingVoiceStatus = 'idle' | 'starting' | 'listening' | 'processing' | 'feedback' | 'paused' | 'error'
export type BuildingVoiceControlsOptions = {
  courseId: number
  lessonId: number
  userId: string | null
  /** Changes for every navigation, including A -> B -> A and tool/URL navigation. */
  navigationKey: string
  stepIndex: number
  stepCount: number
  onNavigate: (index: number) => void
}

const LISTENING_FEEDBACK = '先停顿一下，再说“小迪，下一步”或“小迪，上一步”。'
const FEEDBACK_MS = 500
const REQUEST_TIMEOUT_MS = 20_000

function sameScope(left: BuildingVoiceControlsOptions, right: BuildingVoiceControlsOptions) {
  return left.courseId === right.courseId && left.lessonId === right.lessonId && left.userId === right.userId
}

function pageIsVisible() {
  return typeof document !== 'undefined' && document.visibilityState === 'visible'
}

function responseError(status: number) {
  if (status === 401) return '登录已失效，请重新登录后开启语音搭建。'
  if (status === 403) return '当前课程暂时不能使用语音搭建，请检查课程访问权限。'
  if (status === 429) return '语音控制暂时达到使用上限，已暂停；请稍后再试。'
  return '语音识别暂时不可用，已暂停；请稍后点击继续。'
}

function microphoneError(error: unknown) {
  if (error instanceof Error && error.name === 'NotAllowedError') return '麦克风权限未开启，请允许访问后点击继续。'
  if (error instanceof Error && error.name === 'NotFoundError') return '没有找到麦克风，请连接麦克风后点击继续。'
  return error instanceof Error ? error.message : '无法开启麦克风，请检查浏览器权限后点击继续。'
}

/** Explicitly enabled navigation commands; no transcript or automatic chat submission. */
export function useBuildingVoiceControls(options: BuildingVoiceControlsOptions) {
  const [state, setState] = useState<{ status: BuildingVoiceStatus; feedback: string }>({ status: 'idle', feedback: '' })
  const optionsRef = useRef(options)
  const mountedRef = useRef(true)
  const statusRef = useRef<BuildingVoiceStatus>('idle')
  const generationRef = useRef(0)
  const requestIdRef = useRef(0)
  const captureRef = useRef<BuildingVoiceCapture | null>(null)
  const sessionAbortRef = useRef<AbortController | null>(null)
  const requestAbortRef = useRef<AbortController | null>(null)
  const audioReleaseRef = useRef<(() => void) | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const publish = useCallback((status: BuildingVoiceStatus, feedback: string) => {
    statusRef.current = status
    if (mountedRef.current) setState({ status, feedback })
  }, [])

  const abortRequest = useCallback(() => {
    requestIdRef.current += 1
    requestAbortRef.current?.abort()
    requestAbortRef.current = null
    if (requestTimerRef.current) clearTimeout(requestTimerRef.current)
    requestTimerRef.current = null
  }, [])

  const stop = useCallback((status: BuildingVoiceStatus, feedback: string) => {
    // Invalidate first; neither a late permission nor a server response can restart us.
    generationRef.current += 1
    abortRequest()
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = null
    sessionAbortRef.current?.abort()
    sessionAbortRef.current = null
    const capture = captureRef.current
    captureRef.current = null
    void capture?.close()
    audioReleaseRef.current?.()
    audioReleaseRef.current = null
    publish(status, feedback)
  }, [abortRequest, publish])

  const pause = useCallback(() => stop('paused', '已暂停，点击继续开启语音搭建。'), [stop])
  const exit = useCallback(() => stop('idle', ''), [stop])

  const listenAfterFeedback = useCallback((generation: number, feedback: string, playCue = false) => {
    if (generation !== generationRef.current || !captureRef.current || !mountedRef.current) return
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    captureRef.current.setListening(false)
    publish('feedback', feedback)
    if (playCue) captureRef.current.playCue()
    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null
      if (generation !== generationRef.current || !captureRef.current || !mountedRef.current) return
      if (!pageIsVisible()) {
        stop('paused', '页面已离开前台，语音已暂停；回来后点击继续。')
        return
      }
      captureRef.current.setListening(true)
      publish('listening', LISTENING_FEEDBACK)
    }, FEEDBACK_MS)
  }, [publish, stop])

  const receiveSegment = useCallback(async (recording: BuildingVoiceRecording, generation: number) => {
    if (generation !== generationRef.current || statusRef.current !== 'listening' || !captureRef.current) return
    const captured = optionsRef.current
    if (!captured.userId || !pageIsVisible()) return
    // Both the capture layer and this synchronous gate block duplicate segments.
    captureRef.current.setListening(false)
    publish('processing', '正在识别口令')
    const requestId = ++requestIdRef.current
    const controller = new AbortController()
    requestAbortRef.current = controller
    const isCurrent = () =>
      mountedRef.current && generation === generationRef.current && requestId === requestIdRef.current &&
      !controller.signal.aborted && sameScope(captured, optionsRef.current) &&
      captured.navigationKey === optionsRef.current.navigationKey && captured.stepIndex === optionsRef.current.stepIndex && pageIsVisible()

    requestTimerRef.current = setTimeout(() => {
      if (isCurrent()) stop('error', '语音识别等待超时，已暂停；请检查网络后点击继续。')
    }, REQUEST_TIMEOUT_MS)

    try {
      const body = new FormData()
      body.append('audio', recording.blob, 'xiaodi-course-control.pcm')
      body.append('durationMs', String(recording.durationMs))
      body.append('courseId', String(captured.courseId))
      body.append('lessonId', String(captured.lessonId))
      const response = await fetch('/api/tutor/speech/course-control', { method: 'POST', body, signal: controller.signal })
      if (!isCurrent()) return
      if (!response.ok) {
        let message = responseError(response.status)
        if (response.status === 429) {
          const limit: unknown = await response.json().catch(() => null)
          if (limit && typeof limit === 'object' && 'code' in limit && 'error' in limit &&
            (limit.code === 'course_voice_minute_limit' || limit.code === 'course_voice_daily_limit') &&
            typeof limit.error === 'string' && limit.error.trim().length > 0 && limit.error.length <= 200) {
            message = limit.error
          }
        }
        if (isCurrent()) stop('error', message)
        return
      }
      const payload: unknown = await response.json()
      if (!isCurrent()) return
      const command = payload && typeof payload === 'object' && 'command' in payload ? payload.command : undefined
      if (command !== null && command !== 'next' && command !== 'previous' && command !== 'pause' && command !== 'exit') {
        stop('error', '语音识别结果无效，已暂停；请稍后点击继续。')
        return
      }
      if (requestTimerRef.current) clearTimeout(requestTimerRef.current)
      requestTimerRef.current = null
      requestAbortRef.current = null

      if (command === null) {
        // Ordinary teaching speech is neither an error nor an invitation to chat.
        captureRef.current?.setListening(true)
        publish('listening', LISTENING_FEEDBACK)
        return
      }
      if (command === 'pause') {
        pause()
        return
      }
      if (command === 'exit') {
        exit()
        return
      }
      const target = captured.stepIndex + (command === 'next' ? 1 : -1)
      if (target < 0 || target >= captured.stepCount) {
        listenAfterFeedback(generation, target < 0 ? '已经是第一步了。' : '已经是最后一步了。', true)
        return
      }
      listenAfterFeedback(generation, command === 'next' ? '已到下一步。' : '已回到上一步。', true)
      // No await (or feedback/audio callback) after the final navigation check.
      if (isCurrent()) optionsRef.current.onNavigate(target)
    } catch {
      if (!isCurrent()) return
      stop('error', '网络连接中断，语音已暂停；请检查网络后点击继续。')
    }
  }, [exit, listenAfterFeedback, pause, publish, stop])

  const start = useCallback(async () => {
    if (statusRef.current === 'starting' || statusRef.current === 'listening' || statusRef.current === 'processing' || statusRef.current === 'feedback') return
    if (!optionsRef.current.userId) {
      stop('error', '登录后即可开启语音搭建。')
      return
    }
    if (!pageIsVisible()) {
      stop('paused', '页面已离开前台，回来后点击继续。')
      return
    }
    stop('starting', '正在开启麦克风，请允许访问。')
    const generation = generationRef.current
    const captured = optionsRef.current
    const controller = new AbortController()
    sessionAbortRef.current = controller
    audioReleaseRef.current = claimTutorAudioSession('course-control', () => {
      if (generation === generationRef.current) stop('paused', '小迪正在使用语音，搭建语音已暂停；需要时点击继续。')
    })
    const isCurrent = () => mountedRef.current && generation === generationRef.current &&
      !controller.signal.aborted && sameScope(captured, optionsRef.current)
    try {
      const capture = await createBuildingVoiceCapture({
        signal: controller.signal,
        onSegment: (recording) => { void receiveSegment(recording, generation) },
        onError: (error) => { if (isCurrent()) stop('error', error.message) },
      })
      if (!isCurrent() || !pageIsVisible()) {
        await capture.close()
        if (isCurrent()) stop('paused', '页面已离开前台，回来后点击继续。')
        return
      }
      captureRef.current = capture
      capture.setListening(true)
      publish('listening', LISTENING_FEEDBACK)
    } catch (error) {
      if (isCurrent()) stop('error', microphoneError(error))
    }
  }, [publish, receiveSegment, stop])

  useLayoutEffect(() => {
    const previous = optionsRef.current
    optionsRef.current = options
    if (!sameScope(previous, options)) {
      stop('idle', '')
      return
    }
    if (previous.navigationKey !== options.navigationKey || previous.stepIndex !== options.stepIndex || previous.stepCount !== options.stepCount) {
      abortRequest()
      captureRef.current?.reset()
      if (statusRef.current === 'processing') {
        listenAfterFeedback(generationRef.current, '页面已切换，可以重新说口令。')
      }
    }
  }, [options, abortRequest, listenAfterFeedback, stop])

  useEffect(() => {
    const pauseForBackground = () => {
      if (statusRef.current === 'idle' || statusRef.current === 'paused' || statusRef.current === 'error') return
      stop('paused', '页面已离开前台，语音已暂停；回来后点击继续。')
    }
    const onVisibilityChange = () => { if (!pageIsVisible()) pauseForBackground() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', pauseForBackground)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', pauseForBackground)
    }
  }, [stop])

  useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stop('idle', '')
    }
  }, [stop])

  return {
    ...state,
    isActive: state.status === 'starting' || state.status === 'listening' || state.status === 'processing' || state.status === 'feedback',
    start,
    resume: start,
    pause,
    exit,
  }
}
