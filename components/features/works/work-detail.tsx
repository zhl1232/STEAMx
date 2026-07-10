"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, BookOpen, Coins, Heart, Images, MessageCircle, Wrench } from "lucide-react"

import { CompletionRecordComments } from "@/components/features/project/completion-record-comments"
import { TipProjectDialog } from "@/components/features/project/tip-project-dialog"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { Button } from "@/components/ui/button"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import type { Work } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"

type LikeMeta = { count: number; isLiked: boolean }

export function WorkDetail({ work }: { work: Work }) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const queryClient = useQueryClient()
  const [activeImage, setActiveImage] = useState(0)
  const [tipOpen, setTipOpen] = useState(false)
  const source = work.source
  const cover = work.proofImages[activeImage]

  const { data: likeMeta = { count: work.likes, isLiked: false } } = useQuery<LikeMeta>({
    queryKey: ["completion_likes", work.id, user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/completions/${work.id}/likes`)
      if (!response.ok) throw new Error("点赞状态加载失败")
      return response.json() as Promise<LikeMeta>
    },
    initialData: { count: work.likes, isLiked: false },
  })

  const likeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/completions/${work.id}/likes`, {
        method: likeMeta.isLiked ? "DELETE" : "POST",
      })
      if (!response.ok) throw new Error("点赞失败")
    },
    onMutate: async () => {
      const key = ["completion_likes", work.id, user?.id]
      await queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData<LikeMeta>(key, {
        count: Math.max(0, likeMeta.count + (likeMeta.isLiked ? -1 : 1)),
        isLiked: !likeMeta.isLiked,
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["completion_likes", work.id] }),
  })

  const handleLike = () => {
    if (!user) {
      promptLogin(handleLike, { title: "登录以点赞", description: "登录后即可支持这件作品" })
      return
    }
    likeMutation.mutate()
  }

  const sourceLabel = source?.type === "course_lesson" ? "课程作品" : "项目作品"
  const SourceIcon = source?.type === "course_lesson" ? BookOpen : Wrench

  return (
    <main className="page-shell pb-24 pt-4 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" asChild className="-ml-3 min-h-11 px-3">
          <Link href={source?.href || "/explore"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回来源
          </Link>
        </Button>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <SourceIcon className="h-4 w-4" />
          {sourceLabel}
        </span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)] lg:gap-8">
        <section className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-[hsl(var(--surface-muted))]">
            {cover ? (
              <OptimizedImage
                src={cover}
                alt={`${work.author} 的作品`}
                fill
                priority
                variant="cover"
                className="object-contain"
              />
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground">
                <Images className="h-10 w-10" />
              </div>
            )}
          </div>

          {work.proofImages.length > 1 ? (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
              {work.proofImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`查看第 ${index + 1} 张图片`}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-sm border-2 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeImage === index ? "border-[hsl(var(--brand-blue))]" : "border-transparent",
                  )}
                >
                  <OptimizedImage src={image} alt="" fill variant="thumbnail" className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          {work.proofVideoUrl ? (
            <video src={work.proofVideoUrl} controls playsInline className="mt-6 w-full rounded-md bg-black" />
          ) : null}
        </section>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <AvatarWithFrame
                src={work.avatar}
                alt={work.author}
                avatarFrameId={work.avatarFrameId}
                fallback={work.author[0] || "?"}
                className="h-12 w-12"
              />
              <div className="min-w-0">
                <Link href={`/users/${work.userId}`} className="truncate text-base font-bold text-foreground hover:underline">
                  {work.author}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{work.completedAt}</p>
              </div>
            </div>
          </div>

          {source ? (
            <Link
              href={source.href}
              className="group grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-sm border border-border p-3 transition hover:border-[hsl(var(--surface-border-strong))]"
            >
              <div className="relative h-16 overflow-hidden rounded-xs bg-muted">
                {source.image ? <OptimizedImage src={source.image} alt="" fill variant="thumbnail" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 py-0.5">
                <p className="text-xs font-semibold text-muted-foreground">来自{sourceLabel}</p>
                <h1 className="mt-1 line-clamp-2 text-base font-bold leading-5 text-foreground group-hover:underline">
                  {source.title}
                </h1>
                {source.type === "course_lesson" ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{source.courseTitle}</p>
                ) : null}
              </div>
            </Link>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn("h-12", likeMeta.isLiked && "text-red-500")}
              onClick={handleLike}
              disabled={likeMutation.isPending}
            >
              <Heart className={cn("mr-1.5 h-4 w-4", likeMeta.isLiked && "fill-current")} />
              {likeMeta.count}
            </Button>
            <Button variant="outline" className="h-12" asChild>
              <a href="#comments">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                {work.commentsCount ?? 0}
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => {
                if (!user) {
                  promptLogin(() => setTipOpen(true), { title: "登录以投币", description: "登录后即可支持作品作者" })
                  return
                }
                setTipOpen(true)
              }}
            >
              <Coins className="mr-1.5 h-4 w-4" />
              {work.coins}
            </Button>
          </div>

          {work.status !== "approved" ? (
            <div className="rounded-sm border border-[hsl(var(--brand-amber)/0.3)] bg-[hsl(var(--brand-amber)/0.1)] p-3 text-sm text-foreground">
              {work.status === "rejected" ? `作品未通过：${work.rejectionReason || "请修改后重新提交"}` : "作品正在审核中，仅你自己可见。"}
            </div>
          ) : null}
        </aside>

        <section className="min-w-0 lg:col-start-1 lg:row-start-2">
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="text-xl font-bold text-foreground">创作记录</h2>
            <p className="mt-3 max-w-[70ch] whitespace-pre-wrap text-base leading-7 text-foreground/82">
              {work.notes || "作者还没有补充创作说明。"}
            </p>
          </section>

          <section className="mt-8 border-t border-border pt-6" id="comments">
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[hsl(var(--brand-green))]" />
              <h2 className="text-xl font-bold text-foreground">评论</h2>
            </div>
            <CompletionRecordComments completionId={work.id} />
          </section>
        </section>
      </div>

      <TipProjectDialog
        open={tipOpen}
        onOpenChange={setTipOpen}
        projectTitle={source?.title || "作品"}
        projectOwnerId={work.userId}
        projectId={work.id}
        resourceType="completion"
      />
    </main>
  )
}
