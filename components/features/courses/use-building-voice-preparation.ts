'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { allowAutomaticVoiceDownload, buildingVoicePreparation, scheduleVoiceIdle, supportsBuildingVoicePreparation } from './building-voice-preparation'

type Options = { courseId: number; lessonId: number; userId: string | null; courseReady: boolean }
export function useBuildingVoicePreparation({ courseId, lessonId, userId, courseReady }: Options) {
  const snapshot = useSyncExternalStore(buildingVoicePreparation.subscribe, buildingVoicePreparation.getSnapshot, buildingVoicePreparation.getServerSnapshot)
  const [problem, setProblem] = useState('')
  const [retry, setRetry] = useState(0)
  const manual = useRef(false)
  const attempt = useRef('')
  useEffect(() => userId ? buildingVoicePreparation.retain() : undefined, [courseId, lessonId, userId])
  useEffect(() => {
    const stop = () => buildingVoicePreparation.dispose()
    const returned = () => setRetry(value => value + 1)
    window.addEventListener('pagehide', stop)
    document.addEventListener('freeze', stop)
    window.addEventListener('pageshow', returned)
    return () => { window.removeEventListener('pagehide', stop); document.removeEventListener('freeze', stop); window.removeEventListener('pageshow', returned) }
  }, [])
  useEffect(() => {
    if (!userId || !courseReady) return
    if (!supportsBuildingVoicePreparation()) { setProblem('当前浏览器不支持设备内语音，课程翻页仍可正常使用。'); return }
    // Automatic failures are not retried in a loop. A new visit or explicit settings action may retry.
    const key = `${courseId}:${lessonId}:${userId}:${retry}`
    if (attempt.current === key && !manual.current) return
    const requested = manual.current
    manual.current = false
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const cancel = scheduleVoiceIdle(() => {
      if (controller.signal.aborted) return
      attempt.current = key
      timeout = setTimeout(() => { controller.abort(); setProblem('课程语音权限校验超时，请联网后重试。') }, 15_000)
      void (async () => {
        try {
          const response = await fetch(`/api/tutor/speech/course-control?courseId=${courseId}&lessonId=${lessonId}`, { signal: controller.signal, cache: 'no-store' })
          const payload: unknown = response.ok ? await response.json() : null
          if (!payload || typeof payload !== 'object' || !('userId' in payload) || payload.userId !== userId || !('validForMs' in payload) || payload.validForMs !== 300_000) throw new Error('eligibility')
          if (controller.signal.aborted) return
          setProblem('')
          const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string; downlink?: number; type?: string } }).connection
          const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches
          buildingVoicePreparation.prepare(requested || allowAutomaticVoiceDownload(connection, mobile, navigator.onLine))
        } catch { if (!controller.signal.aborted) setProblem('暂时无法确认课程语音权限，请联网后重试。') }
        finally { clearTimeout(timeout) }
      })()
    })
    return () => { clearTimeout(timeout); controller.abort(); cancel() }
  }, [courseId, lessonId, userId, courseReady, retry])
  const prepare = useCallback(() => { manual.current = true; setProblem(''); setRetry(value => value + 1) }, [])
  return { ...snapshot, ready: snapshot.status === 'ready', problem, prepare, acquire: buildingVoicePreparation.acquire }
}
