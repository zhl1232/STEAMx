"use client"

import { useEffect, useRef } from "react"

/** 与 `lib/playground/storage` 的 PLAYGROUND_CHANGE_EVENT 保持同名，避免测试 mock storage 时丢导出。 */
const PLAYGROUND_STATS_CHANGE_EVENT = "playground-stats-change"

/** 挂载时加载战绩，并在云端同步/清理后重新加载。 */
export function usePlaygroundStatsLoader(reload: () => void) {
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  useEffect(() => {
    const handler = () => {
      reloadRef.current()
    }
    handler()
    window.addEventListener(PLAYGROUND_STATS_CHANGE_EVENT, handler)
    return () => window.removeEventListener(PLAYGROUND_STATS_CHANGE_EVENT, handler)
  }, [])
}
