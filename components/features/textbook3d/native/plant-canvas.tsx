"use client"

import { useEffect, useRef, useState } from "react"
import { RotateCcw } from "lucide-react"

import type { PlantId } from "@/lib/textbook3d/native/plants"
import type { BookPage } from "@/lib/textbook3d/native/book-motion"
import type { PlantStage } from "@/lib/textbook3d/native/plant-stage"
import styles from "./plant-lesson.module.css"

export function PlantCanvas({ plant, page = 0, onSelect, onTurningChange }: {
  plant: PlantId
  page?: BookPage
  onSelect?: (plant: PlantId) => void
  onTurningChange?: (turning: boolean) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const stage = useRef<PlantStage | null>(null)
  const currentPlant = useRef(plant)
  const currentPage = useRef(page)
  const callbacks = useRef({ onSelect, onTurningChange })
  useEffect(() => { callbacks.current = { onSelect, onTurningChange } }, [onSelect, onTurningChange])
  useEffect(() => { currentPage.current = page; stage.current?.setPage(page) }, [page])
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    currentPlant.current = plant
    stage.current?.setPlant(plant)
  }, [plant])

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
        if (cancelled || !visible) return
        stage.current = createPlantStage(element, {
          plant: currentPlant.current,
          page: currentPage.current,
          onSelect: (id) => { if (!cancelled) callbacks.current.onSelect?.(id) },
          onTurningChange: (turning) => { if (!cancelled) callbacks.current.onTurningChange?.(turning) },
          startedAt,
          onReady: () => { if (!cancelled) setStatus("ready") },
          onError: () => { if (!cancelled) setStatus("error") },
        })
        stage.current.setVisible(visible)
      } catch {
        if (!cancelled) setStatus("error")
      } finally {
        loading = false
      }
    }
    // A project page may contain hidden desktop/mobile variants. Only the visible
    // variant owns a renderer. Release it if its layout is hidden on rotation.
    const updateVisibility = (next: boolean) => {
      if (cancelled) return
      visible = next
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
  }, [attempt])

  return (
    <div className={styles.stage} data-render-state={status}>
      <div ref={host} className={styles.canvasHost}>
        <div data-book-inscription className={styles.inscription} aria-hidden="true">
          <strong>{page === 0 ? "我们知道的植物" : "带着发现去找一找"}</strong>
          <span>{page === 0 ? "看见 · 观察 · 比较" : "校园里 · 公园里"}</span>
        </div>
      </div>
      {status === "ready" && <button type="button" className={styles.reset} onClick={() => stage.current?.resetView()}>
        <RotateCcw size={16} aria-hidden />恢复视角
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
