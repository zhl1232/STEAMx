"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LayerGroup, Map as LeafletMap, Marker as LeafletMarker } from "leaflet"

import { addDomesticTileLayer, loadLeaflet, type LeafletModule } from "@/lib/maps/domestic-leaflet"
import { cn } from "@/lib/utils"

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

interface DomesticMiniMapProps {
  markers: DomesticMiniMapMarker[]
  heightClassName?: string
  className?: string
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

function computeDecayStyle(observedAt: string | undefined, isActive: boolean) {
  if (!observedAt) return { size: isActive ? 18 : 14, opacity: 1, color: isActive ? "#2563eb" : "#16a34a" }
  const ageMs = Date.now() - new Date(observedAt).getTime()
  const ageDays = ageMs / 86_400_000
  if (ageDays <= 7) return { size: isActive ? 20 : 16, opacity: 1, color: isActive ? "#2563eb" : "#15803d" }
  if (ageDays <= 30) return { size: isActive ? 18 : 14, opacity: 0.85, color: isActive ? "#2563eb" : "#22c55e" }
  if (ageDays <= 90) return { size: isActive ? 16 : 12, opacity: isActive ? 1 : 0.72, color: isActive ? "#2563eb" : "#4f9d70" }
  return { size: isActive ? 14 : 10, opacity: isActive ? 1 : 0.62, color: isActive ? "#2563eb" : "#5f9270" }
}

function computeMarkerStyle(
  marker: DomesticMiniMapMarker,
  isActive: boolean,
  enableTimeDecay: boolean,
  maxWeight: number,
) {
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

function createMarkerIcon(L: LeafletModule) {
  return L.divIcon({
    className: "nature-map-marker-shell",
    html: '<span class="nature-map-marker-dot" aria-hidden="true"></span>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -17],
  })
}

function appendText(parent: HTMLElement, className: string, text: string) {
  const element = document.createElement("p")
  element.className = className
  element.textContent = text
  parent.append(element)
}

function createPopupContent(marker: DomesticMiniMapMarker) {
  const root = document.createElement("div")
  root.className = "nature-map-popup-card"

  const row = document.createElement("div")
  row.className = "nature-map-popup-row"

  const media = document.createElement("div")
  media.className = "nature-map-popup-media"
  if (marker.imageUrl) {
    const image = document.createElement("img")
    image.src = marker.imageUrl
    image.alt = ""
    image.loading = "lazy"
    media.append(image)
  } else {
    const fallback = document.createElement("span")
    fallback.className = "nature-map-popup-fallback"
    media.append(fallback)
  }

  const details = document.createElement("div")
  details.className = "nature-map-popup-details"
  appendText(details, "nature-map-popup-title", marker.label || "观察热点")
  appendText(details, "nature-map-popup-meta", `公开记录 ${marker.weight ?? 1} 条`)
  const popupDate = formatPopupDate(marker.observedAt)
  if (popupDate) appendText(details, "nature-map-popup-meta", `最近 ${popupDate}`)

  row.append(media, details)
  root.append(row)

  if (marker.summary) appendText(root, "nature-map-popup-summary", marker.summary)

  if (marker.href) {
    const link = document.createElement("a")
    link.href = marker.href
    link.className = "nature-map-popup-link"
    link.textContent = "查看观察记录"
    link.setAttribute("aria-label", `查看${marker.label || "观察热点"}观察记录`)
    root.append(link)
  }

  return root
}

export function DomesticMiniMap({
  markers,
  heightClassName = "h-56",
  className,
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerLayerRef = useRef<LayerGroup | null>(null)
  const markerRefs = useRef<LeafletMarker[]>([])
  const leafletRef = useRef<LeafletModule | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const popupLockedIndexRef = useRef<number | null>(null)
  const onMarkerHoverRef = useRef(onMarkerHover)
  const onMarkerClickRef = useRef(onMarkerClick)
  const initialViewRef = useRef({
    center: defaultCenter ?? { lat: 39.9042, lon: 116.4074 },
    zoom: defaultZoom ?? 11,
    dragEnabled: enableDragInteractions,
  })
  const [isReady, setIsReady] = useState(false)
  const [hoveredMarkerIndex, setHoveredMarkerIndex] = useState(-1)

  useEffect(() => {
    onMarkerHoverRef.current = onMarkerHover
  }, [onMarkerHover])

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
  }, [onMarkerClick])

  useEffect(() => {
    let disposed = false

    const initialize = async () => {
      const L = await loadLeaflet()
      const container = containerRef.current
      if (disposed || !container || mapRef.current) return

      const initialView = initialViewRef.current
      const map = L.map(container, {
        zoomControl: false,
        attributionControl: true,
        dragging: initialView.dragEnabled,
        touchZoom: initialView.dragEnabled,
        scrollWheelZoom: initialView.dragEnabled,
        doubleClickZoom: initialView.dragEnabled,
        boxZoom: initialView.dragEnabled,
        keyboard: initialView.dragEnabled,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        worldCopyJump: true,
      }).setView([initialView.center.lat, initialView.center.lon], initialView.zoom)

      addDomesticTileLayer(L, map)
      L.control.zoom({
        position: "bottomleft",
        zoomInTitle: "放大",
        zoomOutTitle: "缩小",
      }).addTo(map)

      leafletRef.current = L
      mapRef.current = map
      markerLayerRef.current = L.layerGroup().addTo(map)

      map.on("click", () => {
        popupLockedIndexRef.current = null
        setHoveredMarkerIndex(-1)
        onMarkerHoverRef.current?.(null)
      })

      const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }))
      resizeObserver.observe(container)
      resizeObserverRef.current = resizeObserver

      window.requestAnimationFrame(() => {
        if (!disposed) map.invalidateSize({ pan: false })
      })
      setIsReady(true)
    }

