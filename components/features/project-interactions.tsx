"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Heart, Bookmark, Coins } from "lucide-react"
import { ConfettiButton } from "@/components/ui/confetti-button"
import { useProjects } from "@/context/project-context"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { CompleteProjectDialog } from "@/components/features/project/complete-project-dialog"
import { TipProjectDialog } from "@/components/features/project/tip-project-dialog"
import type { ProjectCompletion } from "@/lib/mappers/types"

interface ProjectInteractionsProps {
    projectId: number | string
    projectTitle: string
    likes: number
    /** 本项目的完成作品列表，用于投币弹窗内直接赞赏 */
    completions?: ProjectCompletion[]
    /** 项目作者 ID，用于直接投给项目 */
    projectOwnerId: string
    /** 嵌入模式：无卡片、紧凑布局，用于与回复框并排（不含「我做过这个」） */
    embedded?: boolean
    /** 评论总数，用于底部栏显示评论数（仅 embedded 时使用） */
    commentsCount?: number
    /** 项目收到的投币总数（项目 + 完成作品），用于底部栏展示「投给项目的硬币」 */
    projectCoinsReceived?: number
}

export function ProjectInteractions({ projectId, projectTitle, likes: initialLikes, completions = [], projectOwnerId, embedded = false, commentsCount = 0, projectCoinsReceived = 0 }: ProjectInteractionsProps) {
    const supabase = createClient()
    const { toggleLike, isLiked, getLikesDelta, clearLikesDelta, toggleCollection, isCollected, isCompleted } = useProjects()
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const [showCompleteDialog, setShowCompleteDialog] = useState(false)
    const [showTipDialog, setShowTipDialog] = useState(false)

    const { data: myTippedProject = 0 } = useQuery({
        queryKey: ["my_tip_for_resource", "project", Number(projectId)],
        queryFn: async () => {
            const { data, error } = await supabase.rpc("get_my_tip_for_resource", {
                p_resource_type: "project",
                p_resource_id: Number(projectId),
            } as never)
            if (error) return 0
            return (data as number) ?? 0
        },
        enabled: !!user,
    })
    const hasTippedProject = myTippedProject > 0

    const handleTipClick = () => {
        if (!user) {
            promptLogin(() => setShowTipDialog(true), {
                title: "投币支持项目",
                description: "登录后即可用硬币赞赏本项目"
            })
            return
        }
        setShowTipDialog(true)
    }

    // 详情页用服务端 likes 展示，挂载时清除 delta 避免与后续乐观更新重复计算
    useEffect(() => {
        clearLikesDelta(projectId)
    }, [projectId, clearLikesDelta])

    const isProjectLiked = isLiked(projectId)
    const likesDelta = getLikesDelta(projectId)
    const likes = initialLikes + likesDelta
    const isProjectCompleted = isCompleted(projectId)
    const isProjectCollected = isCollected(projectId)

    const handleLike = () => {
        if (!user) {
            promptLogin(() => toggleLike(projectId), {
                title: '登录以点赞项目',
                description: '登录后即可点赞并收藏喜欢的项目'
            })
            return
        }
        toggleLike(projectId)
    }

    const handleCollection = () => {
        if (!user) {
            promptLogin(() => toggleCollection(projectId), {
                title: '登录以收藏项目',
                description: '登录后即可收藏喜欢的项目'
            })
            return
        }
        toggleCollection(projectId)
    }

    const handleCompleteClick = () => {
        if (!user) {
            promptLogin(() => setShowCompleteDialog(true), {
                title: '登录以标记完成',
                description: '登录后可记录你完成的项目，获得成就徽章'
            })
            return
        }

        // 已完成状态下不允许再次点击（已上传作品证明，不应随意取消）
        if (isProjectCompleted) {
            return
        }

        // 未完成，打开对话框
        setShowCompleteDialog(true)
    }

    const iconButtons = (
        <>
            <div className="flex items-center gap-2 shrink-0">
                <Button
                    variant={isProjectLiked ? "default" : "outline"}
                    size="icon"
                    onClick={handleLike}
                    className={isProjectLiked ? "bg-red-500 hover:bg-red-600 text-white border-red-500" : ""}
                    title="点赞"
                >
                    <Heart className={`h-4 w-4 ${isProjectLiked ? "fill-current" : ""}`} />
                </Button>
                <Button
                    variant={isProjectCollected ? "default" : "outline"}
                    size="icon"
                    onClick={handleCollection}
                    className={isProjectCollected ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : ""}
                    title="收藏"
                >
                    <Bookmark className={`h-4 w-4 ${isProjectCollected ? "fill-current" : ""}`} />
                </Button>
                <Button
                    variant={hasTippedProject ? "default" : "outline"}
                    size="icon"
                    title="投币"
                    onClick={handleTipClick}
                    className={hasTippedProject ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : ""}
                >
                    <Coins className="h-4 w-4" />
                </Button>
            </div>
            <span className="font-bold text-base md:text-lg whitespace-nowrap">{likes} 赞</span>
        </>
    )

    const markDoneButton = (
        <ConfettiButton
            className="shrink-0"
            isCompleted={isProjectCompleted}
            onClick={handleCompleteClick}
            disabled={isProjectCompleted}
        >
            {isProjectCompleted ? "✅ 已完成" : "我做过这个！"}
        </ConfettiButton>
    )

    // 底部栏样式：默认灰色空心线框，激活后彩色实心；图标间距统一 16px
    const embeddedBar = (
        <div className="flex items-center gap-4 text-muted-foreground">
            <button
                type="button"
                onClick={handleLike}
                className="flex items-center gap-1.5 transition-colors hover:text-red-500"
                title="点赞"
            >
                <Heart className={`h-5 w-5 shrink-0 ${isProjectLiked ? "fill-current text-red-500" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium tabular-nums text-muted-foreground">{likes}</span>
            </button>
            <button
                type="button"
                onClick={handleCollection}
                className="flex items-center gap-1.5 transition-colors hover:text-amber-600"
                title="收藏"
            >
                <Bookmark className={`h-5 w-5 shrink-0 ${isProjectCollected ? "fill-current text-amber-600" : "text-muted-foreground"}`} />
            </button>
            <button
                type="button"
                onClick={handleTipClick}
                className="flex items-center gap-1.5 transition-colors hover:text-amber-600"
                title="投币支持项目"
            >
                <Coins className={`h-5 w-5 shrink-0 ${hasTippedProject ? "text-amber-600" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium tabular-nums text-muted-foreground">{projectCoinsReceived}</span>
            </button>
        </div>
    )

    if (embedded) {
        return (
            <>
                {embeddedBar}
                <TipProjectDialog
                    open={showTipDialog}
                    onOpenChange={setShowTipDialog}
                    completions={completions}
                    projectTitle={projectTitle}
                    projectOwnerId={projectOwnerId}
                    projectId={projectId}
                    projectOnly
                />
            </>
        )
    }

    return (
        <>
            <div className="rounded-lg border p-3 space-y-3 md:p-4 md:space-y-4 md:sticky md:top-24 bg-background">
                <div className="flex items-center justify-between gap-3">
                    {iconButtons}
                </div>
                <ConfettiButton
                    className="w-full"
                    isCompleted={isProjectCompleted}
                    onClick={handleCompleteClick}
                    disabled={isProjectCompleted}
                >
                    {isProjectCompleted ? "✅ 已完成" : "我做过这个！(Mark as Done)"}
                </ConfettiButton>
            </div>
            <CompleteProjectDialog
                projectId={projectId}
                projectTitle={projectTitle}
                open={showCompleteDialog}
                onOpenChange={setShowCompleteDialog}
                onSuccess={() => {}}
            />
            <TipProjectDialog
                open={showTipDialog}
                onOpenChange={setShowTipDialog}
                completions={completions}
                projectTitle={projectTitle}
                projectOwnerId={projectOwnerId}
                projectId={projectId}
                projectOnly
            />
        </>
    )
}
