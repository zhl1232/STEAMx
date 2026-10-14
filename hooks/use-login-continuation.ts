'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'

/** Read committed provider state rather than the closure from before login. */
export function useLoginContinuation<T extends (...args: never[]) => unknown>(callback: T): T {
  const latest = useRef(callback)
  useLayoutEffect(() => { latest.current = callback })
  return useCallback((...args: Parameters<T>) => latest.current(...args), []) as T
}
