"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bird,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  PencilLine,
  Search,
  Sparkles,
  Stars,
} from "lucide-react"

import { DomesticMapPicker } from "@/components/features/bird-observation/domestic-map-picker"
import {
  ObservationSubmitPhotoSection,
  type ObservationMediaAnalysis,
} from "@/components/features/bird-observation/observation-submit-photo-section"
import { ObservationSubmitSuccessDialog } from "@/components/features/bird-observation/observation-submit-success-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { dispatchObservationCreated } from "@/lib/gamification/observation-events"
import { useGamification } from "@/lib/context/gamification-context"
import { useAuth } from "@/lib/context/auth-context"
import { reverseGeocode } from "@/lib/reverse-geocode"

export interface SpeciesOption {
  id: number
  commonName: string
  scientificName?: string | null
}

interface ObservationSubmitFormProps {
  speciesOptions: SpeciesOption[]
  isBirdTopic?: boolean
}

interface SpeciesSearchResponse {
  species?: SpeciesOption[]
}

interface ObservationMediaAnalysisResponse {
  analyses?: ObservationMediaAnalysis[]
  error?: string
}

interface SubmitRewardSummary {
  xpAwarded: number
  observationsSubmitted: number
  nextBadgeThreshold: number
}

interface SubmitResponse {
  observation: {
    id: number
  }
  rewardSummary?: SubmitRewardSummary
}

const DEFAULT_XP_REWARD = 10

