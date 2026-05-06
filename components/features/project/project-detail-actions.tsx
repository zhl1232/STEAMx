"use client"

import { Bookmark, Heart, Rocket, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { useProjects } from "@/lib/context/project-context"
import { cn } from "@/lib/utils"

interface ProjectDetailActionsProps {
  projectId: number | string
  projectTitle: string
  mode?: "project" | "observation"
  variant: "mobile" | "header" | "sticky"
  className?: string
  likes?: number
  collections?: number
}

export function ProjectDetailActions({
  projectId,
  projectTitle,
  mode = "project",
  variant,
  className,
  likes: initialLikes = 0,
  collections: initialCollections = 0,
}: ProjectDetailActionsProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { isCollected, toggleCollection, isLiked, toggleLike, getLikesDelta, getCollectionsDelta } = useProjects()

  const collected = isCollected(projectId)
  const liked = isLiked(projectId)
  const likes = Math.max(0, initialLikes + getLikesDelta(projectId))
  const collections = Math.max(0, initialCollections + getCollectionsDelta(projectId))
  const isObservation = mode === "observation"
  const startLabel = isObservation ? "开始观察" : "开始制作"

  const handleStart = () => {
    document.getElementById("project-steps")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
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

  if (variant === "header") {
    return (
      <div className="flex items-center gap-1">
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
          className="h-9 rounded-[8px] border-[hsl(var(--surface-border-strong))] bg-background/72 px-3"
        >
          <Share2 className="mr-1.5 h-4 w-4" />
          分享
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleStart}
          className="h-9 rounded-[8px] bg-[hsl(var(--brand-blue))] px-3 text-white hover:bg-[hsl(var(--brand-blue)/0.92)]"
        >
          <Rocket className="mr-1.5 h-4 w-4" />
          {startLabel}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
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
