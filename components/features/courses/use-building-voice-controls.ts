'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { claimTutorAudioSession } from '@/components/features/tutor/tutor-audio-session'
import type { BuildingVoiceCommand } from '@/lib/courses/building-voice-commands'
import { createBuildingVoiceCapture, type BuildingVoiceCapture } from './building-voice-capture'

export type BuildingVoiceStatus = 'idle' | 'starting' | 'listening' | 'feedback' | 'paused' | 'error'
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
const LISTENING_FEEDBACK = '设备内识别，不上传声音。先停顿，再说“小迪，下一步／上一步／暂停／退出”；暂停后需点击继续。'
const COOLDOWN_MS = 1_200

function sameScope(left: BuildingVoiceControlsOptions, right: BuildingVoiceControlsOptions) {
  return left.courseId === right.courseId && left.lessonId === right.lessonId && left.userId === right.userId
}
function microphoneError(error: unknown) {
  if (error instanceof Error && error.name === 'NotAllowedError') return '麦克风权限未开启，请允许访问后点击继续。'
  if (error instanceof Error && error.name === 'NotFoundError') return '没有找到麦克风，请连接麦克风后点击继续。'
  return error instanceof Error ? error.message : '无法开启设备内语音，请使用翻页按钮或点击继续重试。'
}

