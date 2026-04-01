"use client"

import { useEffect, useState } from "react"

import { logger } from "@/lib/logger"
import type { ObservationEvent } from "@/lib/mappers/types"

/**
 * 个人页「我的观察」：当桌面或移动端任一入口需要展示时 `shouldLoadObservations` 为 true，
 * 懒加载 /api/observations/mine 与 life-list；切换用户时重置。
 */
export function useProfileObservations(shouldLoadObservations: boolean, userId: string | undefined) {
  const [myObservations, setMyObservations] = useState<ObservationEvent[]>([])
  const [observationsTotal, setObservationsTotal] = useState(0)
  const [uniqueSpeciesCount, setUniqueSpeciesCount] = useState(0)
  const [isObservationsLoading, setIsObservationsLoading] = useState(false)
  const [observationsLoaded, setObservationsLoaded] = useState(false)

  useEffect(() => {
    setMyObservations([])
    setObservationsTotal(0)
    setUniqueSpeciesCount(0)
    setObservationsLoaded(false)
  }, [userId])

  useEffect(() => {
    if (!shouldLoadObservations || !userId || observationsLoaded) return

    let cancelled = false
    setIsObservationsLoading(true)

    Promise.all([
      fetch("/api/observations/mine?pageSize=50").then((r) => r.json()),
      fetch("/api/observations/life-list").then((r) => r.json()),
    ])
      .then(([mineData, lifeData]) => {
        if (cancelled) return
        setMyObservations(mineData.observations || [])
        setObservationsTotal(mineData.total || 0)
        setUniqueSpeciesCount(lifeData.uniqueSpeciesCount || 0)
      })
      .catch((err) => {
        logger.error("Failed to load user observations", { error: err })
      })
      .finally(() => {
        if (!cancelled) {
          setIsObservationsLoading(false)
          setObservationsLoaded(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [shouldLoadObservations, userId, observationsLoaded])

  return {
    myObservations,
    observationsTotal,
    uniqueSpeciesCount,
    isObservationsLoading,
    observationsLoaded,
  }
}
