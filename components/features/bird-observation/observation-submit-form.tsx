"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bird,
  CalendarDays,
  Camera,
  ChevronDown,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  Eye,
  Gift,
  Globe2,
  HelpCircle,
  Info,
  ListChecks,
  Loader2,
  MapPin,
  Navigation,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
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
import { OptimizedImage } from "@/components/ui/optimized-image"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { dispatchObservationCreated } from "@/lib/gamification/observation-events"
import { useGamification } from "@/lib/context/gamification-context"
import { useAuth } from "@/lib/context/auth-context"
import { reverseGeocode } from "@/lib/reverse-geocode"
import { cn } from "@/lib/utils"

export interface SpeciesOption {
  id: number
  commonName: string
  scientificName?: string | null
}

interface ObservationSubmitFormProps {
  speciesOptions: SpeciesOption[]
  isBirdTopic?: boolean
  initialSpeciesId?: number | null
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
const NOTE_MAX_LENGTH = 500
const OBSERVATION_DRAFT_KEY = "steam:nature-observation-draft"
const OBSERVATION_DRAFT_VERSION = 1
const OBSERVER_THRESHOLDS = [1, 10, 30, 100]
const LOCATION_PRECISION_VALUES = ["exact", "approximate", "hidden"] as const
const MEDIA_ANALYSIS_STATUS_VALUES = [
  "pending",
  "passed",
  "failed_unsafe",
  "failed_low_quality",
  "failed_unrecognized",
  "error",
] as const
const MEDIA_ANALYSIS_FINAL_STATUSES = new Set<ObservationMediaAnalysis["status"]>([
  "passed",
  "failed_unsafe",
  "failed_low_quality",
  "failed_unrecognized",
  "error",
])

type LocationPrecision = (typeof LOCATION_PRECISION_VALUES)[number]
type StepStatusTone = "neutral" | "success" | "warning" | "loading"
type MobilePanelKey = "photo" | "species" | "location" | "notes"
type SpeciesCandidate = ObservationMediaAnalysis["speciesCandidates"][number]

interface SubmitBlocker {
  panel: MobilePanelKey
  label: string
  title: string
  description?: string
}

interface ObservationDraft {
  evidenceImages: string[]
  observedAt: string
  locationName: string
  latitude: string
  longitude: string
  notes: string
  speciesId: string
  speciesQuery: string
  mediaAnalyses: ObservationMediaAnalysis[]
  locationPrecision: LocationPrecision
  isPublic: boolean
}

const panelClass =
  "scroll-mt-28 scroll-mb-64 rounded-lg border border-[var(--obs-border)] bg-[var(--obs-panel)] p-4 [box-shadow:var(--obs-panel-shadow)] ring-1 ring-[var(--obs-ring)] sm:p-5 md:scroll-mt-24 md:scroll-mb-24"
const subtlePanelClass =
  "rounded-lg border border-[var(--obs-border)] bg-[var(--obs-subtle)] p-4"
const controlClass =
  "h-11 rounded-lg border-[var(--obs-border-strong)] bg-[var(--obs-control)] text-[var(--obs-text)] shadow-none placeholder:text-[var(--obs-placeholder)] transition-colors focus:!border-[var(--obs-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--obs-focus)] focus:ring-offset-0 focus-visible:!border-[var(--obs-accent)] focus-visible:ring-[var(--obs-focus)] focus-visible:ring-offset-0"
const textareaClass =
  "rounded-lg border-[var(--obs-border-strong)] bg-[var(--obs-control)] px-4 py-3 text-sm leading-6 text-[var(--obs-text)] shadow-none placeholder:text-[var(--obs-placeholder)] transition-colors focus:!border-[var(--obs-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--obs-focus)] focus:ring-offset-0 focus-visible:!border-[var(--obs-accent)] focus-visible:ring-[var(--obs-focus)] focus-visible:ring-offset-0"
const stepStatusClassNames: Record<StepStatusTone, string> = {
  neutral: "border-[var(--obs-border-strong)] bg-[var(--obs-control)] text-[var(--obs-muted)]",
  success: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-[#3f6b50] dark:bg-[#20352a] dark:text-[#c8efd2]",
  warning: "border-amber-300 bg-amber-50 text-amber-700 dark:border-[#6d5c32] dark:bg-[#332d20] dark:text-[#f3d889]",
  loading: "border-sky-300 bg-sky-50 text-sky-700 dark:border-[#365875] dark:bg-[#1d2e3a] dark:text-[#c7dceb]",
}

interface StepHeaderProps {
  index: number
  title: string
  description?: string
  icon: LucideIcon
  status?: string
  statusTone?: StepStatusTone
  action?: React.ReactNode
}

function StepHeader({
  index,
  title,
  description,
  icon: Icon,
  status,
  statusTone = "neutral",
  action,
}: StepHeaderProps) {
  const statusClass = stepStatusClassNames[statusTone]

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--obs-accent)] text-sm font-bold text-white [box-shadow:var(--obs-soft-shadow)]">
          {index}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--obs-text)]">{title}</h2>
            <Icon className="h-4 w-4 text-[var(--obs-accent)]" />
          </div>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--obs-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {status ? (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", statusClass)}>
            {statusTone === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {status}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  )
}

interface MobileAccordionHeaderProps {
  index: number
  title: string
  icon: LucideIcon
  status?: string
  statusTone?: StepStatusTone
  summary?: string
  open: boolean
  onToggle: () => void
}

function MobileAccordionHeader({
  index,
  title,
  icon: Icon,
  status,
  statusTone = "neutral",
  summary,
  open,
  onToggle,
}: MobileAccordionHeaderProps) {
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--obs-accent)] text-xs font-bold text-white [box-shadow:var(--obs-soft-shadow)]">
            {index}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-base font-semibold text-[var(--obs-text)]">{title}</span>
              <Icon className="h-4 w-4 shrink-0 text-[var(--obs-accent)]" />
            </span>
            {summary ? (
              <span className="mt-1 block truncate text-xs leading-5 text-[var(--obs-muted)]">{summary}</span>
            ) : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {status ? (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium", stepStatusClassNames[statusTone])}>
              {statusTone === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {status}
            </span>
          ) : null}
          <ChevronDown className={cn("mt-1 h-4 w-4 text-[var(--obs-muted-2)] transition-transform", open && "rotate-180")} />
        </span>
      </button>
    </div>
  )
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--obs-text)]">
      {children}
    </label>
  )
}

function QualityRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
          done ? "border-emerald-500 bg-[var(--obs-accent)] text-white" : "border-[var(--obs-border-strong)] bg-[var(--obs-control)] text-[var(--obs-muted-2)]",
        )}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5 fill-current" />}
      </span>
      <span className={done ? "text-[var(--obs-text)]" : "text-[var(--obs-muted-2)]"}>{label}</span>
    </div>
  )
}

function PrecisionButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-lg border px-3 py-2 text-center text-sm transition",
        active
          ? "border-[var(--obs-accent)] bg-[var(--obs-accent-soft)] text-[var(--obs-accent-text)] [box-shadow:var(--obs-soft-shadow)]"
          : "border-[var(--obs-border)] bg-[var(--obs-control)] text-[var(--obs-muted)] hover:border-[var(--obs-accent)] hover:text-[var(--obs-text)]",
      )}
    >
      <span className="block font-semibold">{label}</span>
      <span className="mt-0.5 block text-xs opacity-75">{description}</span>
    </button>
  )
}

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

