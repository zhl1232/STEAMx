"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ExternalLink, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { OptimizedImage } from "@/components/ui/optimized-image"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
export interface CompareSpeciesTarget {
  slug: string
  commonName: string
  scientificName?: string | null
}

interface CompareSpeciesPayload {
  commonName: string
  scientificName?: string | null
  coverImageUrl?: string | null
  imageUrls?: string[]
  identificationNotes?: string | null
  habitatNotes?: string | null
}

interface ObservationSpeciesCompareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  observationMediaUrls: string[]
  observationAlt: string
  target: CompareSpeciesTarget | null
  speciesPageHref: string | null
}

function getReferenceImages(species: CompareSpeciesPayload): string[] {
  return Array.from(
    new Set([
      ...(species.imageUrls || []),
      ...(species.coverImageUrl ? [species.coverImageUrl] : []),
    ].filter((url): url is string => Boolean(url?.trim()))),
  )
}

function traitLines(species: CompareSpeciesPayload): string[] {
  const lines: string[] = []
  if (species.identificationNotes?.trim()) {
    lines.push(species.identificationNotes.trim())
  }
  if (species.habitatNotes?.trim()) {
    lines.push(`生境：${species.habitatNotes.trim()}`)
  }
  return lines
}

export function ObservationSpeciesCompareSheet({
  open,
  onOpenChange,
  observationMediaUrls,
  observationAlt,
  target,
  speciesPageHref,
}: ObservationSpeciesCompareSheetProps) {
  const [observationIndex, setObservationIndex] = useState(0)
  const [species, setSpecies] = useState<CompareSpeciesPayload | null>(null)
  const [referenceIndex, setReferenceIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setObservationIndex(0)
      setReferenceIndex(0)
      return
    }
    if (!target?.slug) return

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    setSpecies(null)
    setReferenceIndex(0)

    void (async () => {
      try {
        const response = await fetch(`/api/species/${encodeURIComponent(target.slug)}`, {
          signal: controller.signal,
        })
        const body = await response.json() as { species?: CompareSpeciesPayload; error?: string }
        if (!response.ok) throw new Error(body.error || "无法加载物种档案")
        setSpecies(body.species ?? null)
      } catch (fetchError) {
        if (controller.signal.aborted) return
        setError(fetchError instanceof Error ? fetchError.message : "加载失败")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [open, target?.slug])

  const referenceImages = species ? getReferenceImages(species) : []
  const traits = species ? traitLines(species) : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col gap-0 rounded-t-md p-0">
        <SheetHeader className="space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
          <SheetTitle className="text-lg">物种比较</SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            对照本次观察照片与「{target?.commonName ?? "候选物种"}」的参考特征，辅助判断是否认同该鉴定。
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ComparePanel
              label="本次观察"
              sublabel={observationMediaUrls.length > 1 ? `${observationIndex + 1}/${observationMediaUrls.length}` : undefined}
            >
              <CompareImageViewer
                imageUrls={observationMediaUrls}
                activeIndex={observationIndex}
                onActiveIndexChange={setObservationIndex}
                alt={observationAlt}
                emptyLabel="无观察照片"
              />
            </ComparePanel>

            <ComparePanel
              label="候选物种"
              sublabel={target?.scientificName ? (
                <span className="italic">{target.scientificName}</span>
              ) : undefined}
            >
              {isLoading ? (
                <div className="flex aspect-[4/3] items-center justify-center rounded-sm bg-muted/40">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex aspect-[4/3] items-center justify-center rounded-sm bg-muted/40 px-4 text-center text-sm text-muted-foreground">
                  {error}
                </div>
              ) : referenceImages.length > 0 ? (
                <CompareImageViewer
                  imageUrls={referenceImages}
                  activeIndex={referenceIndex}
                  onActiveIndexChange={setReferenceIndex}
                  alt={species?.commonName ?? target?.commonName ?? "参考图"}
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-sm bg-muted/40 text-sm text-muted-foreground">
                  暂无参考图
                </div>
              )}
              {!isLoading && !error && traits.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground/90">
                  {traits.map((line) => (
                    <li key={line.slice(0, 32)} className="line-clamp-4">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
            </ComparePanel>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-border/60 bg-muted/15 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <Button type="button" variant="outline" shape="pill" className="flex-1" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {speciesPageHref ? (
            <Button asChild tone="brand" shape="pill" className="flex-1">
              <Link href={speciesPageHref}>
                查看完整档案
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function CompareImageViewer({
  imageUrls,
  activeIndex,
  onActiveIndexChange,
  alt,
  emptyLabel = "暂无图片",
}: {
  imageUrls: string[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  alt: string
  emptyLabel?: string
}) {
  const activeUrl = imageUrls[activeIndex] ?? imageUrls[0]

  if (!activeUrl) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-sm border border-border/60 bg-muted/40 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border border-border/60 bg-muted/40">
        <OptimizedImage
          key={activeUrl}
          src={activeUrl}
          alt={alt}
          fill
          variant="cover"
          className="object-contain"
          sizes="(max-width: 640px) 100vw, 45vw"
        />
        {imageUrls.length > 1 ? (
          <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {activeIndex + 1}/{imageUrls.length}
          </div>
        ) : null}
      </div>

      {imageUrls.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {imageUrls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => onActiveIndexChange(index)}
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xs border bg-muted/40 transition ${
                index === activeIndex
                  ? "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary)/0.18)]"
                  : "border-border/70 opacity-80 hover:border-[hsl(var(--primary)/0.55)] hover:opacity-100"
              }`}
              aria-label={`查看比较图片 ${index + 1}`}
              aria-pressed={index === activeIndex}
            >
              <OptimizedImage
                src={url}
                alt=""
                fill
                variant="thumbnail"
                className="object-cover"
                sizes="48px"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ComparePanel({
  label,
  sublabel,
  children,
}: {
  label: string
  sublabel?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {sublabel ? <p className="text-xs text-muted-foreground">{sublabel}</p> : null}
      </div>
      {children}
    </div>
  )
}
