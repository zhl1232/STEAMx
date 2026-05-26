"use client"

import { useEffect, useRef, useState, useCallback } from "react"

// ---------------------------------------------------------------------------
// 高德瓦片 URL – 与之前 Leaflet 版完全一致，不需要 API Key
// ---------------------------------------------------------------------------
const TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}"
const TILE_SUBDOMAINS = ["1", "2", "3", "4"]
const TILE_SIZE = 256
const MIN_ZOOM = 3
const MAX_ZOOM = 18

// ---------------------------------------------------------------------------
// 经纬度 ↔ 像素 转换 (Web Mercator / EPSG:3857)
// ---------------------------------------------------------------------------
function lngToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * Math.pow(2, zoom)
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
}

function lngToPixelX(lng: number, zoom: number) {
  return lngToTileX(lng, zoom) * TILE_SIZE
}

function latToPixelY(lat: number, zoom: number) {
  return latToTileY(lat, zoom) * TILE_SIZE
}

function pixelXToLng(px: number, zoom: number) {
  return (px / TILE_SIZE / Math.pow(2, zoom)) * 360 - 180
}

function pixelYToLat(py: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * py) / TILE_SIZE / Math.pow(2, zoom)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DomesticMiniMapMarker {
  latitude: number
  longitude: number
  label?: string
  observedAt?: string
  weight?: number
  color?: string
  imageUrl?: string | null
  summary?: string
  id?: string
  href?: string
}

interface DomesticMiniMapPopup {
  x: number
  y: number
  placement: "top" | "bottom"
  label: string
  observedAt?: string
  weight?: number
  imageUrl?: string | null
  summary?: string
  href?: string
}

interface MarkerHit {
  index: number
  x: number
  y: number
  marker: DomesticMiniMapMarker
}

interface DomesticMiniMapProps {
  markers: DomesticMiniMapMarker[]
  heightClassName?: string
  activeMarkerIndex?: number
  enableTimeDecay?: boolean
  enableDragInteractions?: boolean
  defaultCenter?: { lat: number; lon: number }
  defaultZoom?: number
  fitMode?: "markers" | "default"
  hoveredMarkerId?: string | null
  onMarkerHover?: (id: string | null) => void
  onMarkerClick?: (marker: DomesticMiniMapMarker) => void
}

// ---------------------------------------------------------------------------
// Marker style helpers (ported from old Leaflet version)
// ---------------------------------------------------------------------------
function computeDecayStyle(observedAt: string | undefined, isActive: boolean) {
  if (!observedAt) return { size: isActive ? 18 : 14, opacity: 1, color: isActive ? "#2563eb" : "#16a34a" }
  const ageMs = Date.now() - new Date(observedAt).getTime()
  const ageDays = ageMs / 86_400_000
  if (ageDays <= 7) return { size: isActive ? 20 : 16, opacity: 1, color: isActive ? "#2563eb" : "#15803d" }
  if (ageDays <= 30) return { size: isActive ? 18 : 14, opacity: 0.85, color: isActive ? "#2563eb" : "#22c55e" }
  if (ageDays <= 90) return { size: isActive ? 16 : 12, opacity: 0.65, color: isActive ? "#2563eb" : "#86efac" }
  return { size: isActive ? 14 : 10, opacity: 0.45, color: isActive ? "#2563eb" : "#bbf7d0" }
}

function computeMarkerStyle(marker: DomesticMiniMapMarker, isActive: boolean, enableTimeDecay: boolean, maxWeight: number) {
  const decay = enableTimeDecay
    ? computeDecayStyle(marker.observedAt, isActive)
    : { size: isActive ? 18 : 14, opacity: 1, color: isActive ? "#2563eb" : "#16a34a" }
  const weight = Math.max(1, marker.weight || 1)
  const weightBoost = maxWeight > 1 ? Math.round((Math.log1p(weight) / Math.log1p(maxWeight)) * 12) : 0
  return {
    ...decay,
    size: decay.size + weightBoost,
    color: marker.color || (isActive ? "#2563eb" : weight > 1 ? "#f59e0b" : decay.color),
  }
}

function formatPopupDate(dateString: string | undefined) {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  })
}

// ---------------------------------------------------------------------------
// Tile cache
// ---------------------------------------------------------------------------
const tileCache = new Map<string, HTMLImageElement>()

