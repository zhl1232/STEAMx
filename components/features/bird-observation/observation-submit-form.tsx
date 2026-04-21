"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { useToast } from "@/hooks/use-toast"
import { dispatchObservationCreated } from "@/lib/gamification/observation-events"
import { birdObservationLocationPresets } from "@/lib/bird-observation-content"
import { reverseGeocode } from "@/lib/reverse-geocode"

import { emptySpeciesEntry, type SpeciesEntryFormState } from "./observation-form-types"
import { ObservationSubmitAdvancedSection } from "./observation-submit-advanced-section"
import { ObservationSubmitLocationSection } from "./observation-submit-location-section"
import { ObservationSubmitNotesSection } from "./observation-submit-notes-section"
import { ObservationSubmitPhotoSection } from "./observation-submit-photo-section"
import { ObservationSubmitSpeciesSection } from "./observation-submit-species-section"

export type { SpeciesOption } from "./observation-form-types"

interface ObservationSubmitFormProps {
  speciesOptions: import("./observation-form-types").SpeciesOption[]
  defaultSpeciesId?: number | null
}

export function ObservationSubmitForm({
  speciesOptions,
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

  const [isLocating, setIsLocating] = useState(false)

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
        description: "登录后即可提交你的自然观察记录",
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

      toast({ title: "观察记录已提交", description: "接下来可以去看物种页，或继续记录下一条观察。" })
      dispatchObservationCreated()
      router.push(`/nature/submitted/${payload.observation.id}`)
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
      <ObservationSubmitPhotoSection evidenceImage={evidenceImage} onEvidenceChange={setEvidenceImage} />

      <ObservationSubmitSpeciesSection
        speciesOptions={speciesOptions}
        speciesEntries={speciesEntries}
        showAdvancedFields={showAdvancedFields}
        selectedSpeciesIds={selectedSpeciesIds}
        onUpdateEntry={updateSpeciesEntry}
        onAddSpecies={addSpeciesEntry}
        onRemoveSpecies={removeSpeciesEntry}
      />

      <ObservationSubmitLocationSection
        observedAt={observedAt}
        onObservedAtChange={setObservedAt}
        locationName={locationName}
        onLocationNameChange={setLocationName}
        locationQuery={locationQuery}
        onLocationQueryChange={setLocationQuery}
        latitude={latitude}
        longitude={longitude}
        onLatitudeChange={setLatitude}
        onLongitudeChange={setLongitude}
        isLocating={isLocating}
        onUseCurrentLocation={handleUseCurrentLocation}
        onMapPositionChange={handleMapPositionChange}
        onLocationNameSuggestion={handleLocationNameSuggestion}
        onSelectPreset={handleSelectPresetLocation}
        presetButtons={filteredLocationPresets}
      />

      <ObservationSubmitNotesSection notes={notes} onNotesChange={setNotes} />

      <ObservationSubmitAdvancedSection
        showAdvancedFields={showAdvancedFields}
        onToggleAdvanced={() => setShowAdvancedFields((value) => !value)}
        habitat={habitat}
        onHabitatChange={setHabitat}
        weather={weather}
        onWeatherChange={setWeather}
        locationPrecision={locationPrecision}
        onLocationPrecisionChange={setLocationPrecision}
        isPublic={isPublic}
        onIsPublicChange={setIsPublic}
      />

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "提交中..." : "提交观察记录"}
        </Button>
      </div>
    </form>
  )
}
