"use client"

import { Loader2, MapPin, Navigation } from "lucide-react"

import { DomesticMapPicker } from "@/components/features/bird-observation/domestic-map-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PlaceSearchResult } from "@/lib/reverse-geocode"
import { cn } from "@/lib/utils"

interface ObservationLocationPickerProps {
  locationName: string
  latitude: string
  longitude: string
  placeResults: PlaceSearchResult[]
  placeSearchUnavailable: boolean
  isSearchingPlaces: boolean
  isLocating: boolean
  metadataWarning?: string
  onLocationInput: (value: string) => void
  onPlaceSelect: (place: PlaceSearchResult) => void
  onMapChange: (coords: { latitude: string; longitude: string }) => void
  onLocationNameSuggestion: (name: string) => void
  onUseCurrentLocation: () => void
  controlClassName: string
}

export function ObservationLocationPicker({
  locationName,
  latitude,
  longitude,
  placeResults,
  placeSearchUnavailable,
  isSearchingPlaces,
  isLocating,
  metadataWarning,
  onLocationInput,
  onPlaceSelect,
  onMapChange,
  onLocationNameSuggestion,
  onUseCurrentLocation,
  controlClassName,
}: ObservationLocationPickerProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.88fr)_minmax(320px,1.12fr)] lg:items-start">
        <div className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="locationName" className="text-sm font-medium text-(--obs-text)">
              观察地点
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--obs-muted-2)" />
              <Input
                id="locationName"
                value={locationName}
                onChange={(event) => onLocationInput(event.target.value)}
                placeholder="搜索地点，或手动填写名称"
                className={cn(controlClassName, "pl-10 pr-10")}
                autoComplete="off"
              />
              {isSearchingPlaces ? (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-(--obs-muted-2)" />
              ) : null}
            </div>
            {placeResults.length > 0 ? (
              <div className="overflow-hidden rounded-xs border border-(--obs-border) bg-(--obs-control)">
                {placeResults.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => onPlaceSelect(place)}
                    className="block min-h-11 w-full border-b border-(--obs-border) px-3 py-2 text-left last:border-b-0 hover:bg-(--obs-control-hover)"
                  >
                    <span className="block truncate text-sm font-medium text-(--obs-text)">{place.name}</span>
                    <span className="block truncate text-xs text-(--obs-muted)">{place.address || "地点搜索结果"}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {placeSearchUnavailable ? (
              <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">
                地点搜索暂不可用，请在地图上点选坐标并填写地点名称。
              </p>
            ) : null}
          </div>

          <p className="text-xs leading-5 text-(--obs-muted)">
            地址来自照片 GPS 或地图选点，发布后会公开准确位置。
          </p>

          {metadataWarning ? (
            <div className="rounded-xs border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-[#6d5c32] dark:bg-[#332d20] dark:text-[#f3d889]">
              {metadataWarning}
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-sm border-(--obs-accent) bg-(--obs-accent-soft) text-(--obs-accent-text) hover:bg-(--obs-accent-panel) hover:text-(--obs-accent-text)"
            onClick={onUseCurrentLocation}
            disabled={isLocating}
          >
            {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
            {isLocating ? "正在获取位置" : "使用当前位置"}
          </Button>
        </div>

        <DomesticMapPicker
          latitude={latitude}
          longitude={longitude}
          onChange={onMapChange}
          onLocationNameSuggestion={onLocationNameSuggestion}
          mapClassName="nature-mini-map h-64 rounded-xs border-(--obs-border-strong) [background:var(--obs-map-bg)] sm:h-72 lg:h-[312px]"
        />
      </div>

      <p className="text-xs leading-5 text-(--obs-muted-2)">
        点地图或拖动标记选择位置；修改名称后请重新点地图确认。
      </p>
    </div>
  )
}
