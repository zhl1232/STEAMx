"use client"

import { useEffect, useRef } from "react"

type LeafletModule = typeof import("leaflet")

interface DomesticMiniMapMarker {
  latitude: number
  longitude: number
  label?: string
  observedAt?: string
}

interface DomesticMiniMapProps {
  markers: DomesticMiniMapMarker[]
  heightClassName?: string
  activeMarkerIndex?: number
  enableTimeDecay?: boolean
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

export function DomesticMiniMap({
  markers,
  heightClassName = "h-56",
  activeMarkerIndex = -1,
  enableTimeDecay = false,
}: DomesticMiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const timeoutIdRef = useRef<number | null>(null)

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
        dragging: true,
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
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = markersLayerRef.current
    if (!L || !map || !layer || markers.length === 0) return

    layer.clearLayers()

    const bounds = L.latLngBounds([])
    for (const [index, marker] of markers.entries()) {
      const point = L.latLng(marker.latitude, marker.longitude)
      const isActive = index === activeMarkerIndex
      const decay = enableTimeDecay
        ? computeDecayStyle(marker.observedAt, isActive)
        : { size: isActive ? 18 : 14, opacity: 1, color: isActive ? "#2563eb" : "#16a34a" }

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${decay.size}px;height:${decay.size}px;border-radius:9999px;background:${decay.color};opacity:${decay.opacity};border:3px solid rgba(255,255,255,0.95);box-shadow:0 2px 8px rgba(0,0,0,0.18);transition:all 0.2s;"></div>`,
        iconSize: [decay.size, decay.size],
        iconAnchor: [decay.size / 2, decay.size / 2],
      })

      const leafletMarker = L.marker(point, { icon }).addTo(layer)
      if (marker.label) {
        leafletMarker.bindPopup(marker.label)
      }
      bounds.extend(point)
    }

    if (markers.length === 1) {
      map.setView(bounds.getCenter(), 14)
    } else {
      map.fitBounds(bounds.pad(0.25))
    }
  }, [markers, activeMarkerIndex, enableTimeDecay])

  if (markers.length === 0) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={`${heightClassName} relative z-0 w-full overflow-hidden rounded-2xl border border-border/70 bg-background/80`}
    />
  )
}
