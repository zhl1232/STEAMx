"use client"

import { Bookmark, Heart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { useProjects } from "@/lib/context/project-context"
import { useSyncProjectInteractions } from "@/hooks/use-sync-project-interactions"
import { cn } from "@/lib/utils"

interface ProjectHeroActionsProps {
  projectId: number | string
  likes: number
  collections: number
}

export function ProjectHeroActions({
  projectId,
  likes: initialLikes,
  collections: initialCollections,
}: ProjectHeroActionsProps) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toggleLike, isLiked, getLikesDelta, toggleCollection, isCollected, getCollectionsDelta } = useProjects()
  useSyncProjectInteractions([projectId])

  const liked = isLiked(projectId)
  const collected = isCollected(projectId)
  const likes = Math.max(0, initialLikes + getLikesDelta(projectId))
  const collections = Math.max(0, initialCollections + getCollectionsDelta(projectId))

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleLike}
        className={cn(
          "h-9 rounded-xs border-[hsl(var(--surface-border-strong))] bg-background/68 px-3 text-muted-foreground hover:bg-[hsl(var(--surface-muted))] hover:text-foreground",
          liked && "border-red-500 bg-red-500 text-white hover:bg-red-600 hover:text-white",
        )}
      >
        <Heart className={cn("mr-1.5 h-4 w-4", liked && "fill-current")} />
        喜欢 {likes}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCollection}
        className={cn(
          "h-9 rounded-xs border-[hsl(var(--surface-border-strong))] bg-background/68 px-3 text-muted-foreground hover:bg-[hsl(var(--surface-muted))] hover:text-foreground",
          collected && "border-amber-500 bg-amber-500 text-white hover:bg-amber-600 hover:text-white",
        )}
      >
        <Bookmark className={cn("mr-1.5 h-4 w-4", collected && "fill-current")} />
        收藏 {collections}
      </Button>
    </div>
  )
}
