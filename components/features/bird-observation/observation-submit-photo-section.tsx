"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { Camera, CheckCircle2, Loader2, Plus, Sparkles, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { logger } from "@/lib/logger"
import { readObservationPhotoMetadata, type ObservationPhotoMetadata } from "@/lib/observation-photo-metadata"
import { uploadFileSecure, validateFileType } from "@/lib/utils/upload"

export interface ObservationMediaAnalysis {
  id?: number
  imageUrl: string
  status: "pending" | "passed" | "passed_no_identification" | "failed_unsafe" | "failed_low_quality" | "failed_unrecognized" | "error"
  moderationPass: boolean | null
  moderationReason: string | null
  qualityPass: boolean | null
  qualityReason: string | null
  noteSuggestion: string | null
  speciesCandidates: Array<{
    speciesId: number
    commonName: string
    scientificName?: string | null
    confidence: number
    reason?: string | null
  }>
}

interface ObservationSubmitPhotoSectionProps {
  evidenceImages: string[]
  onEvidenceChange: (urls: string[]) => void
  analyses?: ObservationMediaAnalysis[]
  isAnalyzing?: boolean
  showHeader?: boolean
  onPhotoMetadata?: (items: ObservationPhotoMetadata[]) => void
  analyzingMessage?: string
}

const MAX_IMAGES = 5

function getAnalysisBadge(status?: ObservationMediaAnalysis["status"]) {
  switch (status) {
    case "passed":
      return {
        label: "已识别",
        className: "border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
      }
    case "passed_no_identification":
      return {
        label: "可用于观察",
        className: "border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
      }
    case "failed_unsafe":
      return {
        label: "内容不适合",
        className: "border-rose-300/80 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300",
      }
    case "failed_low_quality":
      return {
        label: "请重拍",
        className: "border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
      }
    case "failed_unrecognized":
      return {
        label: "未识别",
        className: "border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
      }
    case "error":
      return {
        label: "识别失败",
        className: "border-rose-300/80 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300",
      }
    case "pending":
      return {
        label: "识别中",
        className: "border-sky-300/80 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300",
      }
    default:
      return null
  }
}

