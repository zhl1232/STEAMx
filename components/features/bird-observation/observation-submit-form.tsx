"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, MapPin, LocateFixed } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "@/components/ui/image-upload"
import { DomesticMapPicker } from "@/components/features/bird-observation/domestic-map-picker"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { useToast } from "@/hooks/use-toast"
import { birdObservationLocationPresets } from "@/lib/bird-observation-content"
import { reverseGeocode } from "@/lib/reverse-geocode"

interface SpeciesOption {
  id: number
  commonName: string
  scientificName?: string | null
}

interface ObservationSubmitFormProps {
  speciesOptions: SpeciesOption[]
  defaultProjectId?: number | null
  defaultChallengeId?: number | null
  defaultProjectTitle?: string | null
  defaultChallengeTitle?: string | null
  defaultSpeciesId?: number | null
}

interface SpeciesEntryFormState {
  speciesId: string
  count: string
  behaviorTags: string
  notes: string
}

const emptySpeciesEntry = (): SpeciesEntryFormState => ({
  speciesId: "",
  count: "",
  behaviorTags: "",
  notes: "",
})

export function ObservationSubmitForm({
  speciesOptions,
  defaultProjectId = null,
  defaultChallengeId = null,
  defaultProjectTitle = null,
  defaultChallengeTitle = null,
  defaultSpeciesId = null,
}: ObservationSubmitFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [evidenceImage, setEvidenceImage] = useState<string | null>(null)
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [locationName, setLocationName] = useState("")
  const [locationQuery, setLocationQuery] = useState("")
  const [locationPrecision, setLocationPrecision] = useState("approximate")
  const [habitat, setHabitat] = useState("")
  const [weather, setWeather] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [notes, setNotes] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [speciesEntries, setSpeciesEntries] = useState<SpeciesEntryFormState[]>([
    defaultSpeciesId ? { ...emptySpeciesEntry(), speciesId: String(defaultSpeciesId) } : emptySpeciesEntry(),
  ])

  const selectedSpeciesIds = useMemo(
    () => new Set(speciesEntries.map((entry) => entry.speciesId).filter(Boolean)),
    [speciesEntries],
  )
  const filteredLocationPresets = useMemo(() => {
    const query = locationQuery.trim().toLowerCase()
    if (!query) return birdObservationLocationPresets
    return birdObservationLocationPresets.filter((location) =>
      `${location.name} ${location.description}`.toLowerCase().includes(query),
    )
  }, [locationQuery])

  const updateSpeciesEntry = (index: number, field: keyof SpeciesEntryFormState, value: string) => {
    setSpeciesEntries((current) => {
      const next = [...current]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addSpeciesEntry = () => {
    setSpeciesEntries((current) => [...current, emptySpeciesEntry()])
  }

  const removeSpeciesEntry = (index: number) => {
    setSpeciesEntries((current) => (current.length === 1 ? current : current.filter((_, idx) => idx !== index)))
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "当前设备不支持定位", variant: "destructive" })
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setLatitude(String(lat))
        setLongitude(String(lng))
        setLocationPrecision("exact")

        if (!locationName.trim()) {
          const name = await reverseGeocode(lat, lng)
          if (name) setLocationName(name)
        }

        setIsLocating(false)
        toast({ title: "已获取当前位置" })
      },
      () => {
        setIsLocating(false)
        toast({ title: "定位失败", description: "请检查定位权限，或手动填写经纬度。", variant: "destructive" })
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleMapPositionChange = (coords: { latitude: string; longitude: string }) => {
    setLatitude(coords.latitude)
    setLongitude(coords.longitude)
  }

  const handleLocationNameSuggestion = (name: string) => {
    if (!locationName.trim()) {
      setLocationName(name)
    }
  }

  const handleSelectPresetLocation = (location: (typeof birdObservationLocationPresets)[number]) => {
    setLocationName(location.name)
    setLatitude(location.latitude.toFixed(6))
    setLongitude(location.longitude.toFixed(6))
    setLocationPrecision("approximate")
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      promptLogin(undefined, {
        title: "登录以上传观察记录",
        description: "登录后即可提交你的鸟类观察记录",
      })
      return
    }

    const normalizedSpeciesEntries = speciesEntries
      .filter((entry) => entry.speciesId)
      .map((entry) => ({
        species_id: Number(entry.speciesId),
        count: entry.count ? Number(entry.count) : null,
        behavior_tags: entry.behaviorTags
          .split(/[，,]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: entry.notes.trim() || null,
      }))

    if (!locationName.trim()) {
      toast({ title: "请填写观察地点", variant: "destructive" })
      return
    }

    if (!latitude.trim() || !longitude.trim()) {
      toast({ title: "请提供定位信息", description: "请使用当前位置、地图选点，或手动填写经纬度。", variant: "destructive" })
      return
    }

    if (normalizedSpeciesEntries.length === 0) {
      toast({ title: "请至少填写一个物种", variant: "destructive" })
      return
    }

    if (!evidenceImage) {
      toast({ title: "请上传一张照片", description: "每条观察记录至少需要一张照片。", variant: "destructive" })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: defaultProjectId,
          challenge_id: defaultChallengeId,
          observed_at: new Date(observedAt).toISOString(),
          location_name: locationName.trim(),
          location_precision: locationPrecision,
          habitat: habitat.trim() || null,
          weather: weather.trim() || null,
          latitude: Number(latitude),
          longitude: Number(longitude),
          notes: notes.trim() || null,
          media_urls: [evidenceImage],
          is_public: isPublic,
          species_entries: normalizedSpeciesEntries,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "提交失败")
      }

      toast({ title: "观察记录已提交", description: "接下来可以去看物种页、回到任务，或继续记录下一条观察。" })
      router.push(`/bird-observation/submitted/${payload.observation.id}`)
      router.refresh()
    } catch (error) {
      toast({
        title: "提交失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {(defaultProjectTitle || defaultChallengeTitle) && (
        <section className="rounded-2xl border bg-muted/20 p-5">
          <h2 className="text-lg font-semibold">已关联上下文</h2>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {defaultProjectTitle && <p>项目：{defaultProjectTitle}</p>}
            {defaultChallengeTitle && <p>挑战：{defaultChallengeTitle}</p>}
          </div>
        </section>
      )}

      <section className="rounded-2xl border p-5">
        <div className="flex items-start gap-3">
          <div className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            1
          </div>
          <div>
            <h2 className="text-lg font-semibold">先上传观察照片</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              每条记录至少需要一张照片，方便后续核对物种和行为。先把照片放上来，再补物种和位置。
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <ImageUpload
            value={evidenceImage}
            onChange={setEvidenceImage}
            pathPrefix="observations"
            placeholder="上传观察照片"
          />
        </div>
      </section>

      <section className="rounded-2xl border p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              2
            </div>
            <div>
              <h2 className="text-lg font-semibold">再选择物种</h2>
              <p className="mt-1 text-sm text-muted-foreground">先填一个物种就能提交，之后再补更多细节。</p>
            </div>
          </div>
          {showAdvancedFields && (
            <Button type="button" variant="outline" onClick={addSpeciesEntry}>
              新增物种
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-4">
          {speciesEntries.map((entry, index) => (
            <div key={index} className="rounded-2xl border bg-muted/20 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>物种</Label>
                  <select
                    value={entry.speciesId}
                    onChange={(e) => updateSpeciesEntry(index, "speciesId", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">请选择物种</option>
                    {speciesOptions.map((option) => {
                      const disabled = selectedSpeciesIds.has(String(option.id)) && entry.speciesId !== String(option.id)
                      return (
                        <option key={option.id} value={option.id} disabled={disabled}>
                          {option.commonName}{option.scientificName ? ` / ${option.scientificName}` : ""}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>数量</Label>
                  <Input value={entry.count} onChange={(e) => updateSpeciesEntry(index, "count", e.target.value)} placeholder="可选，例如 3" />
                </div>

                {showAdvancedFields && (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <Label>行为标签</Label>
                      <Input
                        value={entry.behaviorTags}
                        onChange={(e) => updateSpeciesEntry(index, "behaviorTags", e.target.value)}
                        placeholder="例如：觅食, 梳羽, 潜水"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>补充说明</Label>
                      <Textarea
                        value={entry.notes}
                        onChange={(e) => updateSpeciesEntry(index, "notes", e.target.value)}
                        placeholder="可选，补充这一物种的观察情况"
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </div>

              {showAdvancedFields && speciesEntries.length > 1 && (
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="ghost" onClick={() => removeSpeciesEntry(index)}>
                    删除这一物种
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border p-5">
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
            <Input id="locationName" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="例如：奥林匹克森林公园南园湿地" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observedAt">观察时间</Label>
            <Input id="observedAt" type="datetime-local" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>定位信息</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleUseCurrentLocation} disabled={isLocating}>
                <LocateFixed className="mr-2 h-4 w-4" />
                {isLocating ? "定位中..." : "使用当前位置"}
              </Button>
              {(latitude && longitude) && (
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  已记录经纬度
                </span>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="纬度，例如 40.0095" />
              <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="经度，例如 116.3962" />
            </div>
            <div className="space-y-2">
              <Label>快速地点</Label>
              <Input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="搜索推荐观察点，例如：北海、公园、校园"
              />
              <div className="flex flex-wrap gap-2">
                {filteredLocationPresets.slice(0, 5).map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => handleSelectPresetLocation(location)}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs text-foreground hover:border-primary/50 hover:bg-muted"
                  >
                    {location.name}
                  </button>
                ))}
              </div>
            </div>
            <DomesticMapPicker
              latitude={latitude}
              longitude={longitude}
              onChange={handleMapPositionChange}
              onLocationNameSuggestion={handleLocationNameSuggestion}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-5">
        <div className="flex items-start gap-3">
          <div className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            4
          </div>
          <div>
            <h2 className="text-lg font-semibold">最后写下看到的情况</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              这不是长报告，用一两句话写清你看到了什么就可以。
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例如：湖边看到 3 只绿头鸭在觅食和梳羽。"
            rows={3}
          />
        </div>
      </section>

      <section className="rounded-2xl border p-5">
        <button
          type="button"
          onClick={() => setShowAdvancedFields((value) => !value)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
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
                <Input id="habitat" value={habitat} onChange={(e) => setHabitat(e.target.value)} placeholder="例如：城市湿地、校园绿地、公园湖区" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weather">天气</Label>
                <Input id="weather" value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="例如：晴、多云、小雨" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="locationPrecision">位置精度</Label>
                <select
                  id="locationPrecision"
                  value={locationPrecision}
                  onChange={(e) => setLocationPrecision(e.target.value)}
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
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              公开这条观察记录
            </label>
          </div>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "提交中..." : "提交观察记录"}
        </Button>
      </div>
    </form>
  )
}