export function useBuildingVoiceControls(options: BuildingVoiceControlsOptions) {
  const [state, setState] = useState<{ status: BuildingVoiceStatus; feedback: string }>({ status: 'idle', feedback: '' })
  const optionsRef = useRef(options)
  const mountedRef = useRef(true)
  const statusRef = useRef<BuildingVoiceStatus>('idle')
  const generationRef = useRef(0)
  const captureRef = useRef<BuildingVoiceCapture | null>(null)
  const sessionAbortRef = useRef<AbortController | null>(null)
  const audioReleaseRef = useRef<(() => void) | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renewalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaseUntilRef = useRef(0)
  const cooldownUntilRef = useRef(0)

  const publish = useCallback((status: BuildingVoiceStatus, feedback: string) => {
    statusRef.current = status
    if (mountedRef.current) setState({ status, feedback })
  }, [])
  const stop = useCallback((status: BuildingVoiceStatus, feedback: string) => {
    generationRef.current += 1
    leaseUntilRef.current = 0
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    if (renewalTimerRef.current) clearTimeout(renewalTimerRef.current)
    feedbackTimerRef.current = null
    renewalTimerRef.current = null
    sessionAbortRef.current?.abort()
    sessionAbortRef.current = null
    const capture = captureRef.current
    captureRef.current = null
    void capture?.close()
    audioReleaseRef.current?.()
    audioReleaseRef.current = null
    publish(status, feedback)
  }, [publish])
  const pause = useCallback(() => stop('paused', '已暂停并关闭麦克风，点击继续开启语音搭建。'), [stop])
  const exit = useCallback(() => stop('idle', ''), [stop])

  const receiveCommand = useCallback((command: BuildingVoiceCommand, generation: number) => {
    if (!mountedRef.current || generation !== generationRef.current || statusRef.current !== 'listening' || !captureRef.current) return
    if (Date.now() >= leaseUntilRef.current) { stop('paused', '课程访问校验已过期，请联网后点击继续。'); return }
    if (Date.now() < cooldownUntilRef.current) return
    const captured = optionsRef.current
    if (!captured.userId) return
    if (command === 'pause') { pause(); return }
    if (command === 'exit') { exit(); return }
    if (command !== 'next' && command !== 'previous') return
    cooldownUntilRef.current = Date.now() + COOLDOWN_MS
    captureRef.current.setListening(false)
    const target = captured.stepIndex + (command === 'next' ? 1 : -1)
    publish('feedback', target < 0 ? '已经是第一步了。' : target >= captured.stepCount ? '已经是最后一步了。' :
      command === 'next' ? '已到下一步。' : '已回到上一步。')
    captureRef.current.playCue()
    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null
      if (generation !== generationRef.current || !captureRef.current || !mountedRef.current) return
      captureRef.current.checkHealth()
      if (generation !== generationRef.current) return
      captureRef.current.setListening(true)
      publish('listening', LISTENING_FEEDBACK)
    }, COOLDOWN_MS)
    // Existing parent navigation callback also checks its navigation epoch synchronously.
    if (target >= 0 && target < captured.stepCount && captured === optionsRef.current && generation === generationRef.current) captured.onNavigate(target)
  }, [exit, pause, publish, stop])

  const start = useCallback(async () => {
    if (['starting', 'listening', 'feedback'].includes(statusRef.current)) return
    if (!optionsRef.current.userId) { stop('error', '登录后即可开启语音搭建。'); return }
    stop('starting', '正在准备设备内语音，首次约需下载 50 MB；请允许麦克风访问。')
    const generation = generationRef.current
    const captured = optionsRef.current
    const controller = new AbortController()
    sessionAbortRef.current = controller
    audioReleaseRef.current = claimTutorAudioSession('course-control', () => {
      if (generation === generationRef.current) stop('paused', '小迪正在使用语音，搭建语音已暂停；需要时点击继续。')
    })
    const isCurrent = () => mountedRef.current && generation === generationRef.current &&
      !controller.signal.aborted && sameScope(captured, optionsRef.current)
    const authorize = async () => {
      const requestedAt = Date.now()
      const timeout = new AbortController()
      const timer = setTimeout(() => timeout.abort(), 10_000)
      try {
        const signal = AbortSignal.any([controller.signal, timeout.signal])
        const response = await fetch(`/api/tutor/speech/course-control?courseId=${captured.courseId}&lessonId=${captured.lessonId}`, { signal, cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 401 ? '登录已失效，请重新登录后开启。' : '暂时无法确认课程访问权限，请联网后点击继续。')
        const payload: unknown = await response.json()
        if (!payload || typeof payload !== 'object' || !('userId' in payload) || payload.userId !== captured.userId ||
          !('validForMs' in payload) || payload.validForMs !== 300_000) throw new Error('课程访问校验无效，请重新开启。')
        if (!isCurrent()) return
        leaseUntilRef.current = requestedAt + payload.validForMs
        renewalTimerRef.current = setTimeout(() => {
          renewalTimerRef.current = null
          if (isCurrent()) void authorize().catch(() => { if (isCurrent()) stop('error', '课程访问校验中断，已暂停；请联网后点击继续。') })
        }, 240_000)
      } finally { clearTimeout(timer) }
    }
    const authorized = authorize()
    void authorized.catch(() => undefined)
    try {
      // Called before awaiting auth so AudioContext.resume retains the user gesture.
      const capture = await createBuildingVoiceCapture({ signal: controller.signal, authorized,
        onCommand: (command) => receiveCommand(command, generation),
        onError: (error) => { if (isCurrent()) stop('error', error.message) },
      })
      if (!isCurrent()) { await capture.close(); return }
      captureRef.current = capture
      cooldownUntilRef.current = 0
      capture.setListening(true)
      publish('listening', LISTENING_FEEDBACK)
    } catch (error) { if (isCurrent()) stop('error', microphoneError(error)) }
  }, [publish, receiveCommand, stop])

  useLayoutEffect(() => {
    const previous = optionsRef.current
    optionsRef.current = options
    if (!sameScope(previous, options)) { stop('idle', ''); return }
    if (previous.navigationKey !== options.navigationKey || previous.stepIndex !== options.stepIndex || previous.stepCount !== options.stepCount) captureRef.current?.reset()
  }, [options, stop])

  useEffect(() => {
    const interrupt = () => {
      if (['starting', 'listening', 'feedback'].includes(statusRef.current)) stop('paused', '页面已离开或被冻结，语音已暂停；返回后点击继续。')
    }
    const check = () => {
      captureRef.current?.checkHealth()
      if (captureRef.current && Date.now() >= leaseUntilRef.current) stop('paused', '课程访问校验已过期，请联网后点击继续。')
    }
    // Visibility alone does not tell us whether mirroring/capture still works.
    document.addEventListener('visibilitychange', check)
    document.addEventListener('freeze', interrupt)
    window.addEventListener('pagehide', interrupt)
    return () => {
      document.removeEventListener('visibilitychange', check)
      document.removeEventListener('freeze', interrupt)
      window.removeEventListener('pagehide', interrupt)
    }
  }, [stop])
  useLayoutEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; stop('idle', '') }
  }, [stop])
  return { ...state, isActive: ['starting', 'listening', 'feedback'].includes(state.status), start, resume: start, pause, exit }
}
