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
  HelpCircle,
  Info,
  Loader2,
  MapPin,
  Search,
  Send,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react"

import { ObservationLocationPicker } from "@/components/features/bird-observation/observation-location-picker"
import { ObservationSubmitPhotoSection, type ObservationMediaAnalysis } from "@/components/features/bird-observation/observation-submit-photo-section"
import { ObservationPhotoStrip } from "@/components/features/bird-observation/observation-photo-strip"
import { ObservationSubmitSuccessDialog } from "@/components/features/bird-observation/observation-submit-success-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OptimizedImage } from "@/components/ui/optimized-image"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { dispatchObservationCreated } from "@/lib/gamification/observation-events"
import { useGamification } from "@/lib/context/gamification-context"
import { useAuth } from "@/lib/context/auth-context"
import type { ObservationPhotoMetadata } from "@/lib/observation-photo-metadata"
import { resolveObservationPhotoMetadataAutofill } from "@/lib/observations/photo-metadata-autofill"
import {
  copyLocationToDraft,
  createEmptyPhotoDraft,
  isPhotoLocated,
  isPhotoPublishReady,
  isPhotoTimeReady,
  nowLocalDateTimeInput,
  setManualLocationName,
  syncPhotoDrafts,
  type ObservationPhotoDraft,
  type ObservationPhotoLocationSource,
} from "@/lib/observations/photo-draft"
import { getObservationSubmitTopicCopy } from "@/lib/observations/submit-topic"
import {
  observationLifecycleStageOptions,
  observationSexOptions,
  type ObservationLifecycleStage,
  type ObservationSex,
} from "@/lib/observations/traits"
import { convertGpsToAmap, reverseGeocode, searchPlacesNear, type PlaceSearchResult } from "@/lib/reverse-geocode"
import { cn } from "@/lib/utils"
import {
  getApiErrorMessageFromPayload,
  getApiErrorPayload,
  getInteractionAccessRedirect,
  isAgeConfirmationRequired,
} from "@/lib/utils/http"

export interface SpeciesOption {
  id: number
  commonName: string
  scientificName?: string | null
}

interface ObservationSubmitFormProps {
  speciesOptions: SpeciesOption[]
  initialSpeciesId?: number | null
}

interface SpeciesSearchResponse {
  species?: SpeciesOption[]
}

interface ObservationMediaAnalysisResponse {
  analyses?: ObservationMediaAnalysis[]
  error?: string
}

interface SubmitResponse {
  observation: {
    id: number
  }
  observations?: Array<{
    id: number
  }>
  reviewStatus?: "pending" | "approved" | "rejected"
}

const DEFAULT_XP_REWARD = 10
const NOTE_MAX_LENGTH = 500
const OBSERVATION_DRAFT_KEY = "steam:nature-observation-draft"
const OBSERVATION_DRAFT_VERSION = 2
const OBSERVER_THRESHOLDS = [1, 10, 30, 100]
const MEDIA_ANALYSIS_STATUS_VALUES = [
  "pending",
  "passed",
  "passed_no_identification",
  "failed_unsafe",
  "failed_low_quality",
  "failed_unrecognized",
  "error",
] as const
const MEDIA_ANALYSIS_FINAL_STATUSES = new Set<ObservationMediaAnalysis["status"]>([
  "passed",
  "passed_no_identification",
  "failed_unsafe",
  "failed_low_quality",
  "failed_unrecognized",
  "error",
])

type StepStatusTone = "neutral" | "success" | "warning" | "loading"
type MobilePanelKey = "photo" | "species" | "location"
type SpeciesCandidate = ObservationMediaAnalysis["speciesCandidates"][number]
type DraftSaveStatus = "idle" | "saving" | "saved" | "error"

interface SubmitBlocker {
  panel: MobilePanelKey
  label: string
  title: string
  description?: string
}

interface ObservationDraft {
  version?: number
  evidenceImages: string[]
  photoDrafts: Record<string, ObservationPhotoDraft>
  mediaAnalyses: ObservationMediaAnalysis[]
}

interface ObservationDraftSnapshot {
  evidenceImages: string[]
  photoDrafts: Record<string, ObservationPhotoDraft>
  mediaAnalyses: ObservationMediaAnalysis[]
}

const panelClass =
  "scroll-mt-28 scroll-mb-64 rounded-sm border border-(--obs-border) bg-(--obs-panel) p-4 [box-shadow:var(--obs-panel-shadow)] ring-1 ring-(--obs-ring) sm:p-5 md:scroll-mt-24 md:scroll-mb-24"
const subtlePanelClass =
  "rounded-sm border border-(--obs-border) bg-(--obs-subtle) p-4"
const controlClass =
  "h-11 rounded-sm border-(--obs-border-strong) bg-(--obs-control) text-(--obs-text) shadow-none placeholder:text-(--obs-placeholder) transition-colors focus:border-(--obs-accent)! focus:outline-hidden focus:ring-2 focus:ring-(--obs-focus) focus:ring-offset-0 focus-visible:border-(--obs-accent)! focus-visible:ring-(--obs-focus) focus-visible:ring-offset-0"
const stepStatusClassNames: Record<StepStatusTone, string> = {
  neutral: "border-(--obs-border-strong) bg-(--obs-control) text-(--obs-muted)",
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
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-(--obs-accent) text-sm font-bold text-white [box-shadow:var(--obs-soft-shadow)]">
          {index}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-(--obs-text)">{title}</h2>
            <Icon className="h-4 w-4 text-(--obs-accent)" />
          </div>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-6 text-(--obs-muted)">{description}</p>
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
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-(--obs-accent) text-xs font-bold text-white [box-shadow:var(--obs-soft-shadow)]">
            {index}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-base font-semibold text-(--obs-text)">{title}</span>
              <Icon className="h-4 w-4 shrink-0 text-(--obs-accent)" />
            </span>
            {summary ? (
              <span className="mt-1 block truncate text-xs leading-5 text-(--obs-muted)">{summary}</span>
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
          <ChevronDown className={cn("mt-1 h-4 w-4 text-(--obs-muted-2) transition-transform", open && "rotate-180")} />
        </span>
      </button>
    </div>
  )
}

interface MobileStepFooterProps {
  actionLabel: string
  onNext: () => void
  disabled?: boolean
  helper?: React.ReactNode
}

function MobileStepFooter({
  actionLabel,
  onNext,
  disabled = false,
  helper,
}: MobileStepFooterProps) {
  return (
    <div className="mt-5 border-t border-(--obs-border) pt-4 md:hidden">
      {helper ? (
        <p className="mb-3 text-xs leading-5 text-(--obs-muted)">{helper}</p>
      ) : null}
      <Button
        type="button"
        className="h-11 w-full rounded-sm bg-(--obs-accent) text-sm font-semibold text-white hover:bg-(--obs-accent-strong) disabled:border disabled:border-(--obs-border-strong) disabled:bg-(--obs-control) disabled:text-(--obs-muted-2)"
        onClick={onNext}
        disabled={disabled}
      >
        {actionLabel}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  )
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-(--obs-text)">
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
          done ? "border-emerald-500 bg-(--obs-accent) text-white" : "border-(--obs-border-strong) bg-(--obs-control) text-(--obs-muted-2)",
        )}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5 fill-current" />}
      </span>
      <span className={done ? "text-(--obs-text)" : "text-(--obs-muted-2)"}>{label}</span>
    </div>
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

function isObservationSex(value: unknown): value is ObservationSex {
  return value === "male" || value === "female" || value === "unknown"
}

