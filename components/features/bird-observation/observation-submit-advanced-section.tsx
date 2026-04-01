import { ChevronDown, ChevronUp } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ObservationSubmitAdvancedSectionProps {
  showAdvancedFields: boolean
  onToggleAdvanced: () => void
  habitat: string
  onHabitatChange: (v: string) => void
  weather: string
  onWeatherChange: (v: string) => void
  locationPrecision: string
  onLocationPrecisionChange: (v: string) => void
  isPublic: boolean
  onIsPublicChange: (v: boolean) => void
}

export function ObservationSubmitAdvancedSection({
  showAdvancedFields,
  onToggleAdvanced,
  habitat,
  onHabitatChange,
  weather,
  onWeatherChange,
  locationPrecision,
  onLocationPrecisionChange,
  isPublic,
  onIsPublicChange,
}: ObservationSubmitAdvancedSectionProps) {
  return (
    <section className="rounded-2xl border p-5">
      <button type="button" onClick={onToggleAdvanced} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <h2 className="text-lg font-semibold">补充更多细节</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            行为标签、环境、天气、位置精度、公开设置都可以后补，不影响你先完成第一条记录。
          </p>
        </div>
        {showAdvancedFields ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>

      {showAdvancedFields && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="habitat">环境类型</Label>
              <Input
                id="habitat"
                value={habitat}
                onChange={(e) => onHabitatChange(e.target.value)}
                placeholder="例如：城市湿地、校园绿地、公园湖区"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weather">天气</Label>
              <Input id="weather" value={weather} onChange={(e) => onWeatherChange(e.target.value)} placeholder="例如：晴、多云、小雨" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="locationPrecision">位置精度</Label>
              <select
                id="locationPrecision"
                value={locationPrecision}
                onChange={(e) => onLocationPrecisionChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="exact">精确</option>
                <option value="approximate">近似</option>
                <option value="hidden">隐藏精确位置</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => onIsPublicChange(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            公开这条观察记录
          </label>
        </div>
      )}
    </section>
  )
}
