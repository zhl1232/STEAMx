"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { RotateCcw } from "lucide-react"

import type { NativeLessonId, SceneItemId } from "@/lib/textbook3d/native/native-lessons"
import type { BookPage } from "@/lib/textbook3d/native/book-motion"
import type { PlantStage } from "@/lib/textbook3d/native/plant-stage"
import styles from "./plant-lesson.module.css"

export function PlantCanvas({ lessonId = "p1a-1-1", plant, interaction = 0, page = 0, onSelect, onTurningChange, showTreeLabels = false, onLabelsDismiss, onVisibleChange }: {
  lessonId?: NativeLessonId
  plant: SceneItemId
  interaction?: number
  page?: BookPage
  onSelect?: (plant: SceneItemId) => void
  onTurningChange?: (turning: boolean) => void
  showTreeLabels?: boolean
  onLabelsDismiss?: () => void
  onVisibleChange?: (visible: boolean) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const stage = useRef<PlantStage | null>(null)
  const currentPlant = useRef(plant)
  const currentPage = useRef(page)
  const callbacks = useRef({ onSelect, onTurningChange, onLabelsDismiss, onVisibleChange })
  const currentLabels = useRef(showTreeLabels)
  useEffect(() => { callbacks.current = { onSelect, onTurningChange, onLabelsDismiss, onVisibleChange } }, [onSelect, onTurningChange, onLabelsDismiss, onVisibleChange])
  // Start the turn/conceal text before the newly requested page can paint.
  useLayoutEffect(() => { currentPage.current = page; stage.current?.setPage(page) }, [page])
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useLayoutEffect(() => {
    currentPlant.current = plant
    currentLabels.current = showTreeLabels
    stage.current?.setPlant(plant)
    stage.current?.setLabels(showTreeLabels)
  }, [plant, showTreeLabels])

  useLayoutEffect(() => {
    if (interaction > 0) stage.current?.playResponse(currentPlant.current)
  }, [interaction])

  useEffect(() => {
    const element = host.current
    if (!element) return
    let cancelled = false
    let loading = false
    let visible = false
    const startedAt = performance.now()
    const initialize = async () => {
      if (loading || stage.current || cancelled || !visible) return
      loading = true
      try {
        const { createPlantStage } = await import("@/lib/textbook3d/native/plant-stage")
        const createModels = lessonId === "p1a-1-2" ? (await import("@/lib/textbook3d/native/observation-models")).createObservationModels : undefined
        if (cancelled || !visible) return
        stage.current = createPlantStage(element, {
          lessonId,
          plant: currentPlant.current,
          createModels,
          page: currentPage.current,
          showTreeLabels: currentLabels.current,
          onLabelsDismiss: () => { if (!cancelled) callbacks.current.onLabelsDismiss?.() },
          onSelect: (id) => { if (!cancelled) callbacks.current.onSelect?.(id) },
          onTurningChange: (turning) => { if (!cancelled) callbacks.current.onTurningChange?.(turning) },
          startedAt,
          onReady: () => { if (!cancelled) setStatus("ready") },
          onError: () => {
            if (!cancelled) {
              const spread = element.closest<HTMLElement>("[data-book-spread]")
              if (spread) spread.dataset.bookLayout = "compact"
              setStatus("error")
            }
          },
        })
        stage.current.setVisible(visible)
      } catch {
        if (!cancelled) {
          const spread = element.closest<HTMLElement>("[data-book-spread]")
          if (spread) spread.dataset.bookLayout = "compact"
          setStatus("error")
        }
      } finally {
        loading = false
      }
    }
    // A project page may contain hidden desktop/mobile variants. Only the visible
    // variant owns a renderer. Release it if its layout is hidden on rotation.
    const updateVisibility = (next: boolean) => {
      if (cancelled) return
      visible = next
      callbacks.current.onVisibleChange?.(next)
      stage.current?.setVisible(next)
      if (next) void initialize()
      else if (element.getBoundingClientRect().width === 0 && stage.current) {
        stage.current.dispose()
        stage.current = null
      }
    }
    const observer = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => updateVisibility(entries.some((entry) => entry.isIntersecting))) : null
    if (observer) observer.observe(element)
    else updateVisibility(true)
    return () => {
      cancelled = true
      observer?.disconnect()
      stage.current?.dispose()
      stage.current = null
    }
  }, [attempt, lessonId])

  return (
    <div className={styles.stage} data-render-state={status}>
      <div ref={host} className={styles.canvasHost} />
      {status === "ready" && <button type="button" className={styles.reset} aria-label="恢复视角" title="恢复视角" onClick={() => stage.current?.resetView()}>
        <RotateCcw size={18} aria-hidden />
      </button>}
      {status !== "ready" && <div className={styles.stageStatus} role={status === "error" ? "alert" : "status"}>
        <p>{status === "error" ? "3D 画面暂时打不开" : "正在打开立体书…"}</p>
        {status === "error" && <>
          <p className={styles.muted}>可以先阅读本课，或重新加载模型。</p>
          <button type="button" className={styles.secondary} onClick={() => { setStatus("loading"); setAttempt((value) => value + 1) }}>重新加载 3D</button>
        </>}
      </div>}
    </div>
  )
}