function isObservationLifecycleStage(value: unknown): value is ObservationLifecycleStage {
  return value === "egg" || value === "larva" || value === "pupa" || value === "juvenile" || value === "adult" || value === "unknown"
}

function isLocationSource(value: unknown): value is ObservationPhotoLocationSource {
  return value === "photo_exif" || value === "place_search" || value === "map_pin" || value === "device_location"
}

function normalizePhotoDraft(value: unknown): ObservationPhotoDraft | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  return {
    speciesId: normalizeDraftString(row.speciesId),
    sex: isObservationSex(row.sex) ? row.sex : "",
    lifecycleStage: isObservationLifecycleStage(row.lifecycleStage) ? row.lifecycleStage : "",
    observedAt: normalizeDraftString(row.observedAt) || nowLocalDateTimeInput(),
    observedAtSource: row.observedAtSource === "photo_exif" ? "photo_exif" : "manual",
    latitude: normalizeDraftString(row.latitude),
    longitude: normalizeDraftString(row.longitude),
    locationName: normalizeDraftString(row.locationName),
    locationSource: isLocationSource(row.locationSource) ? row.locationSource : "map_pin",
    locationWarning: normalizeDraftString(row.locationWarning),
  }
}

function shouldAnalyzeImage(analysis: ObservationMediaAnalysis | undefined) {
  if (!analysis) return true
  return !MEDIA_ANALYSIS_FINAL_STATUSES.has(analysis.status)
}

function normalizeObservationDraft(value: unknown): ObservationDraft | null {
  if (!value || typeof value !== "object") return null

  const draft = value as Record<string, unknown>
  const evidenceImages = Array.isArray(draft.evidenceImages)
    ? draft.evidenceImages.filter((url): url is string => typeof url === "string" && url.trim().length > 0).slice(0, 5)
    : []
  const allowedImageUrls = new Set(evidenceImages)
  const mediaAnalyses = Array.isArray(draft.mediaAnalyses)
    ? draft.mediaAnalyses
        .map((analysis) => normalizeMediaAnalysis(analysis, allowedImageUrls))
        .filter((analysis): analysis is ObservationMediaAnalysis => Boolean(analysis))
    : []
  const photoDrafts: Record<string, ObservationPhotoDraft> = {}
  if (draft.photoDrafts && typeof draft.photoDrafts === "object") {
    for (const url of evidenceImages) {
      const parsed = normalizePhotoDraft((draft.photoDrafts as Record<string, unknown>)[url])
      photoDrafts[url] = parsed ?? createEmptyPhotoDraft()
    }
  } else {
    const shared = createEmptyPhotoDraft()
    shared.observedAt = normalizeDraftString(draft.observedAt) || shared.observedAt
    shared.observedAtSource = draft.observedAtSource === "photo_exif" ? "photo_exif" : "manual"
    shared.locationName = normalizeDraftString(draft.locationName)
    shared.latitude = normalizeDraftString(draft.latitude)
    shared.longitude = normalizeDraftString(draft.longitude)
    shared.locationSource = isLocationSource(draft.locationSource) ? draft.locationSource : "map_pin"
    shared.speciesId = normalizeDraftString(draft.speciesId)
    for (const url of evidenceImages) {
      photoDrafts[url] = { ...shared }
    }
  }

  if (evidenceImages.length === 0) return null

  return {
    evidenceImages,
    photoDrafts,
    mediaAnalyses,
  }
}

function persistObservationDraft(snapshot: ObservationDraftSnapshot) {
  if (typeof window === "undefined") return false

  try {
    if (snapshot.evidenceImages.length === 0) {
      window.localStorage.removeItem(OBSERVATION_DRAFT_KEY)
      return true
    }

    window.localStorage.setItem(
      OBSERVATION_DRAFT_KEY,
      JSON.stringify({
        evidenceImages: snapshot.evidenceImages,
        photoDrafts: snapshot.photoDrafts,
        mediaAnalyses: snapshot.mediaAnalyses.filter((item) => snapshot.evidenceImages.includes(item.imageUrl)),
        version: OBSERVATION_DRAFT_VERSION,
        savedAt: new Date().toISOString(),
      }),
    )
    return true
  } catch {
    return false
  }
}

function clearObservationDraft() {
  if (typeof window === "undefined") return false

  try {
    window.localStorage.removeItem(OBSERVATION_DRAFT_KEY)
    return true
  } catch {
    return false
  }
}