export function ObservationSubmitPhotoSection({
  evidenceImages,
  onEvidenceChange,
  analyses = [],
  isAnalyzing = false,
  showHeader = true,
  onPhotoMetadata,
  analyzingMessage = "正在分析图片质量，并尝试匹配候选。",
}: ObservationSubmitPhotoSectionProps) {
  const { user, loading: authLoading } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)

  const analysisByImage = useMemo(
    () => new Map(analyses.map((item) => [item.imageUrl, item])),
    [analyses],
  )

  useEffect(() => {
    if (evidenceImages.length > MAX_IMAGES) {
      onEvidenceChange(evidenceImages.slice(0, MAX_IMAGES))
    }
  }, [evidenceImages, onEvidenceChange])

  const handleSelectFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (files.length === 0) return

    if (!user) {
      if (authLoading) {
        toast({
          title: "正在确认登录状态",
          description: "请稍候一两秒后重新选择照片。",
        })
      } else {
        promptLogin(undefined, {
          title: "登录后再上传照片",
          description: "登录后即可上传观察照片并发布记录。",
        })
      }
      return
    }

    const remaining = MAX_IMAGES - evidenceImages.length
    if (remaining <= 0) {
      toast({ title: `最多上传 ${MAX_IMAGES} 张照片`, variant: "destructive" })
      return
    }

    const acceptedFiles = files.filter((file) => {
      if (!validateFileType(file)) {
        toast({
          title: "文件类型不支持",
          description: "请上传 JPG、PNG、GIF 或 WebP 格式的图片",
          variant: "destructive",
        })
        return false
      }

      return true
    })

    const batch = acceptedFiles.slice(0, remaining)
    if (batch.length === 0) return

    setIsUploading(true)
    setUploadingCount(batch.length)

    try {
      const metadata = await Promise.all(batch.map((file) => readObservationPhotoMetadata(file)))
      const uploadedUrls = await Promise.all(
        batch.map(async (file) => {
          const publicUrl = await uploadFileSecure(file, "project-images", "observations")
          if (!publicUrl) {
            throw new Error("Upload failed")
          }
          return publicUrl
        }),
      )

      onEvidenceChange([...evidenceImages, ...uploadedUrls])
      onPhotoMetadata?.(metadata)
      toast({
        title: "照片已收进本次观察",
        description: `成功添加 ${uploadedUrls.length} 张图片`,
      })
    } catch (error) {
      logger.error("Observation image upload error", { error })
      toast({
        title: "上传失败",
        description: "图片上传失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setUploadingCount(0)
    }
  }

  const handleRemove = (index: number) => {
    onEvidenceChange(evidenceImages.filter((_, currentIndex) => currentIndex !== index))
  }

  const canAddMore = evidenceImages.length < MAX_IMAGES
  const heroImage = evidenceImages[0] ?? null
  const galleryImages = evidenceImages.slice(1)
  const heroBadge = heroImage ? getAnalysisBadge(analysisByImage.get(heroImage)?.status) : null
  const photoStepStatus = evidenceImages.length === 0 ? "待上传" : isAnalyzing ? "识别中" : "已上传"

  return (
    <section className="space-y-4">
      {showHeader ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              先把它拍下来
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <span className="shrink-0 whitespace-nowrap rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                {evidenceImages.length}/{MAX_IMAGES}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border/70 bg-background/85 px-2.5 py-1 text-[11px] font-medium leading-none text-muted-foreground">
                {isAnalyzing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : evidenceImages.length === 0 ? (
                  <Camera className="h-3 w-3" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                )}
                {photoStepStatus}
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            至少上传 1 张清晰照片，越清楚越容易识别。
          </p>
        </div>
      ) : null}

      {isAnalyzing && evidenceImages.length > 0 ? (
        <div className="rounded-md border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200">
          {analyzingMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(180px,0.65fr)]">
        <div className="overflow-hidden rounded-xs border border-[var(--obs-border-strong)] bg-[var(--obs-control)] text-[var(--obs-text)] [box-shadow:var(--obs-panel-shadow)]">
          {heroImage ? (
            <div className="relative aspect-[16/11] min-h-[180px] sm:min-h-[210px] md:aspect-[16/10]">
            <OptimizedImage
              src={heroImage}
              alt="观察头图"
              fill
              variant="cover"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/72 via-stone-950/10 to-transparent" />
            <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2 sm:left-4 sm:top-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                封面照片
              </div>
              {heroBadge ? (
                <Badge variant="outline" className={heroBadge.className}>
                  {heroBadge.label}
                </Badge>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-3 top-3 h-9 w-9 rounded-full border border-white/18 bg-black/45 text-white hover:bg-black/60 sm:right-4 sm:top-4"
              onClick={() => handleRemove(0)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
              <div className="max-w-[18rem]">
                <p className="text-sm font-medium">照片已进入识别流程</p>
                <p className="mt-1 text-xs leading-5 text-white/76">
                  确认物种、地点和描述后即可发布。
                </p>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="group flex aspect-[16/11] min-h-[180px] w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-[var(--obs-border-strong)] [background:var(--obs-photo-bg)] px-6 text-center text-[var(--obs-muted)] transition duration-300 hover:border-[var(--obs-accent)] hover:text-[var(--obs-text)] sm:min-h-[210px] md:aspect-[16/10]"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || authLoading}
          >
            {isUploading ? (
              <>
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500/60 border-t-transparent" />
                <p className="text-base font-medium text-[var(--obs-text)]">上传中...</p>
                <p className="text-sm text-[var(--obs-muted-2)]">正在处理 {uploadingCount} 张图片</p>
              </>
            ) : authLoading ? (
              <>
                <Loader2 className="h-9 w-9 animate-spin text-[var(--obs-accent)]" />
                <p className="text-base font-medium text-[var(--obs-text)]">正在确认登录状态...</p>
                <p className="text-sm text-[var(--obs-muted-2)]">稍候即可上传照片</p>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--obs-border-strong)] bg-[var(--obs-accent-soft)] text-[var(--obs-accent-text)] transition-transform duration-300 group-hover:scale-105 group-hover:border-[var(--obs-accent)]">
                  <Camera className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold tracking-tight text-[var(--obs-text)]">上传或拍摄照片</p>
                  <p className="text-sm text-[var(--obs-muted-2)]">
                    支持多选，JPG / PNG / GIF / WebP
                  </p>
                </div>
              </>
            )}
          </button>
        )}
        </div>

        {evidenceImages.length > 0 ? (
          <button
            type="button"
            className="group flex min-h-[128px] flex-col items-center justify-center gap-3 rounded-xs border border-dashed border-[var(--obs-border-strong)] bg-[var(--obs-control)] px-5 text-center text-[var(--obs-muted)] transition duration-300 hover:border-[var(--obs-accent)] hover:bg-[var(--obs-control-hover)] hover:text-[var(--obs-text)] md:min-h-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canAddMore || isUploading || authLoading}
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--obs-accent)] text-white [box-shadow:var(--obs-soft-shadow)] transition-transform duration-300 group-hover:scale-105">
              {isUploading || authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            </span>
            <span className="text-base font-semibold text-[var(--obs-text)]">
              {canAddMore ? "添加更多照片" : "照片已达上限"}
            </span>
            <span className="text-xs leading-5 text-[var(--obs-muted-2)]">
              {evidenceImages.length}/{MAX_IMAGES} · 支持 JPG / PNG
            </span>
          </button>
        ) : null}
      </div>

      {galleryImages.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {galleryImages.map((url, index) => {
            const badge = getAnalysisBadge(analysisByImage.get(url)?.status)
            return (
              <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-xs border border-[var(--obs-border-strong)] bg-[var(--obs-control)]">
                <div className="relative aspect-square">
                  <OptimizedImage
                    src={url}
                    alt={`补充照片 ${index + 2}`}
                    fill
                    variant="cover"
                    className="object-cover"
                  />
                </div>
                {badge ? (
                  <Badge
                    variant="outline"
                    className={`absolute left-1.5 top-1.5 bg-background/88 backdrop-blur ${badge.className}`}
                  >
                    {badge.label}
                  </Badge>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleRemove(index + 1)}
                  className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label={`删除补充照片 ${index + 2}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={handleSelectFiles}
        disabled={isUploading}
      />
    </section>
  )
}