function formatObservedAt(value: string) {
  if (!value) return "时间待定"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "时间待定"
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function getProgressValue(count: number, threshold: number) {
  if (threshold <= 0) return 100
  return Math.max(0, Math.min(100, (count / threshold) * 100))
}

export function ObservationSubmitForm({
  speciesOptions,
  isBirdTopic = false,
}: ObservationSubmitFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { unlockedBadges } = useGamification()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [evidenceImages, setEvidenceImages] = useState<string[]>([])
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [locationName, setLocationName] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [notes, setNotes] = useState("")
  const [speciesId, setSpeciesId] = useState("")
  const [speciesQuery, setSpeciesQuery] = useState("")
  const [speciesResults, setSpeciesResults] = useState<SpeciesOption[]>([])
  const [isSearchingSpecies, setIsSearchingSpecies] = useState(false)
  const [mediaAnalyses, setMediaAnalyses] = useState<ObservationMediaAnalysis[]>([])
  const [isAnalyzingImages, setIsAnalyzingImages] = useState(false)
  const [isLocationSheetOpen, setIsLocationSheetOpen] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationPrecision, setLocationPrecision] = useState<"exact" | "approximate" | "hidden">("approximate")
  const [successState, setSuccessState] = useState<{
    open: boolean
    observationId: number | null
    imageUrl: string | null
    speciesName: string | null
    rewardSummary: SubmitRewardSummary
  }>({
    open: false,
    observationId: null,
    imageUrl: null,
    speciesName: null,
    rewardSummary: {
      xpAwarded: DEFAULT_XP_REWARD,
      observationsSubmitted: 1,
      nextBadgeThreshold: 10,
    },
  })

  const autoLocateTriedRef = useRef(false)
  const autoLocateAfterPhotoRef = useRef(false)

  const allSpecies = useMemo(() => {
    const map = new Map<number, SpeciesOption>()
    for (const option of speciesOptions) {
      map.set(option.id, option)
    }
    return Array.from(map.values())
  }, [speciesOptions])

  const selectedSpecies = useMemo(
    () => allSpecies.find((option) => String(option.id) === speciesId) ?? null,
    [allSpecies, speciesId],
  )

  const analysisMap = useMemo(
    () => new Map(mediaAnalyses.map((item) => [item.imageUrl, item])),
    [mediaAnalyses],
  )

  const suggestedCandidates = useMemo(() => {
    const map = new Map<number, ObservationMediaAnalysis["speciesCandidates"][number]>()

    for (const analysis of mediaAnalyses) {
      for (const candidate of analysis.speciesCandidates) {
        const current = map.get(candidate.speciesId)
        if (!current || candidate.confidence > current.confidence) {
          map.set(candidate.speciesId, candidate)
        }
      }
    }

    return Array.from(map.values()).sort((left, right) => right.confidence - left.confidence)
  }, [mediaAnalyses])

  const analysisPendingCount = useMemo(
    () =>
      evidenceImages.filter((url) => {
        const status = analysisMap.get(url)?.status
        return !status || status === "pending"
      }).length,
    [analysisMap, evidenceImages],
  )

  const failedAnalysis = useMemo(
    () =>
      evidenceImages
        .map((url) => analysisMap.get(url))
        .find((analysis) => analysis && analysis.status !== "passed" && analysis.status !== "pending") ?? null,
    [analysisMap, evidenceImages],
  )

  const analysisReady = evidenceImages.length > 0 && evidenceImages.every((url) => analysisMap.get(url)?.status === "passed")
  const shouldShowSpeciesResults = speciesQuery.trim().length > 0 || suggestedCandidates.length === 0
  const speciesStepLocked = evidenceImages.length === 0
  const speciesStepStatus = selectedSpecies
    ? "已确认"
    : speciesStepLocked
      ? "待上传"
      : analysisPendingCount > 0 || isAnalyzingImages
        ? "识别中"
        : "待确认"
  const speciesStepBadgeClass = selectedSpecies
    ? "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-300"
    : speciesStepLocked
      ? "border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
      : analysisPendingCount > 0 || isAnalyzingImages
        ? "border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/25 dark:text-sky-300"
        : "border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300"

  const canSubmit = analysisReady && !!speciesId && !!locationName.trim() && !!latitude.trim() && !!longitude.trim()
  const hasFirstObservationBadge = unlockedBadges.has("first_observation")
  const heroTitle = hasFirstObservationBadge ? "发现新物种了吗？" : "再记录 1 条，即可点亮【第一次观察】"
  const heroDescription = hasFirstObservationBadge
    ? "把这一刻收进你的观察档案，继续推进观察家系列徽章。"
    : "上传一张清晰照片，确认物种和位置，你的第一枚观察徽章就会被点亮。"

  const locationSummary = locationName.trim()
    ? `📍 ${locationName.trim()} · ${formatObservedAt(observedAt)}`
    : isLocating
      ? "📍 正在静默定位 · 请稍等"
      : "📍 位置与时间将自动填充"

  const progressLabel = useMemo(() => {
    const count = successState.rewardSummary.observationsSubmitted
    const threshold = successState.rewardSummary.nextBadgeThreshold
    return `观察家进度 ${count} / ${threshold}`
  }, [successState.rewardSummary])

  const progressValue = useMemo(() => {
    return getProgressValue(
      successState.rewardSummary.observationsSubmitted,
      successState.rewardSummary.nextBadgeThreshold,
    )
  }, [successState.rewardSummary])

  const tryLocate = useCallback(async (withToast: boolean) => {
    if (!navigator.geolocation) {
      if (withToast) {
        toast({ title: "当前设备不支持定位", variant: "destructive" })
      }
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        setLatitude(lat.toFixed(6))
        setLongitude(lng.toFixed(6))
        setLocationPrecision("exact")

        try {
          const name = await reverseGeocode(lat, lng)
          if (name) {
            setLocationName(name)
          }
        } finally {
          setIsLocating(false)
        }

        if (withToast) {
          toast({ title: "已更新当前位置" })
        }
      },
      () => {
        setIsLocating(false)
        if (withToast) {
          toast({
            title: "定位失败",
            description: "请手动修改位置，或稍后重试。",
            variant: "destructive",
          })
        }
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }, [toast])

  useEffect(() => {
    if (autoLocateTriedRef.current) return
    autoLocateTriedRef.current = true
    void tryLocate(false)
  }, [tryLocate])

  useEffect(() => {
    if (evidenceImages.length === 0 || latitude || longitude || autoLocateAfterPhotoRef.current) {
      return
    }
    autoLocateAfterPhotoRef.current = true
    void tryLocate(false)
  }, [evidenceImages.length, latitude, longitude, tryLocate])

  useEffect(() => {
    if (!user || evidenceImages.length === 0) {
      setMediaAnalyses([])
      setIsAnalyzingImages(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsAnalyzingImages(true)
      try {
        const response = await fetch("/api/observations/media-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrls: evidenceImages }),
          signal: controller.signal,
        })

        const payload = (await response.json().catch(() => ({}))) as ObservationMediaAnalysisResponse
        if (!response.ok) {
          throw new Error(payload.error || "图片识别失败")
        }

        setMediaAnalyses((payload.analyses || []).filter((item) => evidenceImages.includes(item.imageUrl)))
      } catch (error) {
        if (!controller.signal.aborted) {
          toast({
            title: "图片识别失败",
            description: error instanceof Error ? error.message : "请稍后重试",
            variant: "destructive",
          })
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsAnalyzingImages(false)
        }
      }
    }, 150)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [evidenceImages, toast, user])

  useEffect(() => {
    if (selectedSpecies && speciesQuery.trim() === "") {
      setSpeciesQuery(selectedSpecies.commonName)
    }
  }, [selectedSpecies, speciesQuery])

  useEffect(() => {
    const query = speciesQuery.trim()
    if (!query) {
      setSpeciesResults(allSpecies.slice(0, 8))
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsSearchingSpecies(true)
      try {
        const res = await fetch(`/api/species?q=${encodeURIComponent(query)}&pageSize=8`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error("species search failed")
        }
        const payload = (await res.json()) as SpeciesSearchResponse
        setSpeciesResults(payload.species ?? [])
      } catch {
        if (!controller.signal.aborted) {
          const fallback = allSpecies.filter((option) => {
            const haystack = `${option.commonName} ${option.scientificName || ""}`.toLowerCase()
            return haystack.includes(query.toLowerCase())
          })
          setSpeciesResults(fallback.slice(0, 8))
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingSpecies(false)
        }
      }
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [allSpecies, speciesQuery])

  const handleSpeciesSelect = (option: SpeciesOption) => {
    setSpeciesId(String(option.id))
    setSpeciesQuery(option.commonName)
  }

  const resetForm = () => {
    setEvidenceImages([])
    setMediaAnalyses([])
    setObservedAt(new Date().toISOString().slice(0, 16))
    setLocationName("")
    setLatitude("")
    setLongitude("")
    setNotes("")
    setSpeciesId("")
    setSpeciesQuery("")
    setLocationPrecision("approximate")
    autoLocateAfterPhotoRef.current = false
    void tryLocate(false)
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

    if (!evidenceImages.length) {
      toast({ title: "先上传一张照片", variant: "destructive" })
      return
    }

    if (!analysisReady) {
      const description = failedAnalysis
        ? failedAnalysis.status === "failed_low_quality"
          ? failedAnalysis.qualityReason || "有图片不够清晰，请重拍后再提交"
          : failedAnalysis.status === "failed_unsafe"
            ? failedAnalysis.moderationReason || "有图片不适合提交观察记录"
            : failedAnalysis.status === "failed_unrecognized"
              ? "有图片暂时无法识别，请换更清晰的照片"
              : "图片识别尚未完成，请稍后再试"
        : analysisPendingCount > 0
          ? "图片识别尚未完成，请稍后再试"
          : "请先完成图片识别"
      toast({ title: "先完成图片识别", description, variant: "destructive" })
      return
    }

    if (!speciesId) {
      toast({ title: "请确认一个物种", variant: "destructive" })
      return
    }

    if (!locationName.trim() || !latitude.trim() || !longitude.trim()) {
      setIsLocationSheetOpen(true)
      toast({ title: "请确认位置与时间", description: "我们需要这条观察的地点和定位。", variant: "destructive" })
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
          habitat: null,
          weather: null,
          latitude: Number(latitude),
          longitude: Number(longitude),
          notes: notes.trim() || null,
          media_urls: evidenceImages,
          is_public: true,
          species_entries: [
            {
              species_id: Number(speciesId),
              count: null,
              behavior_tags: [],
              notes: null,
            },
          ],
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as Partial<SubmitResponse> & { error?: string }
      if (!response.ok || !payload.observation) {
        throw new Error(payload?.error || "提交失败")
      }

      const rewardSummary = payload.rewardSummary ?? {
        xpAwarded: DEFAULT_XP_REWARD,
        observationsSubmitted: 1,
        nextBadgeThreshold: 10,
      }

      dispatchObservationCreated()
      router.refresh()

      setSuccessState({
        open: true,
        observationId: payload.observation.id,
        imageUrl: evidenceImages[0] ?? null,
        speciesName: selectedSpecies?.commonName ?? null,
        rewardSummary,
      })
      resetForm()
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
    <>
      <section className="relative overflow-hidden rounded-[32px] border border-emerald-200/60 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.28),transparent_34%),linear-gradient(180deg,rgba(252,255,253,0.98),rgba(245,247,242,0.96))] p-5 shadow-[0_28px_60px_-52px_rgba(5,150,105,0.5)] dark:border-emerald-900/50 dark:bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.16),transparent_32%),linear-gradient(180deg,rgba(10,18,14,0.96),rgba(10,15,13,0.98))] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/75 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm dark:border-emerald-800/80 dark:bg-white/5 dark:text-emerald-300">
              <Stars className="h-3.5 w-3.5" />
              {isBirdTopic ? "鸟类专题记录" : "自然观察记录"}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {heroTitle}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-foreground/72 sm:text-base">
              {heroDescription}
            </p>
          </div>
          <div className="min-w-[14rem] rounded-[24px] border border-emerald-200/80 bg-white/80 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-white/5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-300/80">
              <Sparkles className="h-3.5 w-3.5" />
              本次收益
            </div>
            <div className="mt-3 text-2xl font-semibold text-foreground">+{DEFAULT_XP_REWARD} 探索经验</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              成功提交后立即计入观察家系列进度。
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="pb-40">
        <section className="mt-6 overflow-hidden rounded-[32px] border border-border/70 bg-white p-4 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.4)] dark:bg-card sm:p-5">
          <ObservationSubmitPhotoSection
            evidenceImages={evidenceImages}
            onEvidenceChange={setEvidenceImages}
            analyses={mediaAnalyses}
            isAnalyzing={isAnalyzingImages}
          />

          <div className="mt-6 space-y-6">
            <section className={`rounded-[28px] bg-stone-50/82 p-4 transition-opacity dark:bg-muted/20 sm:p-5 ${speciesStepLocked ? "opacity-85" : ""}`}>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight">确认它是谁</h2>
                  <div className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium leading-none ${speciesStepBadgeClass}`}>
                    {selectedSpecies ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : analysisPendingCount > 0 || isAnalyzingImages ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bird className="h-3.5 w-3.5" />
                    )}
                    {speciesStepStatus}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  先看图片识别候选，再确认最终物种。
                </p>
              </div>

              {analysisPendingCount > 0 ? (
                <div className="mt-4 rounded-2xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200">
                  还有 {analysisPendingCount} 张图片正在识别，完成后才可提交。
                </div>
              ) : null}

              {failedAnalysis ? (
                <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                  {failedAnalysis.status === "failed_unsafe"
                    ? failedAnalysis.moderationReason || "这张图片不适合用于自然观察提交，请更换照片。"
                    : failedAnalysis.status === "failed_low_quality"
                      ? failedAnalysis.qualityReason || "图片不够清晰，请重拍后再试。"
                      : failedAnalysis.status === "failed_unrecognized"
                        ? "暂时无法从这张图片识别出可靠鸟类候选，请换一张更清晰的照片。"
                        : "图片识别失败，请删除后重新上传。"}
                </div>
              ) : null}

              {suggestedCandidates.length > 0 ? (
                <div className="mt-4 space-y-3 rounded-[22px] border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/15">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    <Sparkles className="h-4 w-4" />
                    AI 候选
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedCandidates.map((candidate) => {
                      const active = String(candidate.speciesId) === speciesId
                      return (
                        <button
                          key={candidate.speciesId}
                          type="button"
                          onClick={() => {
                            const option = allSpecies.find((item) => item.id === candidate.speciesId)
                            if (option) handleSpeciesSelect(option)
                          }}
                          className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                            active
                              ? "border-emerald-500 bg-emerald-600 text-white"
                              : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                          }`}
                        >
                          {candidate.commonName}
                          <span className={`ml-2 text-xs ${active ? "text-emerald-50/90" : "text-emerald-700/80 dark:text-emerald-300/80"}`}>
                            {Math.round(candidate.confidence * 100)}%
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedCandidates.map((candidate) => (
                      <Badge
                        key={`${candidate.speciesId}-reason`}
                        variant="outline"
                        className="border-emerald-200/80 bg-white/80 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200"
                      >
                        {candidate.commonName}：{candidate.reason || "图片特征与该候选较接近"}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : analysisReady ? (
                <div className="mt-4 rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
                  当前图片没有匹配到可靠的本地鸟类候选。你仍可手动搜索并确认物种。
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={speciesQuery}
                    onChange={(event) => {
                      setSpeciesQuery(event.target.value)
                      if (!event.target.value.trim()) {
                        setSpeciesId("")
                      }
                    }}
                    placeholder={speciesStepLocked ? "先上传照片" : "输入物种名称"}
                    disabled={speciesStepLocked}
                    className="h-12 rounded-2xl border-border/70 bg-background pl-10 pr-10"
                  />
                  {isSearchingSpecies ? (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : null}
                </div>

                {!speciesStepLocked && shouldShowSpeciesResults ? (
                  <div className="overflow-hidden rounded-[22px] border border-border/70 bg-background">
                    {speciesResults
                      .slice(0, 6)
                      .filter((option) => !selectedSpecies || speciesQuery.trim().length > 0 || option.id !== selectedSpecies.id)
                      .map((option) => {
                        const isSelected = String(option.id) === speciesId
                        const aiCandidate = suggestedCandidates.find((candidate) => candidate.speciesId === option.id)

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleSpeciesSelect(option)}
                            className={`flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left last:border-b-0 transition-colors hover:bg-muted/45 ${
                              isSelected ? "bg-emerald-50/80 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900/50" : ""
                            }`}
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-medium text-foreground">{option.commonName}</div>
                                {aiCandidate ? (
                                  <Badge variant="outline" className="border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
                                    AI {Math.round(aiCandidate.confidence * 100)}%
                                  </Badge>
                                ) : null}
                              </div>
                              {option.scientificName ? (
                                <div className="text-xs italic text-muted-foreground">{option.scientificName}</div>
                              ) : null}
                            </div>
                            {isSelected ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                已确认
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        )
                      })}
                  </div>
                ) : (
                  !speciesStepLocked ? (
                  <div className="rounded-[22px] border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
                    当前已选中 AI 候选。若要改成别的物种，直接在上方输入名称搜索。
                  </div>
                  ) : null
                )}
              </div>
            </section>

            <section className="rounded-[28px] bg-stone-50/82 p-4 dark:bg-muted/20 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">位置与时间</h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full text-muted-foreground"
                  onClick={() => setIsLocationSheetOpen(true)}
                >
                  <PencilLine className="mr-2 h-4 w-4" />
                  修改
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setIsLocationSheetOpen(true)}
                className="mt-4 flex w-full items-center gap-3 rounded-[22px] border border-border/70 bg-background px-4 py-3 text-left transition-colors hover:bg-muted/45"
              >
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{locationSummary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {locationPrecision === "exact" ? "精确定位" : locationPrecision === "hidden" ? "隐藏精确位置" : "近似定位"}
                    {locationName.trim() && (!latitude.trim() || !longitude.trim()) ? " · 请在地图上选点以完成定位" : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </section>

            <section className="rounded-[28px] bg-stone-50/82 p-4 dark:bg-muted/20 sm:p-5">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">补一句你看到的画面</h2>
              </div>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="它当时在做什么？周围环境怎样？"
                rows={4}
                className="mt-4 rounded-[24px] border-border/70 bg-background/90 px-4 py-3 text-sm leading-6 shadow-none"
              />
            </section>
          </div>
        </section>

        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-4 pb-3 pt-6">
          <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-[28px] border border-border/70 bg-background/94 p-3 shadow-[0_-22px_50px_-28px_rgba(15,23,42,0.45)] backdrop-blur supports-[backdrop-filter]:bg-background/88">
            <div className="rounded-full bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-950/25 dark:text-emerald-300">
              ✨ 本次记录可获得 +{DEFAULT_XP_REWARD} 探索经验
            </div>
            {!canSubmit ? (
              <p className="px-2 text-center text-xs text-muted-foreground">
                还差{" "}
                {evidenceImages.length === 0
                  ? "照片"
                  : !analysisReady
                    ? "图片识别"
                    : !speciesId
                      ? "物种确认"
                      : !locationName.trim()
                        ? "位置名称"
                        : !latitude.trim() || !longitude.trim()
                          ? "地图选点"
                          : "位置与时间"}{" "}
                就能点亮图鉴。
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={isSubmitting || isAnalyzingImages || !canSubmit}
              className="h-14 rounded-[22px] text-base font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交并获取经验
                </>
              ) : (
                "点亮图鉴"
              )}
            </Button>
          </div>
        </div>
      </form>

      <Sheet open={isLocationSheetOpen} onOpenChange={setIsLocationSheetOpen}>
        <SheetContent side="bottom" className="h-[92dvh] rounded-t-[32px] px-0 pb-0 pt-0 sm:h-[88dvh]">
          <SheetHeader className="border-b border-border/70 px-5 pb-4 pt-6">
            <SheetTitle>修改观察位置</SheetTitle>
            <SheetDescription>
              主页面保持清爽，这里再补充具体的位置、时间和精度。
            </SheetDescription>
          </SheetHeader>

          <div className="grid h-[calc(92dvh-5.5rem)] gap-5 overflow-y-auto px-5 py-5 sm:h-[calc(88dvh-5.5rem)]">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="locationName" className="text-sm font-medium text-foreground">
                  观察地点
                </label>
                <Input
                  id="locationName"
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                  placeholder="例如：圆明园遗址公园福海"
                  className="h-11 rounded-2xl"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="observedAt" className="text-sm font-medium text-foreground">
                  观察时间
                </label>
                <Input
                  id="observedAt"
                  type="datetime-local"
                  value={observedAt}
                  onChange={(event) => setObservedAt(event.target.value)}
                  className="h-11 rounded-2xl"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => void tryLocate(true)} disabled={isLocating}>
                  {isLocating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      定位中...
                    </>
                  ) : (
                    "使用当前位置"
                  )}
                </Button>
                <Button
                  type="button"
                  variant={locationPrecision === "hidden" ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setLocationPrecision(locationPrecision === "hidden" ? "approximate" : "hidden")}
                >
                  {locationPrecision === "hidden" ? "已隐藏精确位置" : "隐藏精确位置"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  placeholder="纬度"
                  className="rounded-2xl"
                />
                <Input
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  placeholder="经度"
                  className="rounded-2xl"
                />
              </div>
            </div>

            <DomesticMapPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(coords) => {
                setLatitude(coords.latitude)
                setLongitude(coords.longitude)
              }}
              onLocationNameSuggestion={(name) => {
                if (!locationName.trim()) {
                  setLocationName(name)
                }
              }}
            />

            <div className="sticky bottom-0 bg-background pb-5 pt-2">
              <Button type="button" className="h-12 w-full rounded-full" onClick={() => setIsLocationSheetOpen(false)}>
                完成位置修改
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ObservationSubmitSuccessDialog
        open={successState.open}
        onOpenChange={(open) => setSuccessState((current) => ({ ...current, open }))}
        observationId={successState.observationId}
        imageUrl={successState.imageUrl}
        speciesName={successState.speciesName}
        xpAwarded={successState.rewardSummary.xpAwarded}
        progressLabel={progressLabel}
        progressValue={progressValue}
      />
    </>
  )
}