function getNextObserverThreshold(count: number) {
  return OBSERVER_THRESHOLDS.find((threshold) => count < threshold) ?? OBSERVER_THRESHOLDS[OBSERVER_THRESHOLDS.length - 1]
}

function buildAiNoteSuggestion(analyses: ObservationMediaAnalysis[]) {
  const seen = new Set<string>()
  const suggestions: string[] = []

  for (const analysis of analyses) {
    if (analysis.status !== "passed") continue
    const suggestion = analysis.noteSuggestion?.trim()
    if (!suggestion || seen.has(suggestion)) continue

    seen.add(suggestion)
    suggestions.push(suggestion)
  }

  return suggestions.slice(0, 2).join("\n").slice(0, NOTE_MAX_LENGTH)
}

function isLocationPrecision(value: unknown): value is LocationPrecision {
  return LOCATION_PRECISION_VALUES.includes(value as LocationPrecision)
}

function isMediaAnalysisStatus(value: unknown): value is ObservationMediaAnalysis["status"] {
  return MEDIA_ANALYSIS_STATUS_VALUES.includes(value as ObservationMediaAnalysis["status"])
}

function normalizeDraftString(value: unknown, maxLength?: number) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value !== "string") return ""
  const normalized = value.trim()
  return maxLength ? normalized.slice(0, maxLength) : normalized
}

function normalizeNullableString(value: unknown, maxLength?: number) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized) return null
  return maxLength ? normalized.slice(0, maxLength) : normalized
}

function normalizeNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null
}

function normalizeMediaAnalysis(value: unknown, allowedImageUrls: Set<string>): ObservationMediaAnalysis | null {
  if (!value || typeof value !== "object") return null

  const row = value as Record<string, unknown>
  const imageUrl = normalizeDraftString(row.imageUrl)
  if (!imageUrl || !allowedImageUrls.has(imageUrl) || !isMediaAnalysisStatus(row.status)) {
    return null
  }

  const speciesCandidates: ObservationMediaAnalysis["speciesCandidates"] = []

  if (Array.isArray(row.speciesCandidates)) {
    for (const candidate of row.speciesCandidates) {
      if (!candidate || typeof candidate !== "object") continue
      const item = candidate as Record<string, unknown>
      if (typeof item.speciesId !== "number" || typeof item.commonName !== "string" || typeof item.confidence !== "number") {
        continue
      }

      speciesCandidates.push({
        speciesId: item.speciesId,
        commonName: item.commonName,
        scientificName: typeof item.scientificName === "string" ? item.scientificName : null,
        confidence: item.confidence,
        reason: typeof item.reason === "string" ? item.reason : null,
      })
    }
  }

  return {
    imageUrl,
    status: row.status,
    moderationPass: normalizeNullableBoolean(row.moderationPass),
    moderationReason: normalizeNullableString(row.moderationReason, 200),
    qualityPass: normalizeNullableBoolean(row.qualityPass),
    qualityReason: normalizeNullableString(row.qualityReason, 200),
    noteSuggestion: normalizeNullableString(row.noteSuggestion, NOTE_MAX_LENGTH),
    speciesCandidates,
  }
}

function shouldAnalyzeImage(analysis: ObservationMediaAnalysis | undefined) {
  if (!analysis) return true
  return !MEDIA_ANALYSIS_FINAL_STATUSES.has(analysis.status)
}

function normalizeObservationDraft(value: unknown): ObservationDraft | null {
  if (!value || typeof value !== "object") return null

  const draft = value as Partial<Record<keyof ObservationDraft, unknown>>
  const evidenceImages = Array.isArray(draft.evidenceImages)
    ? draft.evidenceImages.filter((url): url is string => typeof url === "string" && url.trim().length > 0).slice(0, 10)
    : []
  const allowedImageUrls = new Set(evidenceImages)
  const mediaAnalyses = Array.isArray(draft.mediaAnalyses)
    ? draft.mediaAnalyses
        .map((analysis) => normalizeMediaAnalysis(analysis, allowedImageUrls))
        .filter((analysis): analysis is ObservationMediaAnalysis => Boolean(analysis))
    : []
  const observedAt = normalizeDraftString(draft.observedAt)
  const locationName = normalizeDraftString(draft.locationName)
  const latitude = normalizeDraftString(draft.latitude)
  const longitude = normalizeDraftString(draft.longitude)
  const notes = normalizeDraftString(draft.notes, NOTE_MAX_LENGTH)
  const speciesId = normalizeDraftString(draft.speciesId)
  const speciesQuery = normalizeDraftString(draft.speciesQuery)
  const locationPrecision = isLocationPrecision(draft.locationPrecision) ? draft.locationPrecision : "approximate"
  const isPublic = typeof draft.isPublic === "boolean" ? draft.isPublic : true

  const hasContent =
    evidenceImages.length > 0 ||
    Boolean(observedAt || locationName || latitude || longitude || notes || speciesId || speciesQuery) ||
    locationPrecision !== "approximate" ||
    !isPublic

  if (!hasContent) return null

  return {
    evidenceImages,
    observedAt,
    locationName,
    latitude,
    longitude,
    notes,
    speciesId,
    speciesQuery,
    mediaAnalyses,
    locationPrecision,
    isPublic,
  }
}

