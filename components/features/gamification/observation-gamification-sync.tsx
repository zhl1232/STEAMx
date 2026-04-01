"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { OBSERVATION_CREATED_EVENT } from "@/lib/gamification/observation-events"

/**
 * 监听「观察已创建」事件，失效游戏化统计缓存；与提交表单解耦。
 */
export function ObservationGamificationSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: ["gamification", "stats"] })
    }
    window.addEventListener(OBSERVATION_CREATED_EVENT, handler)
    return () => window.removeEventListener(OBSERVATION_CREATED_EVENT, handler)
  }, [queryClient])

  return null
}
