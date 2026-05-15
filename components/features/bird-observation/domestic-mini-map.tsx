"use client"

import { useEffect, useRef, useState } from "react"

type LeafletModule = typeof import("leaflet")

interface DomesticMiniMapMarker {
  latitude: number
  longitude: number
  label?: string
  observedAt?: string
  weight?: number
}

interface DomesticMiniMapProps {
  markers: DomesticMiniMapMarker[]
  heightClassName?: string
  activeMarkerIndex?: number
  enableTimeDecay?: boolean
  enableDragInteractions?: boolean
}

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
    color: isActive ? "#2563eb" : weight > 1 ? "#f59e0b" : decay.color,
  }
}

export function DomesticMiniMap({
  markers,
  heightClassName = "h-56",
  activeMarkerIndex = -1,
  enableTimeDecay = false,
  enableDragInteractions = true,
}: DomesticMiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const timeoutIdRef = useRef<number | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      if (!containerRef.current || mapRef.current || markers.length === 0) return
      const container = containerRef.current

      const L = await import("leaflet")
      if (!isMounted || !container) return

      leafletRef.current = L

      const first = markers[0]
      const map = L.map(container, {
        zoomControl: false,
        attributionControl: true,
        dragging: enableDragInteractions,
        touchZoom: enableDragInteractions,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      }).setView([first.latitude, first.longitude], markers.length === 1 ? 14 : 11)

      L.control.zoom({ position: "bottomright" }).addTo(map)

      L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}", {
        subdomains: ["1", "2", "3", "4"],
        maxZoom: 18,
        minZoom: 3,
        attribution: "高德地图",
      }).addTo(map)

      const layer = L.layerGroup().addTo(map)
      markersLayerRef.current = layer
      mapRef.current = map
      setIsReady(true)

      // Keep leaflet layers beneath page-level sticky actions and nav bars.
      const panes = {
        tilePane: 1,
        overlayPane: 2,
        shadowPane: 3,
        markerPane: 4,
        tooltipPane: 5,
        popupPane: 6,
      } as const

      for (const [paneName, zIndex] of Object.entries(panes)) {
        const pane = map.getPane(paneName)
        if (pane) pane.style.zIndex = String(zIndex)
      }

      const controlContainer = container.querySelector<HTMLElement>(".leaflet-control-container")
      if (controlContainer) {
        controlContainer.style.zIndex = "7"
      }

      const resizeObserver = new ResizeObserver(() => {
        if (!mapRef.current) return
        map.invalidateSize()
      })
      resizeObserver.observe(container)
      resizeObserverRef.current = resizeObserver

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (!mapRef.current) return
        map.invalidateSize()
      })

      timeoutIdRef.current = window.setTimeout(() => {
        if (!mapRef.current) return
        map.invalidateSize()
      }, 120)
    }

    init()

    return () => {
      isMounted = false
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (timeoutIdRef.current != null) {
        window.clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      markersLayerRef.current?.clearLayers()
      markersLayerRef.current = null
      if (mapRef.current) {
        // Stop any in-progress zoom/pan animation before removing the map,
        // otherwise the transitionend callback fires on a destroyed pane.
        mapRef.current.stop()
        mapRef.current.remove()
      }
      mapRef.current = null
      leafletRef.current = null
    }
    // The map instance is intentionally initialized once; marker updates are handled by the layer effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = markersLayerRef.current
    if (!isReady || !L || !map || !layer || markers.length === 0) return
    if (!map.getContainer().isConnected) return

    layer.clearLayers()

    const bounds = L.latLngBounds([])
    const maxWeight = Math.max(...markers.map((marker) => marker.weight || 1), 1)
    for (const [index, marker] of markers.entries()) {
      const point = L.latLng(marker.latitude, marker.longitude)
      const isActive = index === activeMarkerIndex
      const decay = computeMarkerStyle(marker, isActive, enableTimeDecay, maxWeight)

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${decay.size}px;height:${decay.size}px;border-radius:9999px;background:${decay.color};opacity:${decay.opacity};border:3px solid rgba(255,255,255,0.95);box-shadow:0 0 0 ${Math.max(6, decay.size / 2)}px rgba(245,158,11,0.16),0 2px 8px rgba(0,0,0,0.18);transition:all 0.2s;"></div>`,
        iconSize: [decay.size, decay.size],
        iconAnchor: [decay.size / 2, decay.size / 2],
      })

      const leafletMarker = L.marker(point, { icon }).addTo(layer)
      if (marker.label) {
        const popupLabel = document.createElement("span")
        popupLabel.textContent = marker.label
        leafletMarker.bindPopup(popupLabel)
      }
      bounds.extend(point)
    }

    try {
      if (markers.length === 1) {
        map.setView(bounds.getCenter(), 14)
      } else {
        map.fitBounds(bounds.pad(0.25))
      }
    } catch {
      // Leaflet can throw during rapid theme/viewport changes after the container is detached.
    }
  }, [markers, activeMarkerIndex, enableTimeDecay, isReady])

  if (markers.length === 0) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={`${heightClassName} nature-mini-map relative z-0 w-full overflow-hidden rounded-lg border border-[#cfe3d5] bg-[#e8f1e9] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[#274d37] dark:bg-[#0b1710] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
    />
  )
}
