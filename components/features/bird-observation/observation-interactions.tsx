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
}: ObservationInteractionsProps) {
  const buttonSizeClass = compact ? "h-11 px-3.5 text-xs" : "h-10 px-4 text-sm"

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onLike}
        disabled={isLiking}
        className={cn(
          "min-w-[92px] rounded-full border border-border/70 bg-muted/45 text-foreground/80 transition-colors hover:bg-muted/75 hover:text-foreground",
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
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleComments}
        className={cn(
          "min-w-[92px] rounded-full border border-border/70 bg-muted/45 text-foreground/80 transition-colors hover:bg-muted/75 hover:text-foreground",
          buttonSizeClass,
          commentsOpen && "text-primary",
        )}
      >
        <MessageCircle className="h-4 w-4" />
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
      </Button>
    </div>
  )
}
