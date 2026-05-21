"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Bookmark, Heart, Rocket, Share2 } from "lucide-react"

import { CoinIcon } from "@/components/icons/coin-icon"
import { TipProjectDialog } from "@/components/features/project/tip-project-dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { useProjects } from "@/lib/context/project-context"
import { useSyncProjectInteractions } from "@/hooks/use-sync-project-interactions"
import { formatCount } from "@/lib/project/format-count"
import { cn } from "@/lib/utils"

interface ProjectDetailActionsProps {
  projectId: number | string
  projectTitle: string
  mode?: "project" | "observation"
  variant: "mobile" | "header" | "sticky" | "cover" | "bottom"
  className?: string
  likes?: number
  collections?: number
  projectOwnerId?: string
  projectCoinsReceived?: number
}

const coverIconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/94 text-[#243246] shadow-[0_10px_24px_-18px_rgba(15,23,42,0.8)] backdrop-blur-md transition active:scale-95 dark:bg-slate-950/80 dark:text-white"

export function ProjectDetailActions({
  projectId,
  projectTitle,
  mode = "project",
  variant,
  className,
  likes: initialLikes = 0,
  collections: initialCollections = 0,
  projectOwnerId,
  projectCoinsReceived = 0,
}: ProjectDetailActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const {
    isCollected,
    toggleCollection,
    isLiked,
    toggleLike,
    getLikesDelta,
    getCollectionsDelta,
    clearLikesDelta,
    isCompleted,
    isExploring,
    startExploration,
  } = useProjects()
  useSyncProjectInteractions([projectId])

  const [showTipDialog, setShowTipDialog] = useState(false)

  const collected = isCollected(projectId)
  const liked = isLiked(projectId)
  const likes = Math.max(0, initialLikes + getLikesDelta(projectId))
  const collections = Math.max(0, initialCollections + getCollectionsDelta(projectId))
  const completed = isCompleted(projectId)
  const isObservation = mode === "observation"
  const isOwnProject = Boolean(user?.id && projectOwnerId && user.id === projectOwnerId)
  const recordsHref = isObservation ? "/nature/submit" : `/project/${projectId}/records`

  const hasStartedExploration = isExploring(projectId) || completed

  useEffect(() => {
    if (variant === "cover" || variant === "bottom") {
      clearLikesDelta(projectId)
    }
  }, [projectId, variant, clearLikesDelta])

  const normalizedTipProjectId = Number(projectId)
  const tipProjectQueryId =
    Number.isInteger(normalizedTipProjectId) && normalizedTipProjectId > 0
      ? normalizedTipProjectId
      : String(projectId)

  const { data: myTippedProject = 0 } = useQuery({
    queryKey: ["tip_my", "project", tipProjectQueryId],
    queryFn: async () => {
      const params = new URLSearchParams({
        resourceType: "project",
        resourceId: String(projectId),
      })
      const response = await fetch(`/api/tips/my?${params.toString()}`)
      if (!response.ok) return 0
      const payload = await response.json()
      return (payload?.myTipped as number) ?? 0
    },
    enabled: Boolean(user) && variant === "cover" && !isOwnProject,
  })
  const hasTippedProject = myTippedProject > 0

  const scrollToSteps = () => {
    const target = document.getElementById("project-steps-mobile") || document.getElementById("project-steps")
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const primaryActionLabel = useMemo(() => {
    if (completed) return isObservation ? "查看观察记录" : "查看我的作品"
    if (hasStartedExploration) return isObservation ? "继续观察" : "继续记录"
    return isObservation ? "开始观察" : "开始探索"
  }, [completed, hasStartedExploration, isObservation])

  const runPrimaryAction = async () => {
    if (completed) {
      router.push(recordsHref)
      return
    }
    if (hasStartedExploration) {
      router.push(recordsHref)
      return
    }
    if (!isObservation) {
      await startExploration(projectId)
    }
    scrollToSteps()
    toast({
      title: isObservation ? "已开始观察" : "已开始探索",
      description: isObservation
        ? "按步骤记录你的观察发现"
        : "按步骤动手制作，随时在探索记录里上传照片与心得",
    })
  }

  const handleStart = () => {
    if (!user) {
      promptLogin(() => {
        void runPrimaryAction()
      }, {
        title: isObservation ? "登录以开始观察" : "登录以开始探索",
        description: "登录后即可记录探索过程并上传作品",
      })
      return
    }
    void runPrimaryAction()
  }

  const handleCollection = () => {
    if (!user) {
      promptLogin(() => toggleCollection(projectId), {
        title: "登录以收藏项目",
        description: "登录后即可收藏喜欢的项目，稍后继续制作",
      })
      return
    }
    toggleCollection(projectId)
  }

  const handleLike = () => {
    if (!user) {
      promptLogin(() => toggleLike(projectId), {
        title: "登录以点赞项目",
        description: "登录后即可点赞喜欢的项目",
      })
      return
    }
    toggleLike(projectId)
  }

  const handleTip = () => {
    if (!user) {
      promptLogin(() => setShowTipDialog(true), {
        title: "投币支持项目",
        description: "登录后即可用硬币赞赏本项目",
      })
      return
    }
    setShowTipDialog(true)
  }

  const handleShare = async () => {
    const shareUrl = typeof window === "undefined" ? "" : window.location.href

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: projectTitle,
          text: `我在 STEAM 探索发现了这个项目：${projectTitle}`,
          url: shareUrl,
        })
        return
      }

      if (typeof navigator !== "undefined" && navigator.clipboard && shareUrl) {
        await navigator.clipboard.writeText(shareUrl)
        toast({ title: "链接已复制", description: "可以分享给同学或家长一起制作" })
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      toast({ variant: "destructive", title: "分享失败", description: "请稍后再试" })
    }
  }

  const tipDialog =
    projectOwnerId && !isOwnProject ? (
      <TipProjectDialog
        open={showTipDialog}
        onOpenChange={setShowTipDialog}
        projectTitle={projectTitle}
        projectOwnerId={projectOwnerId}
        projectId={projectId}
      />
    ) : null

  if (variant === "header") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#26364c] transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-foreground"
          aria-label="分享项目"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>
    )
  }

  if (variant === "cover") {
    return (
      <>
        <div className={cn("flex items-center gap-2", className)}>
          <button
            type="button"
            onClick={handleShare}
            className={coverIconButtonClass}
            aria-label="分享项目"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleLike}
            className={cn(coverIconButtonClass, liked && "text-red-500 dark:text-red-400")}
            aria-label={likes > 0 ? `点赞 ${formatCount(likes)}` : "点赞项目"}
          >
            <Heart className={cn("h-5 w-5", liked && "fill-current")} />
          </button>
          {!isOwnProject && projectOwnerId ? (
            <button
              type="button"
              onClick={handleTip}
              className={cn(
                coverIconButtonClass,
                hasTippedProject && "text-[hsl(var(--brand-amber))] dark:text-[hsl(var(--brand-amber))]",
              )}
              aria-label={
                projectCoinsReceived > 0
                  ? `投币支持，共 ${formatCount(projectCoinsReceived)} 枚`
                  : "投币支持项目"
              }
            >
              <CoinIcon className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        {tipDialog}
      </>
    )
  }

  if (variant === "sticky") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCollection}
          className={cn(
            "h-9 rounded-[8px] border-[hsl(var(--surface-border-strong))] bg-background/72 px-3",
            collected && "border-[hsl(var(--brand-amber)/0.38)] text-[hsl(var(--brand-amber))]",
          )}
        >
          <Bookmark className={cn("mr-1.5 h-4 w-4", collected && "fill-current")} />
          {collected ? "已收藏" : "收藏"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleShare}
          shape="soft"
          className="h-9 border-[hsl(var(--surface-border-strong))] bg-background/72 px-3"
        >
          <Share2 className="mr-1.5 h-4 w-4" />
          分享
        </Button>
        <Button
          type="button"
          size="sm"
          tone="brand"
          shape="square"
          onClick={handleStart}
          className="h-9 px-3"
        >
          <Rocket className="mr-1.5 h-4 w-4" />
          {primaryActionLabel}
        </Button>
      </div>
    )
  }

  if (variant === "bottom") {
    return (
      <>
        <div className={cn("flex w-full items-center gap-3", className)}>
          <Button
            type="button"
            variant="outline"
            onClick={handleCollection}
            className={cn(
              "h-12 w-[34%] min-w-[116px] shrink-0 rounded-[12px] border-[hsl(var(--surface-border-strong))] bg-background/86 px-3 text-sm font-semibold text-foreground shadow-sm shadow-[hsl(var(--surface-shadow)/0.08)]",
              collected && "border-[hsl(var(--brand-amber)/0.38)] text-[hsl(var(--brand-amber))]",
            )}
          >
            <Bookmark className={cn("mr-2 h-5 w-5", collected && "fill-current")} />
            {collected ? "已收藏" : "收藏"}
          </Button>
          <Button
            type="button"
            tone="success"
            shape="soft"
            onClick={handleStart}
            className="h-12 min-w-0 flex-1 px-5 text-base font-bold"
          >
            <Rocket className="mr-2 h-5 w-5" />
            {primaryActionLabel}
          </Button>
        </div>
      </>
    )
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
        <button
          type="button"
          onClick={handleLike}
          className={cn(
            "flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold text-muted-foreground transition-colors active:bg-muted/70",
            liked && "text-red-500",
          )}
          aria-label={`喜欢 ${likes}`}
        >
          <Heart className={cn("h-5 w-5", liked && "fill-current")} />
          <span className="tabular-nums">{likes}</span>
        </button>
        <button
          type="button"
          onClick={handleCollection}
          className={cn(
            "flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold text-muted-foreground transition-colors active:bg-muted/70",
            collected && "text-[hsl(var(--brand-amber))]",
          )}
          aria-label={`收藏 ${collections}`}
        >
          <Bookmark className={cn("h-5 w-5", collected && "fill-current")} />
          <span className="tabular-nums">{collections}</span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold text-muted-foreground transition-colors active:bg-muted/70"
          aria-label="分享项目"
        >
          <Share2 className="h-5 w-5" />
          <span>分享</span>
        </button>
    </div>
  )
}
