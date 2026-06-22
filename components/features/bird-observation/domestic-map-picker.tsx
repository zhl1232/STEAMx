"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { reverseGeocode } from "@/lib/reverse-geocode"
import { cn } from "@/lib/utils"

const TILE_SIZE = 256
const MIN_ZOOM = 3
const MAX_ZOOM = 18

// ---------------------------------------------------------------------------
// Mercator projection helpers
// ---------------------------------------------------------------------------
function lngToPixelX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * Math.pow(2, zoom) * TILE_SIZE
}

function latToPixelY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom) * TILE_SIZE
}

function pixelXToLng(px: number, zoom: number) {
  return (px / TILE_SIZE / Math.pow(2, zoom)) * 360 - 180
}

function pixelYToLat(py: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * py) / TILE_SIZE / Math.pow(2, zoom)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

function drawLocalMapBackground(ctx: CanvasRenderingContext2D, width: number, height: number, isDark: boolean) {
  const bg = ctx.createLinearGradient(0, 0, width, height)
  if (isDark) {
    bg.addColorStop(0, "#07130f")
    bg.addColorStop(0.6, "#0f1f24")
    bg.addColorStop(1, "#172018")
  } else {
    bg.addColorStop(0, "#e9f6ee")
    bg.addColorStop(0.58, "#dceef4")
    bg.addColorStop(1, "#f2ecd8")
  }
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(18,80,70,0.12)"
  ctx.lineWidth = 1
  for (let x = 24; x < width; x += 48) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 24; y < height; y += 48) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  ctx.strokeStyle = isDark ? "rgba(125,211,252,0.16)" : "rgba(37,99,235,0.14)"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(width * 0.08, height * 0.62)
  ctx.bezierCurveTo(width * 0.28, height * 0.45, width * 0.42, height * 0.78, width * 0.62, height * 0.48)
  ctx.bezierCurveTo(width * 0.76, height * 0.28, width * 0.88, height * 0.36, width * 0.98, height * 0.18)
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DomesticMapPickerProps {
  latitude: string
  longitude: string
  onChange: (coords: { latitude: string; longitude: string }) => void
  onLocationNameSuggestion?: (name: string) => void
  className?: string
  mapClassName?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DomesticMapPicker({
  latitude,
  longitude,
  onChange,
  onLocationNameSuggestion,
  className,
  mapClassName,
}: DomesticMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef({
    centerLng: longitude ? Number(longitude) : 116.4074,
    centerLat: latitude ? Number(latitude) : 39.9042,
    zoom: latitude && longitude ? 14 : 11,
    markerLng: longitude ? Number(longitude) : 116.4074,
    markerLat: latitude ? Number(latitude) : 39.9042,
    draggingMap: false,
    draggingMarker: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartLng: 0,
    dragStartLat: 0,
  })
  const [isReady, setIsReady] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const geocodeAbortRef = useRef<AbortController | null>(null)
  const onChangeRef = useRef(onChange)
  const onLocationNameSuggestionRef = useRef(onLocationNameSuggestion)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onLocationNameSuggestionRef.current = onLocationNameSuggestion }, [onLocationNameSuggestion])

  const doReverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!onLocationNameSuggestionRef.current) return

    geocodeAbortRef.current?.abort()
    const controller = new AbortController()
    geocodeAbortRef.current = controller

    setIsGeocoding(true)
    try {
      const name = await reverseGeocode(lat, lng, controller.signal)
      if (name && !controller.signal.aborted) {
        onLocationNameSuggestionRef.current(name)
      }
    } finally {
      if (!controller.signal.aborted) setIsGeocoding(false)
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const { centerLng, centerLat, zoom, markerLng, markerLat } = stateRef.current
    const centerPx = lngToPixelX(centerLng, zoom)
    const centerPy = latToPixelY(centerLat, zoom)
    const isDark = document.documentElement.classList.contains("dark")

    drawLocalMapBackground(ctx, width, height, isDark)

    // Draw marker pin
    const mx = lngToPixelX(markerLng, zoom) - centerPx + width / 2
    const my = latToPixelY(markerLat, zoom) - centerPy + height / 2

    ctx.save()
    // Shadow
    ctx.beginPath()
    ctx.arc(mx, my, 14, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.25)"
    ctx.fill()
    // White border
    ctx.beginPath()
    ctx.arc(mx, my, 13, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
    // Blue dot
    ctx.beginPath()
    ctx.arc(mx, my, 10, 0, Math.PI * 2)
    ctx.fillStyle = "#2563eb"
    ctx.fill()
    ctx.restore()

    // Attribution
    ctx.save()
    ctx.font = "11px sans-serif"
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)"
    ctx.textAlign = "right"
    ctx.fillText("本地坐标概览", width - 6, height - 6)
    ctx.restore()
  }, [])

  // Init
  useEffect(() => {
    const container = containerRef.current
    if (!container || !canvasRef.current) return

    setIsReady(true)
    draw()

    const observer = new ResizeObserver(() => draw())
    observer.observe(container)

    return () => {
      observer.disconnect()
      geocodeAbortRef.current?.abort()
    }
  }, [draw])

  // Sync external lat/lng changes
  useEffect(() => {
    if (!latitude || !longitude) return
    const nextLat = Number(latitude)
    const nextLng = Number(longitude)
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return

    const s = stateRef.current
    s.markerLat = nextLat
    s.markerLng = nextLng
    s.centerLat = nextLat
    s.centerLng = nextLng
    s.zoom = Math.max(s.zoom, 14)
    draw()
  }, [latitude, longitude, draw])

  // Pointer interactions (drag map & click to place marker)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let pointerDownAt = 0

    const onPointerDown = (e: PointerEvent) => {
      const s = stateRef.current
      const rect = canvas.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      // Check if clicking on the marker to drag it
      const centerPx = lngToPixelX(s.centerLng, s.zoom)
      const centerPy = latToPixelY(s.centerLat, s.zoom)
      const mx = lngToPixelX(s.markerLng, s.zoom) - centerPx + rect.width / 2
      const my = latToPixelY(s.markerLat, s.zoom) - centerPy + rect.height / 2
      const dist = Math.sqrt((clickX - mx) ** 2 + (clickY - my) ** 2)

      pointerDownAt = Date.now()

      if (dist < 20) {
        s.draggingMarker = true
      } else {
        s.draggingMap = true
        s.dragStartX = e.clientX
        s.dragStartY = e.clientY
        s.dragStartLng = s.centerLng
        s.dragStartLat = s.centerLat
      }
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = s.draggingMarker ? "grabbing" : "grabbing"
    }

    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current
      if (s.draggingMarker) {
        const rect = canvas.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        const centerPx = lngToPixelX(s.centerLng, s.zoom)
        const centerPy = latToPixelY(s.centerLat, s.zoom)
        s.markerLng = pixelXToLng(centerPx - rect.width / 2 + clickX, s.zoom)
        s.markerLat = pixelYToLat(centerPy - rect.height / 2 + clickY, s.zoom)
        draw()
      } else if (s.draggingMap) {
        const dx = e.clientX - s.dragStartX
        const dy = e.clientY - s.dragStartY
        s.centerLng = pixelXToLng(lngToPixelX(s.dragStartLng, s.zoom) - dx, s.zoom)
        s.centerLat = pixelYToLat(latToPixelY(s.dragStartLat, s.zoom) - dy, s.zoom)
        draw()
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const s = stateRef.current
      const elapsed = Date.now() - pointerDownAt

      if (s.draggingMarker) {
        const lat = s.markerLat.toFixed(6)
        const lng = s.markerLng.toFixed(6)
        onChangeRef.current({ latitude: lat, longitude: lng })
        void doReverseGeocode(s.markerLat, s.markerLng)
      } else if (s.draggingMap && elapsed < 200) {
        // Short click = place marker
        const rect = canvas.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        const centerPx = lngToPixelX(s.centerLng, s.zoom)
        const centerPy = latToPixelY(s.centerLat, s.zoom)
        s.markerLng = pixelXToLng(centerPx - rect.width / 2 + clickX, s.zoom)
        s.markerLat = pixelYToLat(centerPy - rect.height / 2 + clickY, s.zoom)
        draw()
        const lat = s.markerLat.toFixed(6)
        const lng = s.markerLng.toFixed(6)
        onChangeRef.current({ latitude: lat, longitude: lng })
        void doReverseGeocode(s.markerLat, s.markerLng)
      }

      s.draggingMap = false
      s.draggingMarker = false
      canvas.style.cursor = "grab"
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = stateRef.current
      const delta = e.deltaY > 0 ? -1 : 1
      s.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom + delta))
      draw()
    }

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", onPointerUp)
    canvas.addEventListener("pointercancel", onPointerUp)
    canvas.addEventListener("wheel", onWheel, { passive: false })
    canvas.style.cursor = "grab"

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointercancel", onPointerUp)
      canvas.removeEventListener("wheel", onWheel)
    }
  }, [draw, doReverseGeocode])

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <div
          ref={containerRef}
          className={cn(
            "h-72 w-full overflow-hidden rounded-md border border-border/70 [background:var(--obs-map-bg)]",
            mapClassName,
          )}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: "none" }} />
        </div>
        {!isReady ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent">
            <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(28deg,transparent_0_44%,rgba(143,211,156,0.18)_45%_47%,transparent_48%_100%),linear-gradient(150deg,transparent_0_52%,rgba(105,181,132,0.16)_53%_55%,transparent_56%_100%),radial-gradient(circle_at_64%_42%,rgba(77,199,112,0.28),transparent_9%)]" />
            <div className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--obs-accent)] [box-shadow:var(--obs-soft-shadow)]">
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        点击地图或拖动标记选点，选点后会自动识别地点名称。
        {!isReady && " 地图加载中..."}
        {isGeocoding && " 正在识别地点名称..."}
      </p>
    </div>
  )
}
