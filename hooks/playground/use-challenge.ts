"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

export type ChallengeGame = 'gomoku' | 'memory'
export type ChallengeView = {
  id: string; mode?: 'invite' | 'random'; myReady?: boolean; code?: string; game: ChallengeGame; status: string; version: number
  myRole: 'host' | 'guest'; opponentKind?: string; botLevel?: number; createdAt?: number
  serverNow?: number; startAt?: number | null; deadlineAt?: number | null; winner?: string | null; reason?: string | null
  state: Record<string, unknown>
}
type Response = { challenge: ChallengeView | null; remaining?: number; strength?: number; retry?: boolean }

export function useChallenge(game: ChallengeGame, enabled = true) {
  const [challenge, setChallenge] = useState<ChallengeView | null>(null)
  const [remaining, setRemaining] = useState(5)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [clockOffset, setClockOffset] = useState(0)
  const current = useRef(challenge)
  useEffect(() => { current.current = challenge }, [challenge])
  const generation = useRef(0)
  const mutation = useRef(0)
  const accept = useCallback((data: Response) => {
    setChallenge(previous => {
      if (previous && data.challenge?.id === previous.id && data.challenge.version < previous.version) return previous
      return data.challenge
    })
    if (typeof data.remaining === 'number') setRemaining(data.remaining)
    if (typeof data.challenge?.serverNow === 'number') setClockOffset(data.challenge.serverNow - Date.now())
  }, [])
  const request = useCallback(async (url: string, body?: unknown, signal?: AbortSignal) => {
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '暂时无法连接，请重试')
    return data as Response
  }, [])
  useEffect(() => {
    if (!enabled) return
    const abort = new AbortController()
    const token = ++generation.current
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const active = current.current
        const epoch = mutation.current
        const data = await request(active ? `/api/playground/challenges/${active.id}` : `/api/playground/challenges?game=${game}`, undefined, abort.signal)
        if (token === generation.current && epoch === mutation.current) { accept(data); if (data.challenge) setError('') }
      } catch (cause) {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : '连接失败')
      } finally {
        if (!abort.signal.aborted) timer = setTimeout(poll, 1000)
      }
    }
    void poll()
    return () => { abort.abort(); clearTimeout(timer) }
  }, [accept, enabled, game, request])
  const command = useCallback(async (operation: string, options: Record<string, unknown> = {}) => {
    if (busy) return
    mutation.current++; setBusy(true); setError('')
    try { accept(await request('/api/playground/challenges', { operation, game, ...options })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败') }
    finally { setBusy(false) }
  }, [accept, busy, game, request])
  const action = useCallback(async (type: string, options: Record<string, unknown> = {}) => {
    const active = current.current
    if (!active || busy) return
    mutation.current++; setBusy(true); setError('')
    const body = { type, requestId: crypto.randomUUID(), version: active.version, ...options }
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const data = await request(`/api/playground/challenges/${active.id}/actions`, body)
        accept(data)
        if (!data.retry) break
        if (attempt === 2) throw new Error('对局状态正在更新，请再试一次')
        if (data.challenge) body.version = data.challenge.version
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败') }
    finally { setBusy(false) }
  }, [accept, busy, request])
  return { challenge, remaining, error, busy, clockOffset, command, action, reset: () => { mutation.current++; current.current = null; setChallenge(null) } }
}
