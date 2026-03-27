"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { reverseGeocode } from "@/lib/reverse-geocode"

type LeafletModule = typeof import("leaflet")

interface DomesticMapPickerProps {
  latitude: string
  longitude: string
  onChange: (coords: { latitude: string; longitude: string }) => void
  onLocationNameSuggestion?: (name: string) => void
}

export function DomesticMapPicker({ latitude, longitude, onChange, onLocationNameSuggestion }: DomesticMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const markerRef = useRef<import("leaflet").Marker | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const geocodeAbortRef = useRef<AbortController | null>(null)

  const doReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      if (!onLocationNameSuggestion) return

      geocodeAbortRef.current?.abort()
      const controller = new AbortController()
      geocodeAbortRef.current = controller

      setIsGeocoding(true)
      try {
        const name = await reverseGeocode(lat, lng, controller.signal)
        if (name && !controller.signal.aborted) {
          onLocationNameSuggestion(name)
        }
      } finally {
        if (!controller.signal.aborted) setIsGeocoding(false)
      }
    },
    [onLocationNameSuggestion],
  )

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      if (!containerRef.current || mapRef.current) return
      const L = await import("leaflet")

      if (!isMounted || !containerRef.current) return

      leafletRef.current = L
      const initialLat = latitude ? Number(latitude) : 39.9042
      const initialLng = longitude ? Number(longitude) : 116.4074

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([initialLat, initialLng], latitude && longitude ? 14 : 11)

      L.control.zoom({ position: "bottomright" }).addTo(map)

      L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}", {
        subdomains: ["1", "2", "3", "4"],
        maxZoom: 18,
        minZoom: 3,
        attribution: "高德地图",
      }).addTo(map)

      const pinIcon = L.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:grab;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
      const marker = L.marker([initialLat, initialLng], { draggable: true, icon: pinIcon }).addTo(map)

      marker.on("dragend", () => {
        const point = marker.getLatLng()
        const lat = point.lat.toFixed(6)
        const lng = point.lng.toFixed(6)
        onChange({ latitude: lat, longitude: lng })
        doReverseGeocode(point.lat, point.lng)
      })

      map.on("click", (event) => {
        marker.setLatLng(event.latlng)
        const lat = event.latlng.lat.toFixed(6)
        const lng = event.latlng.lng.toFixed(6)
        onChange({ latitude: lat, longitude: lng })
        doReverseGeocode(event.latlng.lat, event.latlng.lng)
      })

      mapRef.current = map
      markerRef.current = marker
      setIsReady(true)
    }

    init()

    return () => {
      isMounted = false
      geocodeAbortRef.current?.abort()
      markerRef.current?.remove()
      mapRef.current?.remove()
      markerRef.current = null
      mapRef.current = null
    }
  }, [latitude, longitude, onChange, doReverseGeocode])

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !leafletRef.current || !latitude || !longitude) return

    const nextLat = Number(latitude)
    const nextLng = Number(longitude)
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return

    const nextPoint = leafletRef.current.latLng(nextLat, nextLng)
    markerRef.current.setLatLng(nextPoint)
    mapRef.current.setView(nextPoint, Math.max(mapRef.current.getZoom(), 14))
  }, [latitude, longitude])

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-2xl border bg-muted/20"
      />
      <p className="text-xs text-muted-foreground">
        点击地图或拖动标记选点，选点后会自动识别地点名称。
        {!isReady && " 地图加载中..."}
        {isGeocoding && " 正在识别地点名称..."}
      </p>
    </div>
  )
}
