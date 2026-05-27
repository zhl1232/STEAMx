"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Heart, Loader2, MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ObservationInteractionsProps {
  liked: boolean
  likesCount: number
  commentsCount: number
  isLiking?: boolean
  onLike: () => void
  onToggleComments?: () => void
  commentsOpen?: boolean
  className?: string
  compact?: boolean
  /** 底部栏：仅图标 + 数字 */
  bar?: boolean
}

export function ObservationInteractions({
  liked,
  likesCount,
  commentsCount,
  isLiking = false,
  onLike,
  onToggleComments,
  commentsOpen,
  className,
  compact = false,
  bar = false,
}: ObservationInteractionsProps) {
  const buttonSizeClass = bar ? "h-11 w-11 px-0" : compact ? "h-11 px-3.5 text-xs" : "h-10 px-4 text-sm"

  return (
    <div className={cn("flex items-center", bar ? "gap-1" : "gap-3", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onLike}
        disabled={isLiking}
        aria-label={`点赞，${likesCount} 次`}
        className={cn(
          bar
            ? "flex-col gap-0.5 rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            : "min-w-[92px] rounded-full border border-border/70 bg-muted/45 text-foreground/80 transition-colors hover:bg-muted/75 hover:text-foreground",
          buttonSizeClass,
          liked && "text-red-500 hover:text-red-600",
        )}
      >
        <motion.span
          key={liked ? "liked" : "idle"}
          animate={liked ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="inline-flex"
        >
          {isLiking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-4 w-4", liked && "fill-current")} />}
        </motion.span>
        {bar ? (
          <span className="text-[11px] font-medium tabular-nums leading-none">{likesCount}</span>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${liked}-${likesCount}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {likesCount > 0 ? likesCount : "点赞"}
            </motion.span>
          </AnimatePresence>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleComments}
        aria-label={`评论，${commentsCount} 条`}
        className={cn(
          bar
            ? "flex-col gap-0.5 rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            : "min-w-[92px] rounded-full border border-border/70 bg-muted/45 text-foreground/80 transition-colors hover:bg-muted/75 hover:text-foreground",
          buttonSizeClass,
          !bar && commentsOpen && "text-primary",
          bar && commentsOpen && "bg-muted/60 text-[hsl(var(--nature-accent))]",
        )}
      >
        <MessageCircle className="h-4 w-4" />
        {bar ? (
          <span className="text-[11px] font-medium tabular-nums leading-none">{commentsCount}</span>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={String(commentsCount)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {commentsCount > 0 ? commentsCount : "评论"}
            </motion.span>
          </AnimatePresence>
        )}
      </Button>
    </div>
  )
}