    void initialize()

    return () => {
      disposed = true
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      markerRefs.current = []
      markerLayerRef.current?.clearLayers()
      markerLayerRef.current = null
      if (mapRef.current) {
        mapRef.current.stop()
        mapRef.current.remove()
      }
      mapRef.current = null
      leafletRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isReady) return

    const handlers = [map.dragging, map.touchZoom, map.scrollWheelZoom, map.doubleClickZoom, map.boxZoom, map.keyboard]
    for (const handler of handlers) {
      if (enableDragInteractions) handler.enable()
      else handler.disable()
    }
  }, [enableDragInteractions, isReady])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = markerLayerRef.current
    if (!L || !map || !layer || !isReady) return

    popupLockedIndexRef.current = null
    setHoveredMarkerIndex(-1)
    layer.clearLayers()
    markerRefs.current = []

    const bounds = L.latLngBounds([])
    for (const [index, markerData] of markers.entries()) {
      const point = L.latLng(markerData.latitude, markerData.longitude)
      const marker = L.marker(point, {
        icon: createMarkerIcon(L),
        keyboard: true,
        bubblingMouseEvents: false,
        riseOnHover: true,
        title: markerData.label || "观察热点",
        alt: markerData.label || "观察热点",
      }).addTo(layer)

      marker.bindPopup(createPopupContent(markerData), {
        className: "nature-map-popup",
        closeButton: false,
        minWidth: 240,
        maxWidth: 240,
        offset: [0, 40],
        autoPan: true,
      })

      marker.on("mouseover", () => {
        const lockedIndex = popupLockedIndexRef.current
        if (lockedIndex != null && lockedIndex !== index) return
        setHoveredMarkerIndex(index)
        marker.openPopup()
        onMarkerHoverRef.current?.(markerData.id ?? null)
      })
      marker.on("mouseout", () => {
        if (popupLockedIndexRef.current != null) return
        setHoveredMarkerIndex(-1)
        marker.closePopup()
        onMarkerHoverRef.current?.(null)
      })
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event.originalEvent)
        popupLockedIndexRef.current = index
        setHoveredMarkerIndex(index)
        marker.openPopup()
        onMarkerHoverRef.current?.(markerData.id ?? null)
        onMarkerClickRef.current?.(markerData)
      })
      marker.on("popupclose", () => {
        if (popupLockedIndexRef.current !== index) return
        popupLockedIndexRef.current = null
        setHoveredMarkerIndex(-1)
        onMarkerHoverRef.current?.(null)
      })

      markerRefs.current.push(marker)
      bounds.extend(point)
    }

    if (fitMode === "markers" && markers.length > 0) {
      if (markers.length === 1) {
        map.setView(bounds.getCenter(), 14, { animate: false })
      } else {
        map.fitBounds(bounds, { animate: false, padding: [24, 24] })
      }
    }
  }, [fitMode, isReady, markers])

  const updateMarkerStyles = useCallback(() => {
    const maxWeight = Math.max(...markers.map((marker) => marker.weight || 1), 1)

    for (const [index, marker] of markerRefs.current.entries()) {
      const markerData = markers[index]
      if (!markerData) continue
      const isExternallyHovered = hoveredMarkerId != null && markerData.id === hoveredMarkerId
      const isActive = index === activeMarkerIndex || index === hoveredMarkerIndex || isExternallyHovered
      const style = computeMarkerStyle(markerData, isActive, enableTimeDecay, maxWeight)
      const element = marker.getElement()
      if (!element) continue

      element.style.setProperty("--nature-marker-size", `${style.size}px`)
      element.style.setProperty("--nature-marker-color", style.color)
      element.style.setProperty("--nature-marker-opacity", String(style.opacity))
      element.style.setProperty("--nature-marker-glow", `${Math.max(6, style.size / 2)}px`)
      element.setAttribute("aria-label", markerData.label || "观察热点")
      marker.setZIndexOffset(isActive ? 1000 : 0)
    }
  }, [activeMarkerIndex, enableTimeDecay, hoveredMarkerId, hoveredMarkerIndex, markers])

  useEffect(() => {
    updateMarkerStyles()
  }, [updateMarkerStyles])

  return (
    <div
      ref={containerRef}
      className={cn(
        heightClassName,
        "nature-mini-map nature-leaflet-map relative z-0 w-full overflow-hidden rounded-xs border border-[#cfe3d5] bg-[#e8f1e9] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[#274d37] dark:bg-[#0b1710] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
      aria-label="自然观察地图"
    />
  )
}