export function ObservationSubmitForm({
  speciesOptions,
  isBirdTopic = false,
  initialSpeciesId = null,
}: ObservationSubmitFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { userStats } = useGamification()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [evidenceImages, setEvidenceImages] = useState<string[]>([])
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [locationName, setLocationName] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [notes, setNotes] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [speciesId, setSpeciesId] = useState(() => (initialSpeciesId ? String(initialSpeciesId) : ""))
  const [speciesQuery, setSpeciesQuery] = useState("")
  const [speciesResults, setSpeciesResults] = useState<SpeciesOption[]>([])
  const [isSearchingSpecies, setIsSearchingSpecies] = useState(false)
  const [mediaAnalyses, setMediaAnalyses] = useState<ObservationMediaAnalysis[]>([])
  const [isAnalyzingImages, setIsAnalyzingImages] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationPrecision, setLocationPrecision] = useState<LocationPrecision>("approximate")
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanelKey>("photo")
  const [speciesSheetOpen, setSpeciesSheetOpen] = useState(false)
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)
  const [tipsSheetOpen, setTipsSheetOpen] = useState(false)
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
  const draftRestoreTriedRef = useRef(false)
  const draftRestoredSpeciesRef = useRef(false)
  const pendingAnalysisImageUrlsRef = useRef(new Set<string>())
  const photoSectionRef = useRef<HTMLElement | null>(null)
  const speciesSectionRef = useRef<HTMLElement | null>(null)
  const locationSectionRef = useRef<HTMLElement | null>(null)
  const notesSectionRef = useRef<HTMLElement | null>(null)
  const mobileSectionRefs = {
    photo: photoSectionRef,
    species: speciesSectionRef,
    location: locationSectionRef,
    notes: notesSectionRef,
  }
  const mobilePanels: Record<MobilePanelKey, boolean> = {
    photo: activeMobilePanel === "photo",
    species: activeMobilePanel === "species",
    location: activeMobilePanel === "location",
    notes: activeMobilePanel === "notes",
  }

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
  const initialSpecies = useMemo(
    () => allSpecies.find((option) => option.id === initialSpeciesId) ?? null,
    [allSpecies, initialSpeciesId],
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

  const observedAtReady = !!observedAt && !Number.isNaN(new Date(observedAt).getTime())
  const canSubmit = analysisReady && !!speciesId && !!locationName.trim() && !!latitude.trim() && !!longitude.trim() && observedAtReady
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

  const observationProgressCount = successState.open
    ? successState.rewardSummary.observationsSubmitted
    : userStats?.observationsSubmitted
  const displayedObservationCount = observationProgressCount ?? 0
  const nextObserverThreshold = successState.open
    ? successState.rewardSummary.nextBadgeThreshold
    : getNextObserverThreshold(displayedObservationCount)
  const observerProgressValue = getProgressValue(displayedObservationCount, nextObserverThreshold)
  const observerProgressKnown = typeof observationProgressCount === "number"
  const aiNoteSuggestion = useMemo(() => buildAiNoteSuggestion(mediaAnalyses), [mediaAnalyses])

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
    if (draftRestoreTriedRef.current || typeof window === "undefined") return
    draftRestoreTriedRef.current = true

    const rawDraft = window.localStorage.getItem(OBSERVATION_DRAFT_KEY)
    if (!rawDraft) return

    try {
      const draft = normalizeObservationDraft(JSON.parse(rawDraft))
      if (!draft) {
        window.localStorage.removeItem(OBSERVATION_DRAFT_KEY)
        return
      }

      setEvidenceImages(draft.evidenceImages)
      if (draft.observedAt && !Number.isNaN(new Date(draft.observedAt).getTime())) {
        setObservedAt(draft.observedAt)
      }
      setLocationName(draft.locationName)
      setLatitude(draft.latitude)
      setLongitude(draft.longitude)
      setNotes(draft.notes)
      setIsPublic(draft.isPublic)
      setSpeciesId(draft.speciesId)
      setSpeciesQuery(draft.speciesQuery)
      setMediaAnalyses(draft.mediaAnalyses)
      setLocationPrecision(draft.locationPrecision)

      const hasSavedLocation = Boolean(draft.locationName || draft.latitude || draft.longitude)
      if (hasSavedLocation) {
        autoLocateTriedRef.current = true
        autoLocateAfterPhotoRef.current = true
      }
      draftRestoredSpeciesRef.current = Boolean(draft.speciesId || draft.speciesQuery)

      toast({ title: "已恢复本地草稿" })
    } catch {
      window.localStorage.removeItem(OBSERVATION_DRAFT_KEY)
    }
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
      setMediaAnalyses((current) => (current.length === 0 ? current : []))
      setIsAnalyzingImages(false)
      return
    }

    const imageUrlsToAnalyze = evidenceImages
      .filter((url) => !pendingAnalysisImageUrlsRef.current.has(url) && shouldAnalyzeImage(analysisMap.get(url)))
      .slice(0, 5)

    if (imageUrlsToAnalyze.length === 0) {
      setIsAnalyzingImages(false)
      setMediaAnalyses((current) => {
        const filtered = current.filter((item) => evidenceImages.includes(item.imageUrl))
        if (filtered.length === current.length && filtered.every((item, index) => item.imageUrl === current[index]?.imageUrl)) {
          return current
        }
        return filtered
      })
      return
    }

    const controller = new AbortController()
    const pendingAnalysisImageUrls = pendingAnalysisImageUrlsRef.current
    imageUrlsToAnalyze.forEach((url) => pendingAnalysisImageUrls.add(url))
    const timeout = window.setTimeout(async () => {
      setIsAnalyzingImages(true)
      try {
        const response = await fetch("/api/observations/media-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrls: imageUrlsToAnalyze }),
          signal: controller.signal,
        })

        const payload = (await response.json().catch(() => ({}))) as ObservationMediaAnalysisResponse
        if (!response.ok) {
          throw new Error(payload.error || "图片识别失败")
        }

        setMediaAnalyses((current) => {
          const nextByImage = new Map(
            current
              .filter((item) => evidenceImages.includes(item.imageUrl))
              .map((item) => [item.imageUrl, item]),
          )

          for (const analysis of payload.analyses || []) {
            if (evidenceImages.includes(analysis.imageUrl)) {
              nextByImage.set(analysis.imageUrl, analysis)
            }
          }

          return evidenceImages
            .map((url) => nextByImage.get(url))
            .filter((item): item is ObservationMediaAnalysis => Boolean(item))
        })
      } catch (error) {
        if (!controller.signal.aborted) {
          toast({
            title: "图片识别失败",
            description: error instanceof Error ? error.message : "请稍后重试",
            variant: "destructive",
          })
        }
      } finally {
        imageUrlsToAnalyze.forEach((url) => pendingAnalysisImageUrls.delete(url))
        if (!controller.signal.aborted) {
          setIsAnalyzingImages(false)
        }
      }
    }, 150)

    return () => {
      controller.abort()
      imageUrlsToAnalyze.forEach((url) => pendingAnalysisImageUrls.delete(url))
      window.clearTimeout(timeout)
    }
  }, [analysisMap, evidenceImages, toast, user])

  useEffect(() => {
    if (selectedSpecies && speciesQuery.trim() === "") {
      setSpeciesQuery(selectedSpecies.commonName)
    }
  }, [selectedSpecies, speciesQuery])

  useEffect(() => {
    if (!initialSpecies || draftRestoredSpeciesRef.current) return
    setSpeciesId(String(initialSpecies.id))
    setSpeciesQuery((current) => current || initialSpecies.commonName)
  }, [initialSpecies])

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

  const scrollToMobilePanel = (panel: MobilePanelKey, behavior: ScrollBehavior = "smooth") => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return

    window.requestAnimationFrame(() => {
      mobileSectionRefs[panel].current?.scrollIntoView({ block: "start", behavior })
    })
  }

  const openMobilePanel = (panel: MobilePanelKey, behavior: ScrollBehavior = "smooth") => {
    setActiveMobilePanel(panel)
    scrollToMobilePanel(panel, behavior)
  }

  const advanceFromSpeciesOnMobile = () => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return
    if (activeMobilePanel !== "species") return

    window.setTimeout(() => openMobilePanel("location"), 180)
  }

  const handleSpeciesSelect = (option: SpeciesOption) => {
    setSpeciesId(String(option.id))
    setSpeciesQuery(option.commonName)
    advanceFromSpeciesOnMobile()
  }

  const handleCandidateSelect = (candidate: SpeciesCandidate, closeSheet = false) => {
    const option = allSpecies.find((item) => item.id === candidate.speciesId)
    if (option) {
      handleSpeciesSelect(option)
    } else {
      setSpeciesId(String(candidate.speciesId))
      setSpeciesQuery(candidate.commonName)
    }

    if (closeSheet) {
      setSpeciesSheetOpen(false)
    }
  }

  const toggleMobilePanel = (panel: MobilePanelKey) => openMobilePanel(panel)

  const getAnalysisBlockerDescription = () => {
    if (failedAnalysis) {
      if (failedAnalysis.status === "failed_low_quality") {
        return failedAnalysis.qualityReason || "有图片不够清晰，请重拍后再提交"
      }
      if (failedAnalysis.status === "failed_unsafe") {
        return failedAnalysis.moderationReason || "有图片不适合提交观察记录"
      }
      if (failedAnalysis.status === "failed_unrecognized") {
        return "有图片暂时无法识别，请换更清晰的照片"
      }
      return failedAnalysis.moderationReason || "图片识别失败，请删除后重新上传。"
    }

    return analysisPendingCount > 0 ? "图片识别尚未完成，请稍后再试" : "请先完成图片识别"
  }

  const getSubmitBlocker = (): SubmitBlocker | null => {
    if (evidenceImages.length === 0) {
      return { panel: "photo", label: "照片", title: "请先上传一张照片" }
    }

    if (!analysisReady) {
      return {
        panel: "photo",
        label: "图片识别",
        title: "请先完成图片识别",
        description: getAnalysisBlockerDescription(),
      }
    }

    if (!speciesId) {
      return { panel: "species", label: "物种确认", title: "请先确认一个物种" }
    }

    if (!locationName.trim()) {
      return { panel: "location", label: "观察地点", title: "请先完善观察地点" }
    }

    if (!latitude.trim() || !longitude.trim()) {
      return { panel: "location", label: "地图选点", title: "请先完成地图选点" }
    }

    if (!observedAtReady) {
      return { panel: "location", label: "观察时间", title: "请先确认观察时间" }
    }

    return null
  }

  const guideToSubmitBlocker = (blocker = getSubmitBlocker()) => {
    if (!blocker) return false

    openMobilePanel(blocker.panel)
    toast({
      title: blocker.title,
      description: blocker.description,
      variant: "destructive",
    })
    return true
  }

  const resetForm = () => {
    setEvidenceImages([])
    setMediaAnalyses([])
    setObservedAt(new Date().toISOString().slice(0, 16))
    setLocationName("")
    setLatitude("")
    setLongitude("")
    setNotes("")
    setIsPublic(true)
    setSpeciesId(initialSpecies ? String(initialSpecies.id) : "")
    setSpeciesQuery(initialSpecies?.commonName ?? "")
    setLocationPrecision("approximate")
    autoLocateAfterPhotoRef.current = false
    void tryLocate(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const blocker = getSubmitBlocker()
    if (blocker) {
      guideToSubmitBlocker(blocker)
      return
    }

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
              : failedAnalysis.moderationReason || "图片识别失败，请删除后重新上传。"
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
      toast({ title: "请确认位置与时间", description: "我们需要这条观察的地点和定位。", variant: "destructive" })
      return
    }

    if (!observedAtReady) {
      toast({ title: "请确认观察时间", description: "观察日期和时间不能为空。", variant: "destructive" })
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
          is_public: isPublic,
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
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(OBSERVATION_DRAFT_KEY)
      }

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

  const handleMobileSubmitClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isSubmitting) {
      event.preventDefault()
      return
    }

    const blocker = getSubmitBlocker()
    if (blocker) {
      event.preventDefault()
      guideToSubmitBlocker(blocker)
    }
  }

  const observedDate = observedAt.slice(0, 10)
  const observedTime = observedAt.slice(11, 16)
  const submitBlocker = getSubmitBlocker()
  const submitMissingLabel = submitBlocker?.label ?? "必要信息"
  const mobileSubmitReady = canSubmit && !isSubmitting && !isAnalyzingImages

  const speciesStatusTone =
    selectedSpecies
      ? "success"
      : analysisPendingCount > 0 || isAnalyzingImages
        ? "loading"
        : speciesStepLocked
          ? "neutral"
          : "warning"

  const updateObservedDate = (date: string) => {
    setObservedAt(`${date}T${observedTime || "00:00"}`)
  }

  const updateObservedTime = (time: string) => {
    setObservedAt(`${observedDate || new Date().toISOString().slice(0, 10)}T${time || "00:00"}`)
  }

  const handleMapChange = useCallback((coords: { latitude: string; longitude: string }) => {
    setLatitude(coords.latitude)
    setLongitude(coords.longitude)
  }, [])

  const handleLocationNameSuggestion = useCallback((name: string) => {
    setLocationName(name)
  }, [])

  const handleApplyAiNoteSuggestion = useCallback(() => {
    const suggestion = aiNoteSuggestion.trim()
    if (!suggestion) return

    const current = notes.trimEnd()
    if (current.includes(suggestion)) {
      toast({ title: "AI 备注已在文本中" })
      return
    }

    const combined = `${current}${current ? "\n" : ""}${suggestion}`
    const next = combined.slice(0, NOTE_MAX_LENGTH)
    setNotes(next)

    if (combined.length > NOTE_MAX_LENGTH) {
      toast({ title: "已填入可容纳的备注内容" })
    }
  }, [aiNoteSuggestion, notes, toast])

  const handleSaveDraft = () => {
    if (typeof window === "undefined") return

    window.localStorage.setItem(
      OBSERVATION_DRAFT_KEY,
      JSON.stringify({
        evidenceImages,
        observedAt,
        locationName,
        latitude,
        longitude,
        notes,
        speciesId,
        speciesQuery,
        mediaAnalyses: mediaAnalyses.filter((item) => evidenceImages.includes(item.imageUrl)),
        locationPrecision,
        isPublic,
        version: OBSERVATION_DRAFT_VERSION,
        savedAt: new Date().toISOString(),
      }),
    )

    toast({ title: "草稿已保存到当前设备" })
  }

  const visibilityLabel = isPublic ? (locationPrecision === "hidden" ? "公开记录，隐藏精确位置" : "公开记录") : "仅自己可见"
  const precisionLabel =
    locationPrecision === "exact"
      ? "精准（≤10米）"
      : locationPrecision === "hidden"
        ? "模糊（≥100米）"
        : "一般（10-100米）"
  const previewImage = evidenceImages[0] ?? null
  const previewSpeciesName = selectedSpecies?.commonName || speciesQuery.trim() || "待确认物种"
  const previewScientificName = selectedSpecies?.scientificName || "上传照片后确认"
  const noteLength = notes.trim().length
  const aiNoteActionLabel = notes.trim() ? "追加到备注" : "填入备注"
  const qualityChecks = [
    { label: "已选择物种", done: !!speciesId },
    { label: "已上传至少 1 张照片", done: evidenceImages.length > 0 },
    { label: "已填写时间和地点", done: !!locationName.trim() && observedAtReady },
    { label: "描述字数 ≥ 10 字", done: noteLength >= 10 },
  ]
  const requiredChecks = [
    evidenceImages.length > 0,
    analysisReady,
    !!speciesId,
    !!locationName.trim() && !!latitude.trim() && !!longitude.trim() && observedAtReady,
  ]
  const requiredReadyCount = requiredChecks.filter(Boolean).length
  const requiredReadyValue = getProgressValue(requiredReadyCount, requiredChecks.length)
  const locationReady = !!locationName.trim() && !!latitude.trim() && !!longitude.trim()
  const trimmedLocationName = locationName.trim()
  const hasMapPoint = !!latitude.trim() && !!longitude.trim()
  const locationSummary = locationReady
    ? `${trimmedLocationName} · ${precisionLabel}`
    : trimmedLocationName
      ? "还需要地图选点"
      : "填写地点并确认地图"
  const mobileMapTitle = trimmedLocationName || (hasMapPoint ? "地图位置已确认" : "打开地图选点")
  const mobileMapDescription = hasMapPoint
    ? trimmedLocationName
      ? `${precisionLabel} · 点击可调整位置`
      : `已保存地图位置 · ${precisionLabel}`
    : "拖动地图可调整精确位置"
  const speciesSummary = selectedSpecies
    ? selectedSpecies.commonName
    : suggestedCandidates[0]
      ? `推荐：${suggestedCandidates[0].commonName}`
      : speciesStepLocked
        ? "上传照片后开始识别"
        : "搜索或选择候选物种"
  const mobilePanelContentClass = (panel: MobilePanelKey) => cn(!mobilePanels[panel] && "hidden md:block")
  const renderCandidateButton = (candidate: SpeciesCandidate, closeSheet = false) => {
    const active = String(candidate.speciesId) === speciesId
    const confidence = Math.round(candidate.confidence * 100)

    return (
      <button
        key={candidate.speciesId}
        type="button"
        onClick={() => handleCandidateSelect(candidate, closeSheet)}
        className={cn(
          "w-full rounded-lg border p-3 text-left transition",
          active
            ? "border-[var(--obs-accent)] bg-[var(--obs-accent-soft)] [box-shadow:var(--obs-soft-shadow)]"
            : "border-[var(--obs-border)] bg-[var(--obs-control)] hover:border-[var(--obs-accent)] hover:bg-[var(--obs-control-hover)]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--obs-text)]">{candidate.commonName}</div>
            <div className="mt-1 truncate text-xs italic text-[var(--obs-muted-2)]">
              {candidate.scientificName || "候选物种"}
            </div>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", active ? "bg-[var(--obs-accent)] text-white" : "bg-[var(--obs-accent-panel)] text-[var(--obs-accent-text)]")}>
            {confidence}%
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--obs-border)]">
          <div className="h-full rounded-full bg-[var(--obs-accent)]" style={{ width: `${confidence}%` }} />
        </div>
        <p className="mt-2 line-clamp-2 whitespace-normal break-words text-[13px] leading-6 text-[var(--obs-muted-2)]">
          {candidate.reason || "图片特征与该候选较接近"}
        </p>
      </button>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="observation-submit-theme relative pb-36 md:pb-10">
        <div className="pointer-events-none absolute inset-x-0 -top-10 h-56 [background:radial-gradient(circle_at_18%_10%,var(--obs-glow-a),transparent_30%),radial-gradient(circle_at_82%_12%,var(--obs-glow-b),transparent_28%)] md:inset-x-[-2rem]" />

        <div className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-30 mb-3 rounded-lg border border-[var(--obs-border)] bg-[var(--obs-subtle)] px-3 py-2 shadow-[0_14px_28px_-24px_rgba(0,0,0,0.85)] backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="font-semibold text-[var(--obs-text)]">发布准备 {requiredReadyCount}/{requiredChecks.length}</span>
            {submitBlocker ? (
              <button
                type="button"
                onClick={() => guideToSubmitBlocker(submitBlocker)}
                className="text-xs font-semibold text-[var(--obs-accent-text)] underline decoration-[var(--obs-accent)]/35 underline-offset-4"
              >
                还差{submitMissingLabel}
              </button>
            ) : (
              <span className="text-xs font-semibold text-[var(--obs-accent-text)]">可以发布</span>
            )}
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--obs-border)]">
            <div
              className="h-full rounded-full bg-[var(--obs-accent)] transition-[width] duration-500"
              style={{ width: `${requiredReadyValue}%` }}
            />
          </div>
        </div>

        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_470px]">
          <div className="min-w-0 space-y-5">
            <section ref={photoSectionRef} className={panelClass}>
              <div className="hidden md:block">
                <StepHeader
                  index={1}
                  title="上传照片"
                  description={isBirdTopic ? "鸟类专题记录会优先匹配本地鸟类物种，照片越清晰越容易识别。" : "至少上传 1 张清晰照片，优先选择主体完整、光线稳定的画面。"}
                  icon={Camera}
                  status={`${evidenceImages.length}/10`}
                  statusTone={evidenceImages.length > 0 ? "success" : "neutral"}
                />
              </div>
              <MobileAccordionHeader
                index={1}
                title="上传照片"
                icon={Camera}
                status={`${evidenceImages.length}/10`}
                statusTone={evidenceImages.length > 0 ? "success" : "neutral"}
                summary={evidenceImages.length > 0 ? "照片已进入识别流程" : "先添加一张清晰照片"}
                open={mobilePanels.photo}
                onToggle={() => toggleMobilePanel("photo")}
              />
              <div className={cn("mt-4 md:mt-0", mobilePanelContentClass("photo"))}>
                <ObservationSubmitPhotoSection
                  evidenceImages={evidenceImages}
                  onEvidenceChange={setEvidenceImages}
                  analyses={mediaAnalyses}
                  isAnalyzing={isAnalyzingImages}
                  showHeader={false}
                />
              </div>
            </section>

            <section ref={speciesSectionRef} className={cn(panelClass, speciesStepLocked && "opacity-90")}>
              <div className="hidden md:block">
                <StepHeader
                  index={2}
                  title="AI 识别候选物种"
                  description="基于照片智能识别，选择或搜索确认最终物种。"
                  icon={Bird}
                  status={speciesStepStatus}
                  statusTone={speciesStatusTone}
                />
              </div>
              <MobileAccordionHeader
                index={2}
                title="确认物种"
                icon={Bird}
                status={speciesStepStatus}
                statusTone={speciesStatusTone}
                summary={speciesSummary}
                open={mobilePanels.species}
                onToggle={() => toggleMobilePanel("species")}
              />

              <div className={cn("mt-4 md:mt-0", mobilePanelContentClass("species"))}>
              {analysisPendingCount > 0 ? (
                <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-[#365875] dark:bg-[#1d2e3a] dark:text-[#c7dceb]">
                  还有 {analysisPendingCount} 张图片正在识别，完成后才可提交。
                </div>
              ) : null}

              {failedAnalysis ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-[#6d5c32] dark:bg-[#332d20] dark:text-[#f3d889]">
                  {failedAnalysis.status === "failed_unsafe"
                    ? failedAnalysis.moderationReason || "这张图片不适合用于自然观察提交，请更换照片。"
                    : failedAnalysis.status === "failed_low_quality"
                      ? failedAnalysis.qualityReason || "图片不够清晰，请重拍后再试。"
                      : failedAnalysis.status === "failed_unrecognized"
                        ? "暂时无法从这张图片识别出可靠鸟类候选，请换一张更清晰的照片。"
                        : failedAnalysis.moderationReason || "图片识别失败，请删除后重新上传。"}
                </div>
              ) : null}

              {suggestedCandidates.length > 0 ? (
                <div className={cn(subtlePanelClass, "mb-4 space-y-3")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--obs-text)]">
                      <Info className="h-4 w-4 text-[var(--obs-accent)]" />
                      推荐候选
                    </div>
                    <span className="text-xs text-[var(--obs-muted-2)]">置信度仅供参考</span>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {renderCandidateButton(suggestedCandidates[0])}
                    {suggestedCandidates.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full rounded-lg border-[var(--obs-border-strong)] bg-[var(--obs-control)] text-[var(--obs-text)] hover:bg-[var(--obs-control-hover)] hover:text-[var(--obs-text)]"
                        onClick={() => setSpeciesSheetOpen(true)}
                      >
                        查看更多候选
                      </Button>
                    ) : null}
                  </div>
                  <div className="hidden gap-3 md:grid md:grid-cols-3">
                    {suggestedCandidates.slice(0, 3).map((candidate) => renderCandidateButton(candidate))}
                  </div>
                </div>
              ) : analysisReady ? (
                <div className="mb-4 rounded-lg border border-[var(--obs-border)] bg-[var(--obs-control)] px-4 py-3 text-sm text-[var(--obs-muted)]">
                  当前图片没有匹配到可靠的本地鸟类候选。你仍可手动搜索并确认物种。
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--obs-muted-2)]" />
                  <Input
                    value={speciesQuery}
                    onChange={(event) => {
                      setSpeciesQuery(event.target.value)
                      if (!event.target.value.trim()) {
                        setSpeciesId("")
                      }
                    }}
                    placeholder={speciesStepLocked ? "先上传照片" : "搜索更多物种名称..."}
                    disabled={speciesStepLocked}
                    className={cn(controlClass, "pl-10 pr-10")}
                  />
                  {isSearchingSpecies ? (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--obs-muted-2)]" />
                  ) : null}
                </div>

                {!speciesStepLocked && shouldShowSpeciesResults ? (
                  <div className="overflow-hidden rounded-lg border border-[var(--obs-border)] bg-[var(--obs-control)]">
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
                            className={cn(
                              "flex w-full items-center justify-between gap-3 border-b border-[var(--obs-border)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--obs-control-hover)]",
                              isSelected && "bg-[var(--obs-accent-soft)] ring-1 ring-inset ring-[var(--obs-focus)]",
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold text-[var(--obs-text)]">{option.commonName}</div>
                                {aiCandidate ? (
                                  <Badge variant="outline" className="border-[var(--obs-accent)] bg-[var(--obs-accent-panel)] text-[var(--obs-accent-text)]">
                                    AI {Math.round(aiCandidate.confidence * 100)}%
                                  </Badge>
                                ) : null}
                              </div>
                              {option.scientificName ? (
                                <div className="mt-0.5 truncate text-xs italic text-[var(--obs-muted-2)]">{option.scientificName}</div>
                              ) : null}
                            </div>
                            {isSelected ? (
                              <span className="rounded-full bg-[var(--obs-accent)] px-2.5 py-1 text-xs font-medium text-white">
                                已确认
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--obs-muted-2)]" />
                            )}
                          </button>
                        )
                      })}
                  </div>
                ) : !speciesStepLocked ? (
                  <div className="rounded-lg border border-[var(--obs-border)] bg-[var(--obs-control)] px-4 py-3 text-sm text-[var(--obs-muted)]">
                    当前已选中 AI 候选。若要改成别的物种，直接在上方输入名称搜索。
                  </div>
                ) : null}
              </div>
              </div>
            </section>

            <section ref={locationSectionRef} className={panelClass}>
              <div className="hidden md:block">
                <StepHeader
                  index={3}
                  title="观察地点与时间"
                  description="地点会影响物种分布判断；可使用当前位置，也可以在地图上手动选点。"
                  icon={MapPin}
                  status={locationName.trim() && latitude.trim() && longitude.trim() ? "已填写" : "待填写"}
                  statusTone={locationName.trim() && latitude.trim() && longitude.trim() ? "success" : "warning"}
                />
              </div>
              <MobileAccordionHeader
                index={3}
                title="地点与时间"
                icon={MapPin}
                status={locationName.trim() && latitude.trim() && longitude.trim() ? "已填写" : "待填写"}
                statusTone={locationName.trim() && latitude.trim() && longitude.trim() ? "success" : "warning"}
                summary={locationSummary}
                open={mobilePanels.location}
                onToggle={() => toggleMobilePanel("location")}
              />

              <div className={cn("mt-4 md:mt-0", mobilePanelContentClass("location"))}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(300px,1.08fr)]">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel htmlFor="observedDate">观察日期</FieldLabel>
                      <div className="relative">
                        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--obs-muted-2)]" />
                        <Input
                          id="observedDate"
                          type="date"
                          value={observedDate}
                          onChange={(event) => updateObservedDate(event.target.value)}
                          className={cn(controlClass, "pl-10")}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="observedTime">观察时间</FieldLabel>
                      <div className="relative">
                        <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--obs-muted-2)]" />
                        <Input
                          id="observedTime"
                          type="time"
                          value={observedTime}
                          onChange={(event) => updateObservedTime(event.target.value)}
                          className={cn(controlClass, "pl-10")}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <FieldLabel htmlFor="locationName">观察地点</FieldLabel>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--obs-muted-2)]" />
                      <Input
                        id="locationName"
                        value={locationName}
                        onChange={(event) => setLocationName(event.target.value)}
                        placeholder="例如：西溪湿地公园 · 绿堤"
                        className={cn(controlClass, "pl-10")}
                      />
                    </div>
                  </div>

                  <div className="hidden grid-cols-2 gap-3 md:grid">
                    <div className="space-y-2">
                      <FieldLabel>纬度</FieldLabel>
                      <Input
                        value={latitude}
                        onChange={(event) => setLatitude(event.target.value)}
                        placeholder="30.2742"
                        className={controlClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>经度</FieldLabel>
                      <Input
                        value={longitude}
                        onChange={(event) => setLongitude(event.target.value)}
                        placeholder="120.1075"
                        className={controlClass}
                      />
                    </div>
                  </div>

                  <div className="hidden space-y-2 md:block">
                    <FieldLabel>位置精度</FieldLabel>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <PrecisionButton
                        active={locationPrecision === "exact"}
                        label="精准"
                        description="≤10米"
                        onClick={() => setLocationPrecision("exact")}
                      />
                      <PrecisionButton
                        active={locationPrecision === "approximate"}
                        label="一般"
                        description="10-100米"
                        onClick={() => setLocationPrecision("approximate")}
                      />
                      <PrecisionButton
                        active={locationPrecision === "hidden"}
                        label="模糊"
                        description="≥100米"
                        onClick={() => setLocationPrecision("hidden")}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setLocationSheetOpen(true)}
                    className="flex w-full items-center gap-3 rounded-lg border border-[var(--obs-border-strong)] bg-[var(--obs-control)] p-3 text-left transition hover:border-[var(--obs-accent)] hover:bg-[var(--obs-control-hover)] md:hidden"
                  >
                    <span className="grid h-14 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--obs-border)] [background:var(--obs-map-bg)] text-[var(--obs-accent)]">
                      <MapPin className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--obs-text)]">{mobileMapTitle}</span>
                      <span className="mt-1 block truncate text-xs text-[var(--obs-muted)]">
                        {mobileMapDescription}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--obs-muted-2)]" />
                  </button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-lg border-[var(--obs-accent)] bg-[var(--obs-accent-soft)] text-[var(--obs-accent-text)] hover:bg-[var(--obs-accent-panel)] hover:text-[var(--obs-accent-text)] md:hidden"
                    onClick={() => void tryLocate(true)}
                    disabled={isLocating}
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        定位中...
                      </>
                    ) : (
                      <>
                        <Navigation className="mr-2 h-4 w-4" />
                        使用当前位置
                      </>
                    )}
                  </Button>
                </div>

                <div className="hidden space-y-3 md:block">
                  <DomesticMapPicker
                    latitude={latitude}
                    longitude={longitude}
                    onChange={handleMapChange}
                    onLocationNameSuggestion={handleLocationNameSuggestion}
                    mapClassName="nature-mini-map h-52 rounded-lg border-[var(--obs-border-strong)] [background:var(--obs-map-bg)] sm:h-64 lg:h-[312px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-lg border-[var(--obs-accent)] bg-[var(--obs-accent-soft)] text-[var(--obs-accent-text)] hover:bg-[var(--obs-accent-panel)] hover:text-[var(--obs-accent-text)]"
                    onClick={() => void tryLocate(true)}
                    disabled={isLocating}
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        定位中...
                      </>
                    ) : (
                      <>
                        <Navigation className="mr-2 h-4 w-4" />
                        使用当前位置
                      </>
                    )}
                  </Button>
                </div>
              </div>
              </div>
            </section>

            <section ref={notesSectionRef} className={panelClass}>
              <div className="hidden md:block">
                <StepHeader
                  index={4}
                  title="观察备注"
                  description="写下行为、环境和你注意到的细节，能让记录更有科学价值。"
                  icon={ListChecks}
                  status={noteLength >= 10 ? "描述充足" : "可补充"}
                  statusTone={noteLength >= 10 ? "success" : "neutral"}
                />
              </div>
              <MobileAccordionHeader
                index={4}
                title="备注与发布"
                icon={ListChecks}
                status={noteLength >= 10 ? "描述充足" : "可补充"}
                statusTone={noteLength >= 10 ? "success" : "neutral"}
                summary={visibilityLabel}
                open={mobilePanels.notes}
                onToggle={() => toggleMobilePanel("notes")}
              />

              <div className={cn("relative z-10 mt-4 md:mt-0", mobilePanelContentClass("notes"))}>
              <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
                <FieldLabel htmlFor="observationNotes">观察备注</FieldLabel>
                <button
                  type="button"
                  onClick={() => setTipsSheetOpen(true)}
                  className="inline-flex h-9 scroll-mt-24 scroll-mb-40 items-center gap-1.5 rounded-lg border border-[var(--obs-border)] bg-[var(--obs-control)] px-2.5 text-xs font-medium text-[var(--obs-muted)]"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  小贴士
                </button>
              </div>
              <Textarea
                id="observationNotes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="清晨在绿堤水域发现一只白鹭，站在浅水中觅食，时而低头捕食小鱼，时而展翅飞起。"
                rows={5}
                maxLength={NOTE_MAX_LENGTH}
                className={textareaClass}
              />
              {aiNoteSuggestion ? (
                <div className="mt-3 rounded-lg border border-[var(--obs-border)] bg-[var(--obs-accent-soft)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--obs-text)]">
                        <Sparkles className="h-4 w-4 text-[var(--obs-accent)]" />
                        AI 备注建议
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--obs-muted)]">
                        {aiNoteSuggestion}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 rounded-lg border-[var(--obs-accent)] bg-[var(--obs-control)] px-3 text-[var(--obs-accent-text)] hover:bg-[var(--obs-control-hover)] hover:text-[var(--obs-accent-text)]"
                      onClick={handleApplyAiNoteSuggestion}
                    >
                      {aiNoteActionLabel}
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="mt-2 flex justify-end text-xs text-[var(--obs-muted-2)]">
                {noteLength}/{NOTE_MAX_LENGTH}
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic((current) => !current)}
                className="mt-4 flex w-full items-center gap-3 rounded-lg border border-[var(--obs-border)] bg-[var(--obs-control)] px-3 py-3 text-left md:hidden"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--obs-accent-soft)] text-[var(--obs-accent-text)]">
                  {isPublic ? <Globe2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--obs-text)]">
                    {isPublic ? "公开记录" : "仅自己可见"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--obs-muted)]">
                    {isPublic ? "其他用户可在自然观察中看到" : "保存在个人观察记录"}
                  </span>
                </span>
                <span
                  className={cn(
                    "relative h-7 w-12 shrink-0 rounded-full border transition",
                    isPublic ? "border-[var(--obs-accent)] bg-[var(--obs-accent)]" : "border-[var(--obs-border-strong)] bg-[var(--obs-subtle)]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                      isPublic ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </span>
              </button>

              <div className="mt-4 hidden gap-3 md:grid md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition",
                    isPublic ? "border-[var(--obs-accent)] bg-[var(--obs-accent-soft)]" : "border-[var(--obs-border)] bg-[var(--obs-control)] hover:border-[var(--obs-accent)]",
                  )}
                >
                  <Globe2 className="h-5 w-5 shrink-0 text-[var(--obs-accent)]" />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--obs-text)]">公开</span>
                    <span className="mt-0.5 block text-xs text-[var(--obs-muted-2)]">所有人可见</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition",
                    !isPublic ? "border-[var(--obs-accent)] bg-[var(--obs-accent-soft)]" : "border-[var(--obs-border)] bg-[var(--obs-control)] hover:border-[var(--obs-accent)]",
                  )}
                >
                  <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--obs-accent)]" />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--obs-text)]">仅自己</span>
                    <span className="mt-0.5 block text-xs text-[var(--obs-muted-2)]">保存在个人记录</span>
                  </span>
                </button>
              </div>
              </div>
            </section>

            <div className="hidden items-center gap-3 rounded-lg border border-[var(--obs-border)] bg-[var(--obs-subtle)] p-3 md:flex">
              <Button
                type="submit"
                disabled={isSubmitting || isAnalyzingImages || !canSubmit}
                className="h-12 flex-1 rounded-lg bg-[var(--obs-accent)] text-base font-semibold text-white hover:bg-[var(--obs-accent-strong)]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    发布观察记录
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-lg border-[var(--obs-border-strong)] bg-[var(--obs-control)] px-8 text-[var(--obs-text)] hover:bg-[var(--obs-control-hover)] hover:text-[var(--obs-text)]"
                onClick={handleSaveDraft}
              >
                <Save className="mr-2 h-4 w-4" />
                保存草稿
              </Button>
            </div>
          </div>

          <aside className="hidden min-w-0 space-y-4 md:block xl:sticky xl:top-24 xl:self-start">
            <section className={panelClass}>
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--obs-text)]">
                <Eye className="h-4 w-4 text-[var(--obs-accent)]" />
                观察预览
              </div>
              <div className="grid gap-4 sm:grid-cols-[176px_minmax(0,1fr)] xl:grid-cols-1">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--obs-border-strong)] bg-[var(--obs-control)]">
                  {previewImage ? (
                    <OptimizedImage src={previewImage} alt="观察预览" fill variant="cover" className="object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center [background:var(--obs-photo-bg)] text-[var(--obs-muted-2)]">
                      <Camera className="h-9 w-9" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-[var(--obs-text)]">{previewSpeciesName}</h3>
                  <p className="mt-1 truncate text-sm italic text-[var(--obs-muted)]">{previewScientificName}</p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--obs-muted)]">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-[var(--obs-accent)]" />
                      <span className="truncate">{locationName.trim() || "待填写地点"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 shrink-0 text-[var(--obs-accent)]" />
                      <span>{formatObservedAt(observedAt)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-[var(--obs-accent)] bg-[var(--obs-accent-panel)] text-[var(--obs-accent-text)]">
                      {precisionLabel}
                    </Badge>
                    <Badge variant="outline" className="border-[var(--obs-border-strong)] bg-[var(--obs-control)] text-[var(--obs-muted)]">
                      {visibilityLabel}
                    </Badge>
                  </div>
                </div>
              </div>
            </section>

            <section className={panelClass}>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--obs-text)]">
                <Gift className="h-4 w-4 text-amber-500 dark:text-amber-300" />
                观察家进度
              </div>
              <div className="mt-4 rounded-lg border border-[var(--obs-border)] bg-[var(--obs-control)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--obs-text)]">
                      {observerProgressKnown ? `${displayedObservationCount} / ${nextObserverThreshold} 条` : "同步中"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--obs-muted-2)]">本次发布 +{DEFAULT_XP_REWARD} 探索经验</p>
                  </div>
                  <span className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--obs-accent-soft)] text-[var(--obs-accent-text)]">
                    <Sparkles className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--obs-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--obs-accent)] transition-[width] duration-500"
                    style={{ width: `${observerProgressKnown ? observerProgressValue : 0}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {OBSERVER_THRESHOLDS.map((threshold) => {
                    const done = observerProgressKnown && displayedObservationCount >= threshold
                    const current = observerProgressKnown && !done && threshold === nextObserverThreshold
                    return (
                      <span
                        key={threshold}
                        className={cn(
                          "inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold tabular-nums",
                          done
                            ? "border-emerald-500 bg-[var(--obs-accent)] text-white"
                            : current
                              ? "border-[var(--obs-accent)] bg-[var(--obs-accent-soft)] text-[var(--obs-accent-text)]"
                              : "border-[var(--obs-border-strong)] bg-[var(--obs-control)] text-[var(--obs-muted-2)]",
                        )}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : threshold}
                      </span>
                    )
                  })}
                </div>
              </div>
            </section>

            <section className={panelClass}>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--obs-text)]">
                <Target className="h-4 w-4 text-[var(--obs-accent)]" />
                野外观察小贴士
              </div>
              <ul className="space-y-2 text-sm leading-6 text-[var(--obs-muted)]">
                <li>尽量在自然光下拍摄，保持画面清晰。</li>
                <li>拍摄时包含多个角度，如整体、特征部位。</li>
                <li>记录生境环境，如水域、树林、草地等。</li>
                <li>不干扰、不捕捉野生动物，保护自然。</li>
              </ul>
            </section>

            <section className={panelClass}>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--obs-text)]">
                <ClipboardCheck className="h-4 w-4 text-[var(--obs-accent)]" />
                数据质量检查
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {qualityChecks.map((item) => (
                  <QualityRow key={item.label} done={item.done} label={item.label} />
                ))}
              </div>
            </section>
          </aside>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 px-4 pb-3 pt-6 md:hidden">
          <div className="pointer-events-auto mx-auto flex w-fit max-w-[calc(100vw-2rem)] gap-2 rounded-lg border border-[var(--obs-border-strong)] bg-[var(--obs-panel)] p-2 [box-shadow:var(--obs-panel-shadow)] backdrop-blur-md">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-12 shrink-0 rounded-lg border-[var(--obs-border-strong)] bg-[var(--obs-control)] px-0 text-[var(--obs-text)] hover:bg-[var(--obs-control-hover)] hover:text-[var(--obs-text)]"
              onClick={handleSaveDraft}
              aria-label="保存草稿"
            >
              <Save className="h-5 w-5" />
            </Button>
            <Button
              type="submit"
              data-disabled={!mobileSubmitReady}
              onClick={handleMobileSubmitClick}
              className={cn(
                "h-12 w-52 shrink-0 rounded-lg text-base font-semibold transition-colors sm:w-56",
                mobileSubmitReady
                  ? "bg-[var(--obs-accent)] text-[#f7fff8] [box-shadow:var(--obs-soft-shadow)] hover:bg-[var(--obs-accent-strong)]"
                  : "border border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-500 dark:border-[#37424a] dark:bg-[#252e35] dark:text-[#aeb8b5] dark:hover:bg-[#252e35] dark:hover:text-[#aeb8b5]",
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  发布中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  发布观察记录
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <Sheet open={speciesSheetOpen} onOpenChange={setSpeciesSheetOpen}>
        <SheetContent
          side="bottom"
          className="observation-submit-theme max-h-[72dvh] overflow-y-auto rounded-t-2xl border-[var(--obs-border)] px-4 pb-6 pt-5 [background:var(--obs-panel)]"
        >
          <SheetHeader className="mb-4 pr-8 text-left">
            <SheetTitle className="text-[var(--obs-text)]">AI 候选物种</SheetTitle>
            <SheetDescription className="text-[var(--obs-muted)]">
              选择最接近照片特征的候选，也可以回到表单手动搜索。
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3">
            {suggestedCandidates.map((candidate) => renderCandidateButton(candidate, true))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={locationSheetOpen} onOpenChange={setLocationSheetOpen}>
        <SheetContent
          side="bottom"
          className="observation-submit-theme flex h-[82dvh] max-h-[760px] flex-col rounded-t-2xl border-[var(--obs-border)] p-0 [background:var(--obs-panel)]"
        >
          <SheetHeader className="shrink-0 px-4 pb-3 pr-12 pt-5 text-left">
            <SheetTitle className="text-[var(--obs-text)]">地图选点</SheetTitle>
            <SheetDescription className="text-[var(--obs-muted)]">
              拖动标记或点击地图，确认观察发生的位置。
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <DomesticMapPicker
              latitude={latitude}
              longitude={longitude}
              onChange={handleMapChange}
              onLocationNameSuggestion={handleLocationNameSuggestion}
              mapClassName="nature-mini-map h-[34dvh] min-h-[220px] max-h-[320px] rounded-lg border-[var(--obs-border-strong)] [background:var(--obs-map-bg)]"
            />
            <div className="mt-4 space-y-2">
              <FieldLabel>位置精度</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                <PrecisionButton
                  active={locationPrecision === "exact"}
                  label="精准"
                  description="≤10米"
                  onClick={() => setLocationPrecision("exact")}
                />
                <PrecisionButton
                  active={locationPrecision === "approximate"}
                  label="一般"
                  description="10-100米"
                  onClick={() => setLocationPrecision("approximate")}
                />
                <PrecisionButton
                  active={locationPrecision === "hidden"}
                  label="模糊"
                  description="≥100米"
                  onClick={() => setLocationPrecision("hidden")}
                />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-[var(--obs-border)] bg-[var(--obs-control)] p-3 text-xs leading-5 text-[var(--obs-muted)]">
              <div className="truncate font-medium text-[var(--obs-text)]">{locationName.trim() || "地点名称待填写"}</div>
              <div className="mt-1 truncate">{latitude && longitude ? `地图位置已保存 · ${precisionLabel}` : "尚未确认地图位置"}</div>
            </div>
          </div>
          <SheetFooter className="shrink-0 flex-row gap-2 border-t border-[var(--obs-border)] p-4 [background:var(--obs-panel)]">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-lg border-[var(--obs-accent)] bg-[var(--obs-accent-soft)] text-[var(--obs-accent-text)] hover:bg-[var(--obs-accent-panel)] hover:text-[var(--obs-accent-text)]"
              onClick={() => void tryLocate(true)}
              disabled={isLocating}
            >
              {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
              当前位置
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 rounded-lg bg-[var(--obs-accent)] text-white hover:bg-[var(--obs-accent-strong)]"
              onClick={() => setLocationSheetOpen(false)}
            >
              完成
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={tipsSheetOpen} onOpenChange={setTipsSheetOpen}>
        <SheetContent
          side="bottom"
          className="observation-submit-theme rounded-t-2xl border-[var(--obs-border)] px-4 pb-6 pt-5 [background:var(--obs-panel)]"
        >
          <SheetHeader className="mb-4 pr-8 text-left">
            <SheetTitle className="text-[var(--obs-text)]">野外观察小贴士</SheetTitle>
          </SheetHeader>
          <ul className="space-y-2 text-sm leading-6 text-[var(--obs-muted)]">
            <li>尽量在自然光下拍摄，保持画面清晰。</li>
            <li>拍摄时包含多个角度，如整体、特征部位。</li>
            <li>记录生境环境，如水域、树林、草地等。</li>
            <li>不干扰、不捕捉野生动物，保护自然。</li>
          </ul>
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
