"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Bookmark, Flag, Heart, ListChecks, MoreHorizontal, Rocket, Share2 } from "lucide-react"

import { CoinIcon } from "@/components/icons/coin-icon"
import { TipProjectDialog } from "@/components/features/project/tip-project-dialog"
import { Button } from "@/components/ui/button"
import { ReportDialog } from "@/components/ui/report-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { useProjects } from "@/lib/context/project-context"
import { useSyncProjectInteractions } from "@/hooks/use-sync-project-interactions"
import { formatCount } from "@/lib/project/format-count"
import { cn } from "@/lib/utils"
import type { ShareProjectData } from "@/components/features/works/share-work-dialog"

const ShareProjectDialog = dynamic(
  () => import("@/components/features/works/share-work-dialog").then((module) => module.ShareProjectDialog),
  { ssr: false },
)

interface ProjectDetailActionsProps {
  projectId: number | string
  projectTitle: string
  mode?: "project" | "observation"
  variant: "mobile" | "header" | "sticky" | "cover" | "support" | "bottom" | "hero"
  className?: string
  likes?: number
  collections?: number
  projectOwnerId?: string
  projectCoinsReceived?: number
  projectAuthor?: string
  projectImage?: string | null
  projectCategory?: string | null
}

const coverIconButtonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/94 text-[#243246] shadow-[0_10px_24px_-18px_rgba(15,23,42,0.8)] backdrop-blur-md transition active:scale-95 dark:bg-slate-950/80 dark:text-white"

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
  projectAuthor = "项目作者",
  projectImage,
  projectCategory,
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
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)

  const collected = isCollected(projectId)
  const liked = isLiked(projectId)
  const likes = Math.max(0, initialLikes + getLikesDelta(projectId))
  const collections = Math.max(0, initialCollections + getCollectionsDelta(projectId))
  const completed = isCompleted(projectId)
  const isObservation = mode === "observation"
  const isOwnProject = Boolean(user?.id && projectOwnerId && user.id === projectOwnerId)
  const recordsHref = isObservation ? "/nature/submit" : `/project/${projectId}/records`

  // `completed` is a legacy aggregate and may remain true after an earlier
  // attempt. The active Journey is the source of truth for the current run.
  const hasStartedExploration = isExploring(projectId)

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
    enabled: Boolean(user) && variant === "support" && !isOwnProject,
  })
  const hasTippedProject = myTippedProject > 0

  const scrollToSteps = () => {
    // Both responsive sections are mounted; only scroll to the visible one.
    const target = ["project-steps-mobile", "project-steps"]
      .map((id) => document.getElementById(id))
      .find((element) => element && element.getClientRects().length > 0)
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const primaryActionLabel = useMemo(() => {
    if (hasStartedExploration) return isObservation ? "继续观察" : "继续我的项目"
    if (completed) return isObservation ? "查看观察记录" : "开始新的尝试"
    return isObservation ? "开始观察" : "开始我的项目"
  }, [completed, hasStartedExploration, isObservation])
  const guestRecordLabel = isObservation ? "登录记录观察" : "登录记录项目"

  const runPrimaryAction = async () => {
    if (hasStartedExploration || completed) {
      router.push(recordsHref)
      return
    }
    if (!isObservation) {
      await startExploration(projectId)
    }
    scrollToSteps()
    toast({
      title: isObservation ? "已开始观察" : "已开始我的项目",
      description: isObservation
        ? "按步骤记录你的观察发现"
        : "按步骤动手制作，随时在我的项目记录里上传照片与心得",
    })
  }

  const handleStart = () => {
    if (!user) {
      promptLogin(() => {
        void runPrimaryAction()
      }, {
        title: isObservation ? "登录以开始观察" : "登录以开始我的项目",
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

  const handleShare = () => setShowShareDialog(true)

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

  const shareDialog = showShareDialog ? (
    <ShareProjectDialog
      project={{
        id: projectId,
        title: projectTitle,
        author: projectAuthor,
        image: projectImage,
        category: projectCategory,
      } satisfies ShareProjectData}
      open={showShareDialog}
      onOpenChange={setShowShareDialog}
    />
  ) : null

  const reportDialog = user && !isOwnProject && projectOwnerId ? (
    <ReportDialog
      contentType="project"
      contentId={projectId}
      open={showReportDialog}
      onOpenChange={setShowReportDialog}
      hideTrigger
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        moreTriggerRef.current?.focus()
      }}
    />
  ) : null

  if (variant === "hero") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild tone="brand" className="min-h-11 gap-2">
            <a href="#project-materials">
              <ListChecks className="h-4 w-4" aria-hidden />
              查看材料与步骤
            </a>
          </Button>
          <Button type="button" variant="outline" onClick={handleStart} className="min-h-11">
            {user ? primaryActionLabel : guestRecordLabel}
          </Button>
        </div>
        {!user ? (
          <p className="text-xs leading-5 text-muted-foreground">
            查看材料与步骤无需登录；登录后可记录过程和上传作品。
          </p>
        ) : null}
      </div>
    )
  }

  if (variant === "header") {
    return (
      <>
        <div className={cn("flex items-center gap-1", className)}>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-[#26364c] transition-colors hover:bg-muted/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:text-foreground"
            aria-label="分享项目"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
        {shareDialog}
      </>
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
          {user && !isOwnProject && projectOwnerId ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button ref={moreTriggerRef} type="button" className={coverIconButtonClass} aria-label="更多操作">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="min-h-11" onSelect={() => setShowReportDialog(true)}>
                  <Flag className="mr-2 h-4 w-4" />
                  举报项目
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {shareDialog}
        {reportDialog}
      </>
    )
  }

  if (variant === "support") {
    return (
      <div className={cn("flex max-w-full shrink-0 items-center gap-1.5", className)}>
        <button
          type="button"
          onClick={handleLike}
          className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-sm px-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-red-500", liked && "text-red-500")}
          aria-label={`点赞，累计 ${formatCount(likes)} 个赞`}
          aria-pressed={liked}
          title={`点赞，累计 ${formatCount(likes)} 个赞`}
        >
          <Heart className={cn("h-5 w-5", liked && "fill-current")} />
          <span className="tabular-nums">{formatCount(likes)}</span>
        </button>
        {isOwnProject || !projectOwnerId ? (
          <div className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 px-1.5 text-sm font-semibold text-muted-foreground" aria-label={`收到 ${formatCount(projectCoinsReceived)} 枚硬币`} title={`收到 ${formatCount(projectCoinsReceived)} 枚硬币`}>
            <CoinIcon className="h-5 w-5" />
            <span className="tabular-nums">{formatCount(projectCoinsReceived)}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleTip}
            className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-sm px-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-[hsl(var(--brand-amber))]", hasTippedProject && "text-[hsl(var(--brand-amber))]")}
            aria-label={hasTippedProject ? `已投币支持，累计收到 ${formatCount(projectCoinsReceived)} 枚硬币` : `投币支持，累计收到 ${formatCount(projectCoinsReceived)} 枚硬币`}
            title={hasTippedProject ? `已投币支持，累计收到 ${formatCount(projectCoinsReceived)} 枚硬币` : `投币支持，累计收到 ${formatCount(projectCoinsReceived)} 枚硬币`}
          >
            <CoinIcon className="h-5 w-5" />
            <span className="tabular-nums">{formatCount(projectCoinsReceived)}</span>
          </button>
        )}
        {tipDialog}
      </div>
    )
  }

  if (variant === "sticky") {
    return (
      <>
        <div className={cn("flex items-center gap-2", className)}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCollection}
            className={cn(
              "h-9 rounded-xs border-[hsl(var(--surface-border-strong))] bg-background/72 px-3",
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
            className="h-11 px-3"
          >
            <Rocket className="mr-1.5 h-4 w-4" />
            {user ? primaryActionLabel : guestRecordLabel}
          </Button>
        </div>
        {shareDialog}
      </>
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
              "h-12 w-[34%] min-w-[116px] shrink-0 rounded-sm border-[hsl(var(--surface-border-strong))] bg-background/86 px-3 text-sm font-semibold text-foreground shadow-xs shadow-[hsl(var(--surface-shadow)/0.08)]",
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
            {user ? primaryActionLabel : guestRecordLabel}
          </Button>
        </div>
        {shareDialog}
      </>
    )
  }

  return (
    <>
      <div className={cn("flex items-center gap-1.5", className)}>
        <button
          type="button"
          onClick={handleLike}
          className={cn(
            "flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold text-muted-foreground transition-colors active:bg-muted/70",
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
            "flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold text-muted-foreground transition-colors active:bg-muted/70",
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
          className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold text-muted-foreground transition-colors active:bg-muted/70"
          aria-label="分享项目"
        >
          <Share2 className="h-5 w-5" />
          <span>分享</span>
        </button>
      </div>
      {shareDialog}
    </>
  )
}
