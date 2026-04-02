import { MapPin, LocateFixed } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DomesticMapPicker } from "@/components/features/bird-observation/domestic-map-picker"
import { birdObservationLocationPresets } from "@/lib/bird-observation-content"

type LocationPreset = (typeof birdObservationLocationPresets)[number]

interface ObservationSubmitLocationSectionProps {
  observedAt: string
  onObservedAtChange: (v: string) => void
  locationName: string
  onLocationNameChange: (v: string) => void
  locationQuery: string
  onLocationQueryChange: (v: string) => void
  latitude: string
  longitude: string
  onLatitudeChange: (v: string) => void
  onLongitudeChange: (v: string) => void
  isLocating: boolean
  onUseCurrentLocation: () => void
  onMapPositionChange: (coords: { latitude: string; longitude: string }) => void
  onLocationNameSuggestion: (name: string) => void
  onSelectPreset: (location: LocationPreset) => void
  presetButtons: LocationPreset[]
}

export function ObservationSubmitLocationSection({
  observedAt,
  onObservedAtChange,
  locationName,
  onLocationNameChange,
  locationQuery,
  onLocationQueryChange,
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
  isLocating,
  onUseCurrentLocation,
  onMapPositionChange,
  onLocationNameSuggestion,
  onSelectPreset,
  presetButtons,
}: ObservationSubmitLocationSectionProps) {
  return (
    <section className="surface-subtle p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          3
        </div>
        <div>
          <h2 className="text-lg font-semibold">再确认位置和时间</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            一条观察记录最重要的是说明“什么时间、在哪个位置看到了它”，所以这里需要把时间和定位补完整。
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="locationName">观察地点</Label>
          <Input
            id="locationName"
            value={locationName}
            onChange={(e) => onLocationNameChange(e.target.value)}
            placeholder="例如：奥林匹克森林公园南园湿地"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="observedAt">观察时间</Label>
          <Input id="observedAt" type="datetime-local" value={observedAt} onChange={(e) => onObservedAtChange(e.target.value)} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>定位信息</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onUseCurrentLocation} disabled={isLocating}>
              <LocateFixed className="mr-2 h-4 w-4" />
              {isLocating ? "定位中..." : "使用当前位置"}
            </Button>
            {latitude && longitude && (
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                已记录经纬度
              </span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={latitude} onChange={(e) => onLatitudeChange(e.target.value)} placeholder="纬度，例如 40.0095" />
            <Input value={longitude} onChange={(e) => onLongitudeChange(e.target.value)} placeholder="经度，例如 116.3962" />
          </div>
          <div className="space-y-2">
            <Label>快速地点</Label>
            <Input
              value={locationQuery}
              onChange={(e) => onLocationQueryChange(e.target.value)}
              placeholder="搜索推荐观察点，例如：北海、公园、校园"
            />
            <div className="flex flex-wrap gap-2">
              {presetButtons.slice(0, 5).map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => onSelectPreset(location)}
                  className="rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-muted"
                >
                  {location.name}
                </button>
              ))}
            </div>
          </div>
          <DomesticMapPicker
            latitude={latitude}
            longitude={longitude}
            onChange={onMapPositionChange}
            onLocationNameSuggestion={onLocationNameSuggestion}
          />
        </div>
      </div>
    </section>
  )
}