function DraftSaveIndicator({ status, className }: { status: DraftSaveStatus; className?: string }) {
  if (status === "idle") return null

  const statusCopy = {
    saving: "保存中…",
    saved: "已自动保存到当前设备",
    error: "自动保存失败",
  }[status]
  const statusClass = {
    saving: "text-(--obs-muted)",
    saved: "text-emerald-700 dark:text-emerald-300",
    error: "text-destructive",
  }[status]

  return (
    <p className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs", statusClass, className)} role="status" aria-live="polite">
      {status === "saving" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
      {status === "saved" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : null}
      {status === "error" ? <Info className="h-3.5 w-3.5 shrink-0" /> : null}
      <span className="truncate">{statusCopy}</span>
    </p>
  )
}

export function ObservationSubmitForm({
  speciesOptions,
  initialSpeciesId = null,
}: ObservationSubmitFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { promptLogin, runAfterAgeConfirmation } = useLoginPrompt()
  const { userStats } = useGamification()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [evidenceImages, setEvidenceImages] = useState<string[]>([])
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, ObservationPhotoDraft>>({})
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false)
  const [placeSearchUnavailable, setPlaceSearchUnavailable] = useState(false)
  const [speciesQuery, setSpeciesQuery] = useState("")
  const [speciesResults, setSpeciesResults] = useState<SpeciesOption[]>([])
  const [isSearchingSpecies, setIsSearchingSpecies] = useState(false)
  const [mediaAnalyses, setMediaAnalyses] = useState<ObservationMediaAnalysis[]>([])
  const [isAnalyzingImages, setIsAnalyzingImages] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>("idle")
  const [isLocating, setIsLocating] = useState(false)
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanelKey>("photo")
  const [speciesSheetOpen, setSpeciesSheetOpen] = useState(false)
  const [tipsSheetOpen, setTipsSheetOpen] = useState(false)
  const [successState, setSuccessState] = useState<{
    open: boolean
    observationId: number | null
    imageUrl: string | null
    speciesName: string | null
    count: number
  }>({
    open: false,
    observationId: null,
    imageUrl: null,
    speciesName: null,
    count: 1,
  })

  const draftRestoreTriedRef = useRef(false)
  const draftRestoredSpeciesRef = useRef(false)
  const draftPersistenceDisabledRef = useRef(false)
  const draftSnapshotRef = useRef<ObservationDraftSnapshot>({
    evidenceImages: [],
    photoDrafts: {},
    mediaAnalyses: [],
  })
  const pendingAnalysisImageUrlsRef = useRef(new Set<string>())
  const photoMetadataRef = useRef<Record<string, ObservationPhotoMetadata>>({})
  const placeSearchRequestRef = useRef(0)
  const photoSectionRef = useRef<HTMLElement | null>(null)
  const speciesSectionRef = useRef<HTMLElement | null>(null)
  const locationSectionRef = useRef<HTMLElement | null>(null)
  const speciesAutofillRef = useRef(new Set<string>())
  const mobileSectionRefs = {
    photo: photoSectionRef,
    species: speciesSectionRef,
    location: locationSectionRef,
  }
  const mobilePanels: Record<MobilePanelKey, boolean> = {
    photo: activeMobilePanel === "photo",
    species: activeMobilePanel === "species",
    location: activeMobilePanel === "location",
  }

  draftSnapshotRef.current = { evidenceImages, photoDrafts, mediaAnalyses }

  const allSpecies = useMemo(() => {
    const map = new Map<number, SpeciesOption>()
    for (const option of speciesOptions) {
      map.set(option.id, option)
    }
    return Array.from(map.values())
  }, [speciesOptions])

  const selectedDraft = selectedImageUrl ? photoDrafts[selectedImageUrl] ?? createEmptyPhotoDraft() : null
  const speciesId = selectedDraft?.speciesId ?? ""
  const sex = selectedDraft?.sex ?? ""
  const lifecycleStage = selectedDraft?.lifecycleStage ?? ""
  const observedAt = selectedDraft?.observedAt ?? ""
  const observedAtSource = selectedDraft?.observedAtSource ?? "manual"
  const locationName = selectedDraft?.locationName ?? ""
  const latitude = selectedDraft?.latitude ?? ""
  const longitude = selectedDraft?.longitude ?? ""
  const metadataWarning = selectedDraft?.locationWarning ?? ""

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
    const analysis = selectedImageUrl ? analysisMap.get(selectedImageUrl) : null
    if (!analysis) return []
    return [...analysis.speciesCandidates].sort((left, right) => right.confidence - left.confidence)
  }, [analysisMap, selectedImageUrl])

  const analysisPendingCount = useMemo(
    () =>
      evidenceImages.filter((url) => {
        const status = analysisMap.get(url)?.status
        return !status || status === "pending"
      }).length,
    [analysisMap, evidenceImages],
  )

  const selectedAnalysis = selectedImageUrl ? analysisMap.get(selectedImageUrl) : undefined
  const selectedFailedAnalysis =
    selectedAnalysis
    && selectedAnalysis.status !== "passed"
    && selectedAnalysis.status !== "passed_no_identification"
    && selectedAnalysis.status !== "pending"
      ? selectedAnalysis
      : null

  const safetyFailedAnalyses = useMemo(
    () =>
      evidenceImages
        .map((url) => analysisMap.get(url))
        .filter((analysis): analysis is ObservationMediaAnalysis => Boolean(
          analysis && (analysis.status === "failed_unsafe" || analysis.moderationPass === false),
        )),
    [analysisMap, evidenceImages],
  )
  const eligibleImageUrls = useMemo(
    () => evidenceImages.filter((url) => !safetyFailedAnalyses.some((analysis) => analysis.imageUrl === url)),
    [evidenceImages, safetyFailedAnalyses],
  )
  const analysisFinished = evidenceImages.length > 0 && analysisPendingCount === 0 && !isAnalyzingImages
  const shouldShowSpeciesResults = speciesQuery.trim().length > 0
  const speciesStepLocked = evidenceImages.length === 0
  const identifiedCount = eligibleImageUrls.filter((url) => Boolean(photoDrafts[url]?.speciesId)).length
  const locatedPassedCount = eligibleImageUrls.filter((url) => {
    const draft = photoDrafts[url]
    return Boolean(draft && isPhotoPublishReady(draft))
  }).length
  const publishCount = locatedPassedCount
  const otherUnlocatedCount = evidenceImages.filter((url) => {
    if (url === selectedImageUrl) return false
    const draft = photoDrafts[url]
    return Boolean(draft && !isPhotoLocated(draft))
  }).length
  const locatedUrls = useMemo(
    () => new Set(evidenceImages.filter((url) => photoDrafts[url] && isPhotoLocated(photoDrafts[url]))),
    [evidenceImages, photoDrafts],
  )
  const speciesBadges = useMemo(() => {
    const badges = new Map<string, string>()
    for (const url of evidenceImages) {
      const draft = photoDrafts[url]
      const match = allSpecies.find((option) => String(option.id) === draft?.speciesId)
      badges.set(url, match?.commonName ?? "待鉴定")
    }
    return badges
  }, [allSpecies, evidenceImages, photoDrafts])
  const photoSubjectHint = getObservationSubmitTopicCopy("birds").photoSubjectHint
  const speciesStepStatus = identifiedCount > 0
    ? `${identifiedCount}/${Math.max(eligibleImageUrls.length, 1)} 已鉴定`
    : speciesStepLocked
      ? "待上传"
      : analysisPendingCount > 0 || isAnalyzingImages
        ? "识别建议生成中"
        : "可选"

  const updatePhotoDraft = useCallback((url: string, patch: Partial<ObservationPhotoDraft>) => {
    setPhotoDrafts((current) => {
      const existing = current[url] ?? createEmptyPhotoDraft()
      return { ...current, [url]: { ...existing, ...patch } }
    })
  }, [])

  const handleEvidenceChange = useCallback((urls: string[]) => {
    setEvidenceImages(urls)
    setPhotoDrafts((current) => syncPhotoDrafts(urls, current))
    setSelectedImageUrl((current) => {
      if (current && urls.includes(current)) return current
      return urls[0] ?? null
    })
  }, [])

  const locationReady = selectedDraft ? isPhotoLocated(selectedDraft) : false
  const unlocatedPassedUrls = eligibleImageUrls.filter((url) => {
    const draft = photoDrafts[url]
    return !draft || !isPhotoPublishReady(draft)
  })
  const locationAndTimeReady = unlocatedPassedUrls.length === 0 && eligibleImageUrls.length > 0
  const safetyCheckReady = safetyFailedAnalyses.length === 0
  const canSubmit = locationAndTimeReady && safetyCheckReady
  const observationProgressCount = userStats?.observationsSubmitted
  const displayedObservationCount = observationProgressCount ?? 0
  const nextObserverThreshold = getNextObserverThreshold(displayedObservationCount)
  const observerProgressValue = getProgressValue(displayedObservationCount, nextObserverThreshold)
  const observerProgressKnown = typeof observationProgressCount === "number"

  const tryLocate = useCallback(async (withToast: boolean) => {
    if (!selectedImageUrl) {
      if (withToast) toast({ title: "请先选择一张照片", variant: "destructive" })
      return
    }
    if (!navigator.geolocation) {
      if (withToast) {
        toast({ title: "当前设备不支持定位", variant: "destructive" })
      }
      return
    }

    const imageUrl = selectedImageUrl
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const converted = await convertGpsToAmap(position.coords.latitude, position.coords.longitude)
        if (!converted) {
          setIsLocating(false)
          if (withToast) toast({ title: "坐标转换失败，请在地图上选点", variant: "destructive" })
          return
        }
        const lat = converted.latitude
        const lng = converted.longitude
        let name: string | null = null
        try {
          name = await reverseGeocode(lat, lng)
        } finally {
          setIsLocating(false)
        }

        updatePhotoDraft(imageUrl, {
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
          locationSource: "device_location",
          locationWarning: "",
          ...(name ? { locationName: name } : {}),
        })
        placeSearchRequestRef.current += 1
        setPlaceResults([])
        setPlaceSearchUnavailable(false)

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
  }, [selectedImageUrl, toast, updatePhotoDraft])

  useEffect(() => {
    if (draftRestoreTriedRef.current || typeof window === "undefined") return
    draftRestoreTriedRef.current = true

    try {
      const rawDraft = window.localStorage.getItem(OBSERVATION_DRAFT_KEY)
      if (!rawDraft) return

      const draft = normalizeObservationDraft(JSON.parse(rawDraft))
      if (!draft) {
        clearObservationDraft()
        return
      }

      setEvidenceImages(draft.evidenceImages)
      setPhotoDrafts(syncPhotoDrafts(draft.evidenceImages, draft.photoDrafts))
      setSelectedImageUrl(draft.evidenceImages[0] ?? null)
      setMediaAnalyses(draft.mediaAnalyses)
      const firstDraft = draft.evidenceImages[0] ? draft.photoDrafts[draft.evidenceImages[0]] : null
      draftRestoredSpeciesRef.current = Boolean(firstDraft?.speciesId)
      if (firstDraft?.speciesId) {
        const match = speciesOptions.find((option) => String(option.id) === firstDraft.speciesId)
        setSpeciesQuery(match?.commonName ?? "")
      }

      toast({ title: "已恢复本地草稿" })
    } catch {
      clearObservationDraft()
      setDraftSaveStatus("error")
    } finally {
      setDraftReady(true)
    }
  }, [speciesOptions, toast])

  useEffect(() => {
    if (!draftReady || draftPersistenceDisabledRef.current) return

    if (evidenceImages.length === 0) {
      setDraftSaveStatus(persistObservationDraft(draftSnapshotRef.current) ? "idle" : "error")
      return
    }

    setDraftSaveStatus("saving")
    const timeout = window.setTimeout(() => {
      if (draftPersistenceDisabledRef.current) return
      setDraftSaveStatus(persistObservationDraft(draftSnapshotRef.current) ? "saved" : "error")
    }, 500)

    return () => window.clearTimeout(timeout)
  }, [draftReady, evidenceImages, mediaAnalyses, photoDrafts])

  useEffect(() => {
    const handlePageHide = () => {
      if (!draftReady || draftPersistenceDisabledRef.current) return
      setDraftSaveStatus(persistObservationDraft(draftSnapshotRef.current) ? "saved" : "error")
    }

    window.addEventListener("pagehide", handlePageHide)
    return () => window.removeEventListener("pagehide", handlePageHide)
  }, [draftReady])

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
    if (!selectedImageUrl) {
      setSpeciesQuery("")
      return
    }
    const match = allSpecies.find((option) => String(option.id) === speciesId)
    setSpeciesQuery(match?.commonName ?? "")
  }, [allSpecies, selectedImageUrl, speciesId])

  useEffect(() => {
    placeSearchRequestRef.current += 1
    setPlaceResults([])
    setPlaceSearchUnavailable(false)
  }, [selectedImageUrl])

  useEffect(() => {
    if (!initialSpecies || draftRestoredSpeciesRef.current) return
    if (evidenceImages.length === 0) return
    const url = evidenceImages[0]
    updatePhotoDraft(url, { speciesId: String(initialSpecies.id) })
    draftRestoredSpeciesRef.current = true
    if (url === selectedImageUrl) {
      setSpeciesQuery(initialSpecies.commonName)
    }
  }, [evidenceImages, initialSpecies, selectedImageUrl, updatePhotoDraft])

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

  useEffect(() => {
    if (evidenceImages.length === 0) {
      speciesAutofillRef.current.clear()
    }
  }, [evidenceImages.length])

  useEffect(() => {
    if (evidenceImages.length === 0) return

    setPhotoDrafts((current) => {
      let changed = false
      const next = { ...current }
      for (const url of evidenceImages) {
        if (speciesAutofillRef.current.has(url)) continue
        const analysis = analysisMap.get(url)
        if (analysis?.status !== "passed") continue
        const top = [...analysis.speciesCandidates].sort((left, right) => right.confidence - left.confidence)[0]
        if (!top) continue
        const draft = next[url] ?? createEmptyPhotoDraft()
        if (draft.speciesId) {
          speciesAutofillRef.current.add(url)
          continue
        }
        next[url] = { ...draft, speciesId: String(top.speciesId) }
        speciesAutofillRef.current.add(url)
        changed = true
      }
      return changed ? next : current
    })
  }, [analysisMap, evidenceImages])

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

  const handleSpeciesSelect = (option: SpeciesOption) => {
    if (!selectedImageUrl) return
    updatePhotoDraft(selectedImageUrl, { speciesId: String(option.id) })
    setSpeciesQuery(option.commonName)
  }

  const handleCandidateSelect = (candidate: SpeciesCandidate, closeSheet = false) => {
    const option = allSpecies.find((item) => item.id === candidate.speciesId)
    if (option) {
      handleSpeciesSelect(option)
    } else if (selectedImageUrl) {
      updatePhotoDraft(selectedImageUrl, { speciesId: String(candidate.speciesId) })
      setSpeciesQuery(candidate.commonName)
    }

    if (closeSheet) {
      setSpeciesSheetOpen(false)
    }
  }

  const toggleMobilePanel = (panel: MobilePanelKey) => openMobilePanel(panel)

  const getAnalysisBlockerDescription = () => {
    const blockingFailure = safetyFailedAnalyses[0]
    if (blockingFailure) {
      return blockingFailure.moderationReason || "这张照片未通过安全检查，请移除后再发布"
    }

    return "图片识别只提供物种建议，不影响发布；安全审核会在提交时再次检查。"
  }

  const getSubmitBlocker = (): SubmitBlocker | null => {
    if (evidenceImages.length === 0) {
      return { panel: "photo", label: "照片", title: "请先上传一张照片" }
    }

    if (!safetyCheckReady) {
      return {
        panel: "photo",
        label: "安全检查",
        title: "请移除未通过安全检查的照片",
        description: getAnalysisBlockerDescription(),
      }
    }

    if (!locationAndTimeReady) {
      return {
        panel: "location",
        label: "地点和时间",
        title: "请为每张可发布的照片确认地点",
        description: "没有 GPS 的照片需要搜索选择地点或在地图上选点。",
      }
    }

    return null
  }

  const guideToSubmitBlocker = (blocker = getSubmitBlocker()) => {
    if (!blocker) return false

    if (blocker.panel === "location" && unlocatedPassedUrls[0]) {
      setSelectedImageUrl(unlocatedPassedUrls[0])
    }

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
    setPhotoDrafts({})
    setSelectedImageUrl(null)
    setMediaAnalyses([])
    setPlaceResults([])
    setPlaceSearchUnavailable(false)
    placeSearchRequestRef.current += 1
    photoMetadataRef.current = {}
    speciesAutofillRef.current.clear()
    setSpeciesQuery(initialSpecies?.commonName ?? "")
    draftPersistenceDisabledRef.current = false
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

    const publishableUrls = eligibleImageUrls.filter((url) => {
      const draft = photoDrafts[url]
      return draft && isPhotoPublishReady(draft)
    })

    if (publishableUrls.length === 0) {
      toast({ title: "先上传一张照片", variant: "destructive" })
      return
    }

    if (!locationAndTimeReady) {
      toast({ title: "请确认每张照片的地点和时间", description: "没有 GPS 的照片需要搜索选择地点或在地图上选点。", variant: "destructive" })
      openMobilePanel("location")
      return
    }

    setIsSubmitting(true)

    try {
      const items = publishableUrls.map((url) => {
        const draft = photoDrafts[url] ?? createEmptyPhotoDraft()
        const observedAtValue = isPhotoTimeReady(draft) ? draft.observedAt : nowLocalDateTimeInput()
        return {
          media_url: url,
          observed_at: new Date(observedAtValue).toISOString(),
          observed_at_source: draft.observedAtSource,
          location_name: draft.locationName.trim(),
          location_source: draft.locationSource,
          coordinate_system: "gcj02",
          latitude: Number(draft.latitude),
          longitude: Number(draft.longitude),
          initial_species_id: draft.speciesId ? Number(draft.speciesId) : null,
          lifecycle_stage: draft.lifecycleStage || null,
          sex: draft.sex || null,
        }
      })

      const submitObservationRequest = () => fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_public: true,
          items,
        }),
      })

      let response = await submitObservationRequest()
      let errorPayload = await getApiErrorPayload(response)
      if (!response.ok && isAgeConfirmationRequired(errorPayload)) {
        response = await runAfterAgeConfirmation(submitObservationRequest, {
          redirectTo: getInteractionAccessRedirect(errorPayload) ?? undefined,
        })
        errorPayload = await getApiErrorPayload(response)
      }

      const payload = (await response.json().catch(() => ({}))) as Partial<SubmitResponse> & { error?: string }
      if (!response.ok || !payload.observation) {
        throw new Error(getApiErrorMessageFromPayload(errorPayload, "提交失败"))
      }

      dispatchObservationCreated()
      router.refresh()
      draftPersistenceDisabledRef.current = true
      clearObservationDraft()

      const created = payload.observations?.length ? payload.observations : [payload.observation]
      const firstDraft = photoDrafts[publishableUrls[0]]
      const firstSpecies = allSpecies.find((option) => String(option.id) === firstDraft?.speciesId)

      setSuccessState({
        open: true,
        observationId: created[0]?.id ?? payload.observation.id,
        imageUrl: publishableUrls[0] ?? null,
        speciesName: firstSpecies?.commonName ?? null,
        count: created.length,
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
  const mobileSubmitReady = canSubmit && !isSubmitting

  const speciesStatusTone =
    selectedSpecies
      ? "success"
      : analysisPendingCount > 0 || isAnalyzingImages
        ? "loading"
        : speciesStepLocked
          ? "neutral"
          : "warning"

  const updateObservedDate = (date: string) => {
    if (!selectedImageUrl) return
    updatePhotoDraft(selectedImageUrl, {
      observedAtSource: "manual",
      observedAt: `${date}T${observedTime || "00:00"}`,
    })
  }

  const updateObservedTime = (time: string) => {
    if (!selectedImageUrl) return
    if (observedDate) {
      updatePhotoDraft(selectedImageUrl, {
        observedAtSource: "manual",
        observedAt: `${observedDate}T${time || "00:00"}`,
      })
    }
  }

  const handleMapChange = useCallback((coords: { latitude: string; longitude: string }) => {
    if (!selectedImageUrl) return
    placeSearchRequestRef.current += 1
    setPlaceResults([])
    setPlaceSearchUnavailable(false)
    updatePhotoDraft(selectedImageUrl, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      locationSource: "map_pin",
      locationWarning: "",
    })
  }, [selectedImageUrl, updatePhotoDraft])

  const handleLocationNameSuggestion = useCallback((name: string) => {
    if (!selectedImageUrl) return
    placeSearchRequestRef.current += 1
    updatePhotoDraft(selectedImageUrl, { locationName: name, locationWarning: "" })
    setPlaceResults([])
    setPlaceSearchUnavailable(false)
  }, [selectedImageUrl, updatePhotoDraft])

  const handlePhotoMetadata = useCallback(async (items: Array<ObservationPhotoMetadata & { imageUrl: string }>) => {
    for (const item of items) {
      photoMetadataRef.current[item.imageUrl] = item
      const result = await resolveObservationPhotoMetadataAutofill({
        metadata: item,
        convertGpsToMap: convertGpsToAmap,
        reverseGeocode,
      })

      updatePhotoDraft(item.imageUrl, {
        ...(result.observedAt ? { observedAt: result.observedAt, observedAtSource: "photo_exif" } : {}),
        ...(result.latitude && result.longitude
          ? {
              latitude: result.latitude,
              longitude: result.longitude,
              locationSource: "photo_exif",
              locationName: result.locationName ?? "",
            }
          : {}),
        locationWarning: result.warning ?? "",
      })
    }
    placeSearchRequestRef.current += 1
    setPlaceResults([])
    setPlaceSearchUnavailable(false)
  }, [updatePhotoDraft])

  const handleLocationInput = useCallback(async (value: string) => {
    if (!selectedImageUrl) return
    const requestId = placeSearchRequestRef.current + 1
    placeSearchRequestRef.current = requestId
    setPhotoDrafts((current) => {
      const existing = current[selectedImageUrl] ?? createEmptyPhotoDraft()
      return {
        ...current,
        // A typed name is a new manual choice. Clear the old GPS so the
        // submitted name and coordinates can never point to different places.
        [selectedImageUrl]: setManualLocationName(existing, value),
      }
    })
    setPlaceResults([])
    setPlaceSearchUnavailable(false)
    if (value.trim().length < 2) {
      setIsSearchingPlaces(false)
      return
    }
    setIsSearchingPlaces(true)
    try {
      const existing = photoDrafts[selectedImageUrl] ?? createEmptyPhotoDraft()
      const center = existing.latitude.trim() && existing.longitude.trim()
        ? { latitude: Number(existing.latitude), longitude: Number(existing.longitude) }
        : undefined
      const result = await searchPlacesNear(value.trim(), center)
      if (requestId === placeSearchRequestRef.current) {
        setPlaceResults(result.places)
        setPlaceSearchUnavailable(!result.configured)
      }
    } finally {
      if (requestId === placeSearchRequestRef.current) setIsSearchingPlaces(false)
    }
  }, [photoDrafts, selectedImageUrl])

  const handlePlaceSelect = useCallback((place: PlaceSearchResult) => {
    if (!selectedImageUrl) return
    placeSearchRequestRef.current += 1
    updatePhotoDraft(selectedImageUrl, {
      locationName: place.name,
      latitude: place.latitude.toFixed(6),
      longitude: place.longitude.toFixed(6),
      locationSource: "place_search",
      locationWarning: "",
    })
    setPlaceResults([])
    setPlaceSearchUnavailable(false)
  }, [selectedImageUrl, updatePhotoDraft])

  const handleApplyLocationToUnlocated = useCallback(() => {
    if (!selectedDraft || !isPhotoLocated(selectedDraft)) return
    const source = selectedDraft
    setPhotoDrafts((current) => {
      const next = { ...current }
      for (const url of evidenceImages) {
        if (url === selectedImageUrl) continue
        const draft = next[url]
        if (draft && !isPhotoLocated(draft)) {
          next[url] = copyLocationToDraft(draft, source)
        }
      }
      return next
    })
    toast({ title: "已用到其余未定位的照片" })
  }, [evidenceImages, selectedDraft, selectedImageUrl, toast])

  const visibilityLabel = "公开记录 · 准确位置"
  const precisionLabel = "准确位置"
  const previewImage = selectedImageUrl ?? evidenceImages[0] ?? null
  const previewSpeciesName = selectedSpecies?.commonName || speciesQuery.trim() || "待共同鉴定"
  const previewScientificName = selectedSpecies?.scientificName || "AI 和社区用户可参与鉴定"
  const qualityChecks = [
    { label: "已提供初步鉴定（可选）", done: identifiedCount > 0 },
    { label: "已上传至少 1 张照片", done: evidenceImages.length > 0 },
    { label: "每张可发布照片已填写时间和地点", done: locationAndTimeReady },
    { label: "图片安全检查通过", done: safetyCheckReady },
  ]
  const requiredChecks = [
    evidenceImages.length > 0,
    safetyCheckReady,
    locationAndTimeReady,
  ]
  const requiredReadyCount = requiredChecks.filter(Boolean).length
  const requiredReadyValue = getProgressValue(requiredReadyCount, requiredChecks.length)
  const trimmedLocationName = locationName.trim()
  const locationSummary = locationReady
    ? `${trimmedLocationName} · ${precisionLabel}`
    : trimmedLocationName
      ? "还需要地图选点"
      : "填写地点并确认地图"
  const locationStepStatus = eligibleImageUrls.length > 0
    ? `${locatedPassedCount}/${eligibleImageUrls.length} 已定位`
    : locationReady
      ? "已填写"
      : "待填写"
  const locationStepTone: StepStatusTone = locationAndTimeReady ? "success" : "warning"
  const submitActionLabel = publishCount > 0 ? `发布 ${publishCount} 条观察` : "发布观察"
  const speciesSummary = selectedSpecies
    ? selectedSpecies.commonName
    : suggestedCandidates[0]
      ? `推荐：${suggestedCandidates[0].commonName}`
      : speciesStepLocked
        ? "上传照片后开始识别"
        : "可发布后请社区共同鉴定"
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
          "w-full rounded-xs border p-3 text-left transition",
          active
            ? "border-(--obs-accent) bg-(--obs-accent-soft) [box-shadow:var(--obs-soft-shadow)]"
            : "border-(--obs-border) bg-(--obs-control) hover:border-(--obs-accent) hover:bg-(--obs-control-hover)",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-(--obs-text)">{candidate.commonName}</div>
            <div className="mt-1 truncate text-xs italic text-(--obs-muted-2)">
              {candidate.scientificName || "候选物种"}
            </div>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", active ? "bg-(--obs-accent) text-white" : "bg-(--obs-accent-panel) text-(--obs-accent-text)")}>
            {confidence}%
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-(--obs-border)">
          <div className="h-full rounded-full bg-(--obs-accent)" style={{ width: `${confidence}%` }} />
        </div>
        <p className="mt-2 line-clamp-2 whitespace-normal wrap-break-word text-[13px] leading-6 text-(--obs-muted-2)">
          {candidate.reason || "图片特征与该候选较接近"}
        </p>
      </button>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="observation-submit-theme relative pb-36 md:pb-10">
        <div className="pointer-events-none absolute inset-x-0 -top-10 h-56 [background:radial-gradient(circle_at_18%_10%,var(--obs-glow-a),transparent_30%),radial-gradient(circle_at_82%_12%,var(--obs-glow-b),transparent_28%)] md:-inset-x-8" />

        <div className="sticky top-[calc(var(--mobile-global-header-height,0rem)+env(safe-area-inset-top))] z-30 mb-4 rounded-sm border border-(--obs-border) bg-(--obs-panel) px-3 py-2.5 shadow-[0_12px_30px_-26px_hsl(var(--surface-shadow)/0.42)] backdrop-blur-xl md:hidden">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="font-semibold text-(--obs-text)">发布准备 {requiredReadyCount}/{requiredChecks.length}</span>
            {submitBlocker ? (
              <button
                type="button"
                onClick={() => guideToSubmitBlocker(submitBlocker)}
                className="text-xs font-semibold text-(--obs-accent-text) underline decoration-(--obs-accent)/35 underline-offset-4"
              >
                还差{submitMissingLabel}
              </button>
            ) : (
              <span className="text-xs font-semibold text-(--obs-accent-text)">可以发布</span>
            )}
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-(--obs-border)">
            <div
              className="h-full rounded-full bg-(--obs-accent) transition-[width] duration-500"
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
                  description="AI 会自动尝试鉴定主体，照片越清晰越容易识别。"
                  icon={Camera}
                  status={`${evidenceImages.length}/5`}
                  statusTone={evidenceImages.length > 0 ? "success" : "neutral"}
                />
              </div>
              <MobileAccordionHeader
                index={1}
                title="上传照片"
                icon={Camera}
                status={`${evidenceImages.length}/5`}
                statusTone={evidenceImages.length > 0 ? "success" : "neutral"}
                summary={evidenceImages.length > 0 ? "照片已进入识别流程" : "先添加一张清晰照片"}
                open={mobilePanels.photo}
                onToggle={() => toggleMobilePanel("photo")}
              />
              <div className={cn("mt-4 md:mt-0", mobilePanelContentClass("photo"))}>
                <p className="mb-3 text-sm leading-6 text-(--obs-muted)">
                  {photoSubjectHint}
                </p>
                <ObservationSubmitPhotoSection
                  evidenceImages={evidenceImages}
                  onEvidenceChange={handleEvidenceChange}
                  analyses={mediaAnalyses}
                  isAnalyzing={isAnalyzingImages}
                  showHeader={false}
                  onPhotoMetadata={handlePhotoMetadata}
                />
                <div className="mt-4 flex justify-end md:hidden">
                  <button
                    type="button"
                    onClick={() => setTipsSheetOpen(true)}
                    className="inline-flex min-h-9 items-center gap-1.5 px-1 text-xs font-medium text-(--obs-accent-text) transition-colors hover:text-(--obs-accent-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--obs-accent)"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    拍摄建议
                  </button>
                </div>
                <MobileStepFooter
                  actionLabel={evidenceImages.length > 0 ? "继续按张鉴定" : "先上传照片"}
                  disabled={evidenceImages.length === 0}
                  onNext={() => openMobilePanel("species")}
                  helper={
                    evidenceImages.length > 0
                      ? "识别结果只是建议，不确定物种也可以继续填写地点并发布。"
                      : "上传照片后会自动读取照片拍摄时间和 GPS（如果照片包含这些信息）。"
                  }
                />
              </div>
            </section>

            <section ref={speciesSectionRef} className={cn(panelClass, speciesStepLocked && "opacity-90")}>
              <div className="hidden md:block">
                <StepHeader
                  index={2}
                  title="按张鉴定"
                  description="点选一张照片，为这张填写物种、性别和生命阶段。不确定也可以先发布为待鉴定。"
                  icon={Bird}
                  status={speciesStepStatus}
                  statusTone={speciesStatusTone}
                />
              </div>
              <MobileAccordionHeader
                index={2}
                title="按张鉴定"
                icon={Bird}
                status={speciesStepStatus}
                statusTone={speciesStatusTone}
                summary={speciesSummary}
                open={mobilePanels.species}
                onToggle={() => toggleMobilePanel("species")}
              />

              <div className={cn("mt-4 md:mt-0", mobilePanelContentClass("species"))}>
              {evidenceImages.length > 1 ? (
                <div className="mb-4">
                  <ObservationPhotoStrip
                    images={evidenceImages}
                    selectedUrl={selectedImageUrl}
                    onSelect={setSelectedImageUrl}
                    badges={speciesBadges}
                  />
                </div>
              ) : null}
              {selectedFailedAnalysis ? (
                <div className="mb-4 rounded-xs border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-[#6d5c32] dark:bg-[#332d20] dark:text-[#f3d889]">
                  {selectedFailedAnalysis.status === "failed_unsafe"
                    ? selectedFailedAnalysis.moderationReason || "这张图片不适合用于自然观察提交，请更换照片。"
                    : selectedFailedAnalysis.status === "failed_low_quality"
                      ? selectedFailedAnalysis.qualityReason || "图片不够清晰，请重拍后再试。"
                      : selectedFailedAnalysis.status === "failed_unrecognized"
                        ? "这是旧版未识别结果，请重新上传照片触发新的鉴定流程。"
                        : selectedFailedAnalysis.moderationReason || "图片识别失败，请删除后重新上传。"}
                </div>
              ) : null}

              {suggestedCandidates.length > 0 ? (
                <div className={cn(subtlePanelClass, "mb-4 space-y-3")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-(--obs-text)">
                      <Info className="h-4 w-4 text-(--obs-accent)" />
                      AI 鉴定候选
                    </div>
                    <span className="text-xs text-(--obs-muted-2)">置信度仅供参考</span>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {renderCandidateButton(suggestedCandidates[0])}
                    {suggestedCandidates.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full rounded-sm border-(--obs-border-strong) bg-(--obs-control) text-(--obs-text) hover:bg-(--obs-control-hover) hover:text-(--obs-text)"
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
              ) : analysisFinished ? (
                <div className="mb-4 rounded-xs border border-(--obs-border) bg-(--obs-control) px-4 py-3 text-sm text-(--obs-muted)">
                  当前图片没有匹配到可靠的物种候选。你仍可手动提交鉴定，或发布为待鉴定。
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--obs-muted-2)" />
                  <Input
                    value={speciesQuery}
                    onChange={(event) => {
                      setSpeciesQuery(event.target.value)
                      if (!event.target.value.trim() && selectedImageUrl) {
                        updatePhotoDraft(selectedImageUrl, { speciesId: "" })
                      }
                    }}
                    placeholder={speciesStepLocked ? "先上传照片" : "搜索更多物种名称..."}
                    disabled={speciesStepLocked}
                    className={cn(controlClass, "pl-10 pr-10")}
                  />
                  {isSearchingSpecies ? (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-(--obs-muted-2)" />
                  ) : null}
                </div>

                {!speciesStepLocked && shouldShowSpeciesResults ? (
                  <div className="overflow-hidden rounded-xs border border-(--obs-border) bg-(--obs-control)">
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
                              "flex w-full items-center justify-between gap-3 border-b border-(--obs-border) px-4 py-3 text-left transition last:border-b-0 hover:bg-(--obs-control-hover)",
                              isSelected && "bg-(--obs-accent-soft) ring-1 ring-inset ring-(--obs-focus)",
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold text-(--obs-text)">{option.commonName}</div>
                                {aiCandidate ? (
                                  <Badge variant="outline" className="border-(--obs-accent) bg-(--obs-accent-panel) text-(--obs-accent-text)">
                                    AI 鉴定 {Math.round(aiCandidate.confidence * 100)}%
                                  </Badge>
                                ) : null}
                              </div>
                              {option.scientificName ? (
                                <div className="mt-0.5 truncate text-xs italic text-(--obs-muted-2)">{option.scientificName}</div>
                              ) : null}
                            </div>
                            {isSelected ? (
                              <span className="rounded-full bg-(--obs-accent) px-2.5 py-1 text-xs font-medium text-white">
                                我的鉴定
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-(--obs-muted-2)" />
                            )}
                          </button>
                        )
                      })}
                  </div>
                ) : !speciesStepLocked ? (
                  <div className="rounded-xs border border-(--obs-border) bg-(--obs-control) px-4 py-3 text-sm text-(--obs-muted)">
                    可以直接发布为待鉴定；如要提交自己的鉴定，请在上方搜索物种。
                  </div>
                ) : null}

                {selectedSpecies ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="text-xs font-medium text-(--obs-muted)">生命阶段（可选）</span>
                      <select
                        value={lifecycleStage}
                        onChange={(event) => {
                          if (!selectedImageUrl) return
                          updatePhotoDraft(selectedImageUrl, {
                            lifecycleStage: event.target.value as ObservationPhotoDraft["lifecycleStage"],
                          })
                        }}
                        className={cn(controlClass, "appearance-none bg-no-repeat px-3 text-sm")}
                      >
                        <option value="">未注明</option>
                        {observationLifecycleStageOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="text-xs font-medium text-(--obs-muted)">性别（可选）</span>
                      <select
                        value={sex}
                        onChange={(event) => {
                          if (!selectedImageUrl) return
                          updatePhotoDraft(selectedImageUrl, {
                            sex: event.target.value as ObservationPhotoDraft["sex"],
                          })
                        }}
                        className={cn(controlClass, "appearance-none bg-no-repeat px-3 text-sm")}
                      >
                        <option value="">未注明</option>
                        {observationSexOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                <MobileStepFooter
                  actionLabel={speciesStepLocked ? "先上传照片" : "继续填写地点"}
                  disabled={speciesStepLocked}
                  onNext={() => openMobilePanel("location")}
                  helper={selectedSpecies ? "已保存这张照片的物种鉴定。" : "不确定物种也可以继续发布，审核通过后社区可参与共同鉴定。"}
                />
              </div>
              </div>
            </section>

            <section ref={locationSectionRef} className={panelClass}>
              <div className="hidden md:block">
                <StepHeader
                  index={3}
                  title="按张确认地点"
                  description="每张照片都要有自己的观察时间和准确坐标。"
                  icon={MapPin}
                  status={locationStepStatus}
                  statusTone={locationStepTone}
                />
              </div>
              <MobileAccordionHeader
                index={3}
                title="地点与时间"
                icon={MapPin}
                status={locationStepStatus}
                statusTone={locationStepTone}
                summary={locationSummary}
                open={mobilePanels.location}
                onToggle={() => toggleMobilePanel("location")}
              />

              <div className={cn("mt-4 md:mt-0", mobilePanelContentClass("location"))}>
              {evidenceImages.length > 1 ? (
                <div className="mb-4">
                  <ObservationPhotoStrip
                    images={evidenceImages}
                    selectedUrl={selectedImageUrl}
                    onSelect={setSelectedImageUrl}
                    locatedUrls={locatedUrls}
                  />
                  <p className="mt-2 text-xs text-(--obs-muted)">
                    绿点表示这张已定位，黄点表示还需要选点。
                  </p>
                </div>
              ) : null}
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel htmlFor="observedDate">观察日期</FieldLabel>
                      <div className="relative">
                        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--obs-muted-2)" />
                        <Input
                          id="observedDate"
                          type="date"
                          value={observedDate}
                          onChange={(event) => updateObservedDate(event.target.value)}
                          className={cn(controlClass, "pl-10")}
                        />
                      </div>
                      {observedAtSource === "photo_exif" ? <p className="text-xs text-(--obs-accent-text)">来自照片拍摄信息</p> : null}
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="observedTime">观察时间</FieldLabel>
                      <div className="relative">
                        <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--obs-muted-2)" />
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

                  <ObservationLocationPicker
                    locationName={locationName}
                    latitude={latitude}
                    longitude={longitude}
                    placeResults={placeResults}
                    placeSearchUnavailable={placeSearchUnavailable}
                    isSearchingPlaces={isSearchingPlaces}
                    isLocating={isLocating}
                    metadataWarning={metadataWarning}
                    onLocationInput={(value) => void handleLocationInput(value)}
                    onPlaceSelect={handlePlaceSelect}
                    onMapChange={handleMapChange}
                    onLocationNameSuggestion={handleLocationNameSuggestion}
                    onUseCurrentLocation={() => void tryLocate(true)}
                    controlClassName={controlClass}
                  />

                  {selectedDraft && isPhotoLocated(selectedDraft) && otherUnlocatedCount > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-sm border-(--obs-accent) bg-(--obs-accent-soft) text-(--obs-accent-text) hover:bg-(--obs-accent-panel) hover:text-(--obs-accent-text)"
                      onClick={handleApplyLocationToUnlocated}
                    >
                      用到其余 {otherUnlocatedCount} 张还没定位的照片
                    </Button>
                  ) : null}

              </div>
              <MobileStepFooter
                actionLabel={locationAndTimeReady ? "信息已齐全，可发布" : "先完善地点和时间"}
                disabled
                onNext={() => undefined}
                helper={
                  locationAndTimeReady
                    ? "地点和时间已确认，可以发布。"
                    : "还需要确认地点和时间。"
                }
              />
              </div>
            </section>

            <div className="hidden items-center gap-3 rounded-xs border border-(--obs-border) bg-(--obs-subtle) p-3 md:flex">
              <DraftSaveIndicator status={draftSaveStatus} className="mr-auto" />
              <Button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="h-12 flex-1 rounded-sm bg-(--obs-accent) text-base font-semibold text-white hover:bg-(--obs-accent-strong)"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {submitActionLabel}
                  </>
                )}
              </Button>
            </div>
          </div>

          <aside className="hidden min-w-0 space-y-4 md:block xl:sticky xl:top-24 xl:self-start">
            <section className={panelClass}>
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-(--obs-text)">
                <Eye className="h-4 w-4 text-(--obs-accent)" />
                观察预览
              </div>
              <div className="grid gap-4 sm:grid-cols-[176px_minmax(0,1fr)] xl:grid-cols-1">
                <div className="relative aspect-4/3 overflow-hidden rounded-xs border border-(--obs-border-strong) bg-(--obs-control)">
                  {previewImage ? (
                    <OptimizedImage src={previewImage} alt="观察预览" fill variant="cover" className="object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center [background:var(--obs-photo-bg)] text-(--obs-muted-2)">
                      <Camera className="h-9 w-9" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-(--obs-text)">{previewSpeciesName}</h3>
                  <p className="mt-1 truncate text-sm italic text-(--obs-muted)">{previewScientificName}</p>
                  <div className="mt-3 space-y-2 text-sm text-(--obs-muted)">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-(--obs-accent)" />
                      <span className="truncate">{locationName.trim() || "待填写地点"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 shrink-0 text-(--obs-accent)" />
                      <span>{formatObservedAt(observedAt)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-(--obs-accent) bg-(--obs-accent-panel) text-(--obs-accent-text)">
                      {precisionLabel}
                    </Badge>
                    <Badge variant="outline" className="border-(--obs-border-strong) bg-(--obs-control) text-(--obs-muted)">
                      {visibilityLabel}
                    </Badge>
                  </div>
                </div>
              </div>
            </section>

            <section className={panelClass}>
              <div className="flex items-center gap-2 text-sm font-semibold text-(--obs-text)">
                <Gift className="h-4 w-4 text-amber-500 dark:text-amber-300" />
                观察家进度
              </div>
              <div className="mt-4 rounded-xs border border-(--obs-border) bg-(--obs-control) p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-(--obs-text)">
                      {observerProgressKnown ? `${displayedObservationCount} / ${nextObserverThreshold} 条` : "同步中"}
                    </p>
                    <p className="mt-1 text-xs text-(--obs-muted-2)">每条审核通过后发放 +{DEFAULT_XP_REWARD} 探索经验</p>
                  </div>
                  <span className="grid h-12 w-12 place-items-center rounded-xs bg-(--obs-accent-soft) text-(--obs-accent-text)">
                    <Sparkles className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-(--obs-border)">
                  <div
                    className="h-full rounded-full bg-(--obs-accent) transition-[width] duration-500"
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
                            ? "border-emerald-500 bg-(--obs-accent) text-white"
                            : current
                              ? "border-(--obs-accent) bg-(--obs-accent-soft) text-(--obs-accent-text)"
                              : "border-(--obs-border-strong) bg-(--obs-control) text-(--obs-muted-2)",
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
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-(--obs-text)">
                <Target className="h-4 w-4 text-(--obs-accent)" />
                野外观察小贴士
              </div>
              <ul className="space-y-2 text-sm leading-6 text-(--obs-muted)">
                <li>尽量在自然光下拍摄，保持画面清晰。</li>
                <li>拍摄时包含多个角度，如整体、特征部位。</li>
                <li>记录生境环境，如水域、树林、草地等。</li>
                <li>保持安全距离，不打扰、不采摘、不捕捉，保护自然。</li>
              </ul>
            </section>

            <section className={panelClass}>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-(--obs-text)">
                <ClipboardCheck className="h-4 w-4 text-(--obs-accent)" />
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

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-(--obs-border) bg-(--obs-panel) px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_42px_-34px_hsl(var(--surface-shadow)/0.42)] backdrop-blur-xl md:hidden">
          <div className="mx-auto w-full max-w-md">
            <DraftSaveIndicator status={draftSaveStatus} className="mb-2 px-1" />
            <Button
              type="submit"
              data-disabled={!mobileSubmitReady}
              onClick={handleMobileSubmitClick}
              className={cn(
                "h-12 w-full min-w-0 rounded-sm text-sm font-semibold transition-colors min-[390px]:text-base",
                mobileSubmitReady
                  ? "bg-(--obs-accent) text-[#f7fff8] [box-shadow:var(--obs-soft-shadow)] hover:bg-(--obs-accent-strong)"
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
                  {mobileSubmitReady ? submitActionLabel : `还差${submitMissingLabel}`}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <Sheet open={speciesSheetOpen} onOpenChange={setSpeciesSheetOpen}>
        <SheetContent
          side="bottom"
          className="observation-submit-theme max-h-[72dvh] overflow-y-auto rounded-t-md border-(--obs-border) px-4 pb-6 pt-5 [background:var(--obs-panel)]"
        >
          <SheetHeader className="mb-4 pr-8 text-left">
            <SheetTitle className="text-(--obs-text)">AI 候选物种</SheetTitle>
            <SheetDescription className="text-(--obs-muted)">
              选择最接近照片特征的候选，也可以回到表单手动搜索。
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3">
            {suggestedCandidates.map((candidate) => renderCandidateButton(candidate, true))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={tipsSheetOpen} onOpenChange={setTipsSheetOpen}>
        <SheetContent
          side="bottom"
          className="observation-submit-theme rounded-t-md border-(--obs-border) px-4 pb-6 pt-5 [background:var(--obs-panel)]"
        >
          <SheetHeader className="mb-4 pr-8 text-left">
            <SheetTitle className="text-(--obs-text)">野外观察小贴士</SheetTitle>
          </SheetHeader>
          <ul className="space-y-2 text-sm leading-6 text-(--obs-muted)">
            <li>尽量在自然光下拍摄，保持画面清晰。</li>
            <li>拍摄时包含多个角度，如整体、特征部位。</li>
            <li>记录生境环境，如水域、树林、草地等。</li>
            <li>保持安全距离，不打扰、不采摘、不捕捉，保护自然。</li>
          </ul>
        </SheetContent>
      </Sheet>

      <ObservationSubmitSuccessDialog
        open={successState.open}
        onOpenChange={(open) => setSuccessState((current) => ({ ...current, open }))}
        observationId={successState.observationId}
        imageUrl={successState.imageUrl}
        speciesName={successState.speciesName}
        expectedXp={DEFAULT_XP_REWARD * successState.count}
        count={successState.count}
      />
    </>
  )
}
