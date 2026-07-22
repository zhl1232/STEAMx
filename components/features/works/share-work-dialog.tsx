"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Copy, Download, Loader2, Share2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { useToast } from "@/hooks/use-toast"
import type { Work } from "@/lib/mappers/types"

const POSTER_WIDTH = 375
const POSTER_HEIGHT = 500
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="

function posterFileName(workId: number) {
  return `STEAM-作品-${workId}.png`
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const input = document.createElement("textarea")
  input.value = value
  input.style.position = "fixed"
  input.style.opacity = "0"
  document.body.appendChild(input)
  input.select()
  document.execCommand("copy")
  input.remove()
}

export function WorkSharePoster({
  work,
  shareUrl,
  posterRef,
}: {
  work: Work
  shareUrl: string
  posterRef: React.RefObject<HTMLDivElement | null>
}) {
  const sourceLabel = work.source?.type === "course_lesson" ? "课程创作" : "项目创作"
  const title = work.source?.title || "我的 STEAM 探索作品"
  const cover = work.proofImages[0]
  const displayShareUrl = shareUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")

  return (
    <div
      ref={posterRef}
      data-testid="work-share-poster"
      aria-hidden="true"
      className="fixed -left-[10000px] top-0 overflow-hidden"
      style={{
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        background: "#f3f7f4",
        color: "#163043",
        fontFamily:
          '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
      }}
    >
      <div className="grid h-1.5 grid-cols-[5fr_2fr_1.5fr]">
        <span style={{ background: "#1677d2" }} />
        <span style={{ background: "#2e9b66" }} />
        <span style={{ background: "#f0a51b" }} />
      </div>

      <header className="flex h-12 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
          <div>
            <p className="text-[13px] font-bold leading-none">STEAM 探索</p>
            <p className="mt-1 text-[8px] font-semibold leading-none text-[#5f7683]">创作成长档案</p>
          </div>
        </div>
        <span className="text-[9px] font-bold text-[#527080]">{sourceLabel}</span>
      </header>

      <div className="relative mx-5 h-[238px] overflow-hidden rounded-[8px] bg-[#d9e7e1]">
        {cover ? (
          <OptimizedImage
            src={cover}
            alt=""
            fill
            priority
            variant="cover"
            className="object-cover"
          />
        ) : null}
        <div className="absolute bottom-3 left-3 bg-[#163043] px-2.5 py-1.5 text-[9px] font-bold text-white">
          {work.author} 的新作品
        </div>
      </div>

      <section className="h-[95px] px-6 pt-3.5">
        <h2 className="line-clamp-2 text-[21px] font-bold leading-[25px] text-[#132c3e]">
          {title}
        </h2>
        <p className="mt-2 truncate text-[10px] font-semibold text-[#5f7683]">
          {work.author} · {work.completedAt}
        </p>
      </section>

      <footer className="flex h-[112px] items-center gap-4 bg-[#163043] px-5 text-white">
        <div className="grid h-[88px] w-[88px] shrink-0 place-items-center bg-white">
          {shareUrl ? (
            <QRCodeSVG
              value={shareUrl}
              size={82}
              level="H"
              marginSize={3}
              bgColor="#ffffff"
              fgColor="#163043"
              title="作品链接二维码"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-5">扫码查看完整作品</p>
          <p className="mt-2 text-[9px] leading-4 text-[#c7d9df]">
            看作品照片、创作记录，
            <br />
            为这次探索送上鼓励。
          </p>
          <p className="mt-1.5 truncate text-[8px] font-semibold text-[#77c69d]">
            {displayShareUrl || `works/${work.id}`}
          </p>
        </div>
      </footer>
    </div>
  )
}

export function ShareWorkDialog({
  work,
  open,
  onOpenChange,
}: {
  work: Work
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const posterRef = useRef<HTMLDivElement>(null)
  const generationRef = useRef<Promise<Blob> | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const [shareUrl, setShareUrl] = useState("")
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setShareUrl(new URL(`/works/${work.id}`, window.location.origin).toString())
  }, [open, work.id])

  useEffect(() => {
    if (!posterUrl) return
    return () => URL.revokeObjectURL(posterUrl)
  }, [posterUrl])

  const generatePoster = useCallback(async () => {
    if (blobRef.current) return blobRef.current
    if (generationRef.current) return generationRef.current
    if (!posterRef.current || !shareUrl) throw new Error("分享卡片尚未准备好")

    const promise = (async () => {
      setIsGenerating(true)
      await document.fonts?.ready
      const { domToBlob, waitUntilLoad } = await import("modern-screenshot")
      await waitUntilLoad(posterRef.current!, { timeout: 12_000 })
      const blob = await domToBlob(posterRef.current!, {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        scale: 2,
        backgroundColor: "#f3f7f4",
        timeout: 15_000,
        fetch: {
          requestInit: { cache: "force-cache" },
          placeholderImage: TRANSPARENT_PIXEL,
        },
      })
      blobRef.current = blob
      setPosterUrl(URL.createObjectURL(blob))
      return blob
    })()

    generationRef.current = promise
    try {
      return await promise
    } finally {
      generationRef.current = null
      setIsGenerating(false)
    }
  }, [shareUrl])

  useEffect(() => {
    if (!open || !shareUrl) return
    void generatePoster().catch(() => {
      toast({
        title: "分享卡片生成失败",
        description: "请检查网络后重试",
        variant: "destructive",
      })
    })
  }, [generatePoster, open, shareUrl, toast])

  const handleDownload = async () => {
    try {
      const blob = await generatePoster()
      downloadBlob(blob, posterFileName(work.id))
      toast({ title: "分享卡片已保存" })
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    }
  }

  const handleShare = async () => {
    try {
      const blob = await generatePoster()
      const file = new File([blob], posterFileName(work.id), { type: "image/png" })
      const shareData = {
        title: `${work.author} 的 STEAM 作品`,
        text: `来看看 ${work.author} 的创作作品`,
        url: shareUrl,
      }

      if (navigator.share) {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ ...shareData, files: [file] })
        } else {
          await navigator.share(shareData)
        }
        return
      }

      downloadBlob(blob, posterFileName(work.id))
      toast({ title: "分享卡片已保存", description: "可在微信中发送这张图片" })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast({
        title: "分享失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    }
  }

  const handleCopy = async () => {
    try {
      await copyText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_500)
      toast({ title: "作品链接已复制" })
    } catch {
      toast({ title: "复制失败", variant: "destructive" })
    }
  }

  const visibilityMessage = !work.isPublic
    ? "当前作品未公开，链接仅自己可访问。"
    : work.status === "pending"
      ? "作品正在审核，审核通过后链接将对外开放。"
      : work.status === "rejected"
        ? "作品未通过审核，链接暂时不会对外开放。"
        : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle>分享这件作品</DialogTitle>
          <DialogDescription>高清作品卡片已配好链接二维码</DialogDescription>
        </DialogHeader>

        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,375px)_minmax(220px,1fr)]">
          <div className="mx-auto aspect-[3/4] w-full max-w-[375px] overflow-hidden rounded-sm border border-border bg-muted">
            {posterUrl ? (
              // Blob URL 由当前页面生成，不需要 Next Image 优化。
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrl}
                alt="分享卡片预览"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="grid h-full place-items-center">
                <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--brand-blue))]" />
                  正在生成高清卡片
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="border-b border-border pb-4">
              <p className="text-sm font-bold text-foreground">{work.source?.title || "STEAM 探索作品"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{work.author} · {work.completedAt}</p>
            </div>

            {visibilityMessage ? (
              <p className="rounded-sm border border-[hsl(var(--brand-amber)/0.28)] bg-[hsl(var(--brand-amber)/0.08)] p-3 text-xs leading-5 text-foreground">
                {visibilityMessage}
              </p>
            ) : null}

            <Button
              type="button"
              className="h-11 w-full gap-2"
              onClick={() => void handleShare()}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              系统分享
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2"
              onClick={() => void handleDownload()}
              disabled={isGenerating}
            >
              <Download className="h-4 w-4" />
              保存图片
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full gap-2"
              onClick={() => void handleCopy()}
              disabled={!shareUrl}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "已复制" : "复制链接"}
            </Button>
          </div>
        </div>

        <WorkSharePoster work={work} shareUrl={shareUrl} posterRef={posterRef} />
      </DialogContent>
    </Dialog>
  )
}