function getTileUrl(x: number, y: number, z: number) {
  const s = TILE_SUBDOMAINS[Math.abs(x + y) % TILE_SUBDOMAINS.length]
  return TILE_URL.replace("{s}", s).replace("{x}", String(x)).replace("{y}", String(y)).replace("{z}", String(z))
}

function loadTile(x: number, y: number, z: number): HTMLImageElement {
  const key = `${z}/${x}/${y}`
  const cached = tileCache.get(key)
  if (cached) return cached
  const img = new Image()
  img.crossOrigin = "anonymous"
  img.src = getTileUrl(x, y, z)
  tileCache.set(key, img)
  return img
}

// ---------------------------------------------------------------------------
// Fit bounds helper
// ---------------------------------------------------------------------------
function fitBounds(markers: DomesticMiniMapMarker[], width: number, height: number, padding = 0.25) {
  if (markers.length === 0) return { centerLng: 116.4, centerLat: 39.9, zoom: 11 }
  if (markers.length === 1) return { centerLng: markers[0].longitude, centerLat: markers[0].latitude, zoom: 14 }

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const m of markers) {
    if (m.latitude < minLat) minLat = m.latitude
    if (m.latitude > maxLat) maxLat = m.latitude
    if (m.longitude < minLng) minLng = m.longitude
    if (m.longitude > maxLng) maxLng = m.longitude
  }

  const latSpan = (maxLat - minLat) * (1 + padding * 2)
  const lngSpan = (maxLng - minLng) * (1 + padding * 2)
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2

  let zoom = MAX_ZOOM
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const pxWidth = Math.abs(lngToPixelX(centerLng + lngSpan / 2, z) - lngToPixelX(centerLng - lngSpan / 2, z))
    const pxHeight = Math.abs(latToPixelY(centerLat - latSpan / 2, z) - latToPixelY(centerLat + latSpan / 2, z))
    if (pxWidth <= width && pxHeight <= height) {
      zoom = z
      break
    }
  }

  return { centerLng, centerLat, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DomesticMiniMap({
  markers,
  heightClassName = "h-56",
  activeMarkerIndex = -1,
  enableTimeDecay = false,
  enableDragInteractions = true,
  defaultCenter,
  defaultZoom,
  fitMode = "markers",
  hoveredMarkerId = null,
  onMarkerHover,
  onMarkerClick,
}: DomesticMiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const initialCenter = defaultCenter ?? { lat: 39.9042, lon: 116.4074 }
  const initialZoom = defaultZoom ?? 11
  const stateRef = useRef({ centerLng: initialCenter.lon, centerLat: initialCenter.lat, zoom: initialZoom, dragging: false, dragStartX: 0, dragStartY: 0, dragStartLng: 0, dragStartLat: 0 })
  const animRef = useRef<number | null>(null)
  const hoveredMarkerIndexRef = useRef(-1)
  const popupLockedRef = useRef(false)
  const [popup, setPopup] = useState<DomesticMiniMapPopup | null>(null)

  const externalHoverIndex = hoveredMarkerId
    ? markers.findIndex((m) => m.id === hoveredMarkerId)
    : -1

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

    const { centerLng, centerLat, zoom } = stateRef.current
    const centerPx = lngToPixelX(centerLng, zoom)
    const centerPy = latToPixelY(centerLat, zoom)

    // Apply dark mode inversion via CSS filter on the canvas for tile rendering
    const isDark = document.documentElement.classList.contains("dark")

    // Draw tiles
    const tileStartX = Math.floor((centerPx - width / 2) / TILE_SIZE)
    const tileStartY = Math.floor((centerPy - height / 2) / TILE_SIZE)
    const tileEndX = Math.ceil((centerPx + width / 2) / TILE_SIZE)
    const tileEndY = Math.ceil((centerPy + height / 2) / TILE_SIZE)
    const maxTile = Math.pow(2, zoom)

    let allLoaded = true
    for (let tx = tileStartX; tx <= tileEndX; tx++) {
      for (let ty = tileStartY; ty <= tileEndY; ty++) {
        if (ty < 0 || ty >= maxTile) continue
        const wrappedTx = ((tx % maxTile) + maxTile) % maxTile
        const img = loadTile(wrappedTx, ty, zoom)
        const screenX = tx * TILE_SIZE - centerPx + width / 2
        const screenY = ty * TILE_SIZE - centerPy + height / 2

        if (img.complete && img.naturalWidth > 0) {
          if (isDark) {
            ctx.filter = "invert(0.88) hue-rotate(180deg) saturate(0.58) brightness(0.72) contrast(0.9)"
          }
          ctx.drawImage(img, screenX, screenY, TILE_SIZE, TILE_SIZE)
          if (isDark) {
            ctx.filter = "none"
          }
        } else {
          allLoaded = false
          ctx.fillStyle = isDark ? "#0b1710" : "#e8f1e9"
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
          img.onload = () => {
            if (canvasRef.current) draw()
          }
        }
      }
    }

    // Draw markers
    const maxWeight = Math.max(...markers.map((m) => m.weight || 1), 1)
    for (const [index, marker] of markers.entries()) {
      const isActive = index === activeMarkerIndex || index === hoveredMarkerIndexRef.current || index === externalHoverIndex
      const style = computeMarkerStyle(marker, isActive, enableTimeDecay, maxWeight)
      const mx = lngToPixelX(marker.longitude, zoom) - centerPx + width / 2
      const my = latToPixelY(marker.latitude, zoom) - centerPy + height / 2

      const r = style.size / 2

      ctx.save()
      ctx.globalAlpha = style.opacity

      // Shadow / glow
      ctx.beginPath()
      ctx.arc(mx, my, r + Math.max(6, style.size / 2), 0, Math.PI * 2)
      ctx.fillStyle = `${style.color}2b`
      ctx.fill()

      // White border
      ctx.beginPath()
      ctx.arc(mx, my, r + 3, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,0.95)"
      ctx.fill()

      // Colored dot
      ctx.beginPath()
      ctx.arc(mx, my, r, 0, Math.PI * 2)
      ctx.fillStyle = style.color
      ctx.fill()

      ctx.restore()
    }

    // Attribution
    ctx.save()
    ctx.font = "11px sans-serif"
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)"
    ctx.textAlign = "right"
    ctx.fillText("高德地图", width - 6, height - 6)
    ctx.restore()

    if (!allLoaded) {
      animRef.current = requestAnimationFrame(draw)
    }
  }, [markers, activeMarkerIndex, enableTimeDecay, externalHoverIndex])

  const findMarkerHit = useCallback((clientX: number, clientY: number): MarkerHit | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const pointX = clientX - rect.left
    const pointY = clientY - rect.top
    const width = rect.width
    const height = rect.height
    const { centerLng, centerLat, zoom } = stateRef.current
    const centerPx = lngToPixelX(centerLng, zoom)
    const centerPy = latToPixelY(centerLat, zoom)
    const maxWeight = Math.max(...markers.map((m) => m.weight || 1), 1)

    for (let index = markers.length - 1; index >= 0; index--) {
      const marker = markers[index]
      const style = computeMarkerStyle(marker, index === activeMarkerIndex, enableTimeDecay, maxWeight)
      const markerX = lngToPixelX(marker.longitude, zoom) - centerPx + width / 2
      const markerY = latToPixelY(marker.latitude, zoom) - centerPy + height / 2
      const hitRadius = Math.max(16, style.size / 2 + 8)

      if (Math.hypot(pointX - markerX, pointY - markerY) <= hitRadius) {
        return { index, x: markerX, y: markerY, marker }
      }
    }

    return null
  }, [markers, activeMarkerIndex, enableTimeDecay])

  const showPopupForHit = useCallback((hit: MarkerHit | null, opts?: { lock?: boolean; force?: boolean }) => {
    if (!hit) {
      if (popupLockedRef.current && !opts?.force) return
      const shouldRedraw = hoveredMarkerIndexRef.current !== -1
      hoveredMarkerIndexRef.current = -1
      popupLockedRef.current = false
      setPopup(null)
      if (shouldRedraw) {
        draw()
        onMarkerHover?.(null)
      }
      return
    }

    const canvas = canvasRef.current
    const width = canvas?.getBoundingClientRect().width ?? 0
    const popupHalfWidth = 108
    const x = width > popupHalfWidth * 2
      ? Math.min(Math.max(hit.x, popupHalfWidth), width - popupHalfWidth)
      : hit.x
    const placement = hit.y < 120 ? "bottom" : "top"

    const shouldRedraw = hoveredMarkerIndexRef.current !== hit.index
    hoveredMarkerIndexRef.current = hit.index
    if (opts?.lock) popupLockedRef.current = true
    setPopup({
      x,
      y: placement === "top" ? hit.y - 12 : hit.y + 16,
      placement,
      label: hit.marker.label || "观察热点",
      observedAt: hit.marker.observedAt,
      weight: hit.marker.weight,
      imageUrl: hit.marker.imageUrl,
      summary: hit.marker.summary,
      href: hit.marker.href,
    })
    if (shouldRedraw) {
      draw()
      onMarkerHover?.(hit.marker.id ?? null)
    }
  }, [draw, onMarkerHover])

  // Initialize & resize
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const rect = container.getBoundingClientRect()
    if (fitMode === "default" || markers.length === 0) {
      stateRef.current.centerLng = initialCenter.lon
      stateRef.current.centerLat = initialCenter.lat
      stateRef.current.zoom = initialZoom
    } else {
      const fit = fitBounds(markers, rect.width, rect.height)
      stateRef.current.centerLng = fit.centerLng
      stateRef.current.centerLat = fit.centerLat
      stateRef.current.zoom = fit.zoom
    }

    draw()

    const observer = new ResizeObserver(() => draw())
    observer.observe(container)

    return () => {
      observer.disconnect()
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
    }
  }, [markers, draw, fitMode, initialCenter.lat, initialCenter.lon, initialZoom])

  // Redraw on marker/activeIndex changes
  useEffect(() => {
    draw()
  }, [draw])

  // Drag interaction
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onPointerDown = (e: PointerEvent) => {
      if (!enableDragInteractions) return
      const s = stateRef.current
      s.dragging = true
      s.dragStartX = e.clientX
      s.dragStartY = e.clientY
      s.dragStartLng = s.centerLng
      s.dragStartLat = s.centerLat
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = "grabbing"
    }

    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current
      if (!s.dragging) {
        const hit = findMarkerHit(e.clientX, e.clientY)
        showPopupForHit(hit)
        canvas.style.cursor = hit ? "pointer" : enableDragInteractions ? "grab" : "default"
        return
      }

      const dx = e.clientX - s.dragStartX
      const dy = e.clientY - s.dragStartY
      s.centerLng = pixelXToLng(lngToPixelX(s.dragStartLng, s.zoom) - dx, s.zoom)
      s.centerLat = pixelYToLat(latToPixelY(s.dragStartLat, s.zoom) - dy, s.zoom)
      draw()
      showPopupForHit(null, { force: true })
    }

    const onPointerUp = () => {
      stateRef.current.dragging = false
      canvas.style.cursor = enableDragInteractions ? "grab" : "default"
    }

    const onPointerLeave = () => {
      if (!stateRef.current.dragging) {
        showPopupForHit(null)
        canvas.style.cursor = enableDragInteractions ? "grab" : "default"
      }
    }

    const onWindowPointerMove = (e: PointerEvent) => {
      if (stateRef.current.dragging || hoveredMarkerIndexRef.current === -1) return
      const rect = canvas.getBoundingClientRect()
      const isInsideCanvas =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom

      if (!isInsideCanvas) {
        showPopupForHit(null)
        canvas.style.cursor = enableDragInteractions ? "grab" : "default"
      }
    }

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", onPointerUp)
    canvas.addEventListener("pointercancel", onPointerUp)
    canvas.addEventListener("pointerleave", onPointerLeave)
    window.addEventListener("pointermove", onWindowPointerMove)

    canvas.style.cursor = enableDragInteractions ? "grab" : "default"

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointercancel", onPointerUp)
      canvas.removeEventListener("pointerleave", onPointerLeave)
      window.removeEventListener("pointermove", onWindowPointerMove)
    }
  }, [enableDragInteractions, draw, findMarkerHit, showPopupForHit])

  // Zoom with wheel
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = stateRef.current
      const delta = e.deltaY > 0 ? -1 : 1
      s.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom + delta))
      draw()
      showPopupForHit(null, { force: true })
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [draw, showPopupForHit])

  // Zoom buttons
  const handleZoom = useCallback((delta: number) => {
    const s = stateRef.current
    s.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom + delta))
    draw()
    showPopupForHit(null, { force: true })
  }, [draw, showPopupForHit])

  // Click to show popup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onClick = (e: MouseEvent) => {
      const hit = findMarkerHit(e.clientX, e.clientY)
      if (hit && onMarkerClick) {
        onMarkerClick(hit.marker)
      }
      showPopupForHit(hit, hit ? { lock: true } : { force: true })
    }

    canvas.addEventListener("click", onClick)
    return () => canvas.removeEventListener("click", onClick)
  }, [findMarkerHit, showPopupForHit, onMarkerClick])

  const popupDate = formatPopupDate(popup?.observedAt)

  return (
    <div
      ref={containerRef}
      className={`${heightClassName} nature-mini-map relative z-0 w-full overflow-hidden rounded-lg border border-[#cfe3d5] bg-[#e8f1e9] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[#274d37] dark:bg-[#0b1710] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: "none" }} />

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-[7] flex flex-col gap-1">
        <button
          type="button"
          onClick={() => handleZoom(1)}
          className="grid h-8 w-8 place-items-center rounded border border-[#cfe3d5] bg-[#f8fbf4]/[0.92] text-sm font-bold text-[#1d2b24] transition-colors hover:bg-[#edf7ef] dark:border-[#274d37] dark:bg-[#1a2a20]/[0.92] dark:text-[#c8efd2] dark:hover:bg-[#253d2e]"
          aria-label="放大"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handleZoom(-1)}
          className="grid h-8 w-8 place-items-center rounded border border-[#cfe3d5] bg-[#f8fbf4]/[0.92] text-sm font-bold text-[#1d2b24] transition-colors hover:bg-[#edf7ef] dark:border-[#274d37] dark:bg-[#1a2a20]/[0.92] dark:text-[#c8efd2] dark:hover:bg-[#253d2e]"
          aria-label="缩小"
        >
          −
        </button>
      </div>

      {/* Popup */}
      {popup ? (
        <div
          className={`absolute z-[8] w-[216px] -translate-x-1/2 rounded-lg border border-white/75 bg-[#f8fbf4]/95 p-2 text-xs text-[#1d2b24] shadow-[0_18px_42px_-18px_rgba(20,62,41,0.45)] backdrop-blur-md dark:border-white/10 dark:bg-[#122018]/95 dark:text-[#d9f4df] ${
            popup.placement === "top" ? "-translate-y-full" : ""
          } ${popup.href ? "" : "pointer-events-none"}`}
          style={{ left: popup.x, top: popup.y }}
        >
          <div className="flex gap-2">
            <div
              className="relative h-14 w-16 shrink-0 overflow-hidden rounded-md bg-[radial-gradient(circle_at_28%_22%,rgba(22,132,75,0.32),transparent_34%),linear-gradient(135deg,#dcefe2,#f7ead2)] bg-cover bg-center dark:bg-[radial-gradient(circle_at_28%_22%,rgba(116,215,154,0.22),transparent_34%),linear-gradient(135deg,#1b3a27,#1b2a20)]"
              style={popup.imageUrl ? { backgroundImage: `url(${popup.imageUrl})` } : undefined}
            >
              {!popup.imageUrl ? (
                <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#16844b]/85 ring-4 ring-white/80 dark:bg-[#74d79a]/90 dark:ring-[#102017]/85" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold leading-5 text-[#17251f] dark:text-[#f1fff4]">{popup.label}</p>
              <p className="mt-0.5 leading-5 text-[#65736c] dark:text-[#a8b8ae]">公开记录 {popup.weight ?? 1} 条</p>
              {popupDate ? (
                <p className="leading-5 text-[#65736c] dark:text-[#a8b8ae]">最近 {popupDate}</p>
              ) : null}
            </div>
          </div>
          {popup.summary ? (
            <p className="mt-2 line-clamp-2 leading-5 text-[#40564b] dark:text-[#bed4c4]">{popup.summary}</p>
          ) : null}
          {popup.href ? (
            <a
              href={popup.href}
              className="pointer-events-auto mt-2 inline-flex items-center gap-1 rounded-full bg-[#0f9a5a] px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_8px_18px_-12px_rgba(15,154,90,0.85)] transition-colors hover:bg-[#0b844b]"
            >
              查看详情 →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
