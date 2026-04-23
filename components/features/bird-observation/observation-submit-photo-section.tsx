"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { Camera, CheckCircle2, ImageIcon, Loader2, Plus, Sparkles, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { logger } from "@/lib/logger"
import { uploadFileSecure, validateFileSize, validateFileType } from "@/lib/utils/upload"

export interface ObservationMediaAnalysis {
  imageUrl: string
  status: "pending" | "passed" | "failed_unsafe" | "failed_low_quality" | "failed_unrecognized" | "error"
  moderationPass: boolean | null
  moderationReason: string | null
  qualityPass: boolean | null
  qualityReason: string | null
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
}

const MAX_IMAGES = 5

function getAnalysisBadge(status?: ObservationMediaAnalysis["status"]) {
  switch (status) {
    case "passed":
      return {
        label: "已识别",
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
}: ObservationSubmitPhotoSectionProps) {
  const { user } = useAuth()
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
    if (files.length === 0 || !user) return

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

      if (!validateFileSize(file, 5)) {
        toast({
          title: "文件太大",
          description: "图片大小不能超过 5MB",
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

      {isAnalyzing && evidenceImages.length > 0 ? (
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200">
          正在分析图片质量，并尝试匹配鸟类候选。
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-stone-950 text-white shadow-[0_26px_60px_-40px_rgba(15,23,42,0.55)]">
        {heroImage ? (
          <div className="relative aspect-video">
            <OptimizedImage
              src={heroImage}
              alt="观察头图"
              fill
              variant="cover"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/72 via-stone-950/10 to-transparent" />
            <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-black/28 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                本次观察头图
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
              className="absolute right-4 top-4 h-10 w-10 rounded-full border border-white/18 bg-black/35 text-white hover:bg-black/55"
              onClick={() => handleRemove(0)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
              <div className="max-w-[18rem]">
                <p className="text-sm font-medium">它已经准备好点亮图鉴了</p>
                <p className="mt-1 text-xs leading-5 text-white/76">
                  接下来只要确认物种和位置，就能把这一刻正式收录。
                </p>
              </div>
              {canAddMore ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 rounded-full border border-white/18 bg-white/12 text-white hover:bg-white/18"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  再添照片
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="group flex aspect-video w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.14),transparent_36%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.98))] px-6 text-center text-slate-600 transition duration-300 hover:border-emerald-400 hover:bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.2),transparent_40%),linear-gradient(180deg,rgba(248,250,252,1),rgba(236,253,245,0.98))] hover:text-slate-700 dark:border-slate-700 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,rgba(20,24,31,0.92),rgba(15,23,42,0.94))] dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),transparent_40%),linear-gradient(180deg,rgba(20,24,31,0.96),rgba(6,18,17,0.98))]"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500/60 border-t-transparent" />
                <p className="text-base font-medium text-slate-800 dark:text-slate-100">上传中...</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">正在处理 {uploadingCount} 张图片</p>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-300 bg-white/85 text-slate-500 transition-transform duration-300 group-hover:scale-105 group-hover:border-emerald-300 group-hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:group-hover:border-emerald-500/60 dark:group-hover:text-emerald-300">
                  <Camera className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">上传或拍摄照片</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    支持多选，JPG / PNG / GIF / WebP，单张最大 5MB
                  </p>
                </div>
              </>
            )}
          </button>
        )}
      </div>

      {galleryImages.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {galleryImages.map((url, index) => {
            const badge = getAnalysisBadge(analysisByImage.get(url)?.status)
            return (
              <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-2xl border border-border/70 bg-background">
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
                  className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label={`删除补充照片 ${index + 2}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
          {canAddMore ? (
            <button
              type="button"
              className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/35 text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <ImageIcon className="h-5 w-5" />
            </button>
          ) : null}
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
