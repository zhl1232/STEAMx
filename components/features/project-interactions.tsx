"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Heart, Bookmark, Flag } from "lucide-react"
import { CoinIcon } from "@/components/icons/coin-icon"
import { useProjects } from '@/lib/context/project-context'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { TipProjectDialog } from "@/components/features/project/tip-project-dialog"
import { ReportDialog } from "@/components/ui/report-dialog"

interface ProjectInteractionsProps {
    projectId: number | string
    projectTitle: string
    likes: number
    /** 项目作者 ID，用于直接投给项目 */
    projectOwnerId: string
    /** 项目收到的投币总数（项目 + 完成作品），用于底部栏展示「投给项目的硬币」 */
    projectCoinsReceived?: number
}

export function ProjectInteractions({ projectId, projectTitle, likes: initialLikes, projectOwnerId, projectCoinsReceived = 0 }: ProjectInteractionsProps) {
    const { toggleLike, isLiked, getLikesDelta, clearLikesDelta, toggleCollection, isCollected } = useProjects()
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const [showTipDialog, setShowTipDialog] = useState(false)
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
    const isProjectCollected = isCollected(projectId)
    const showLikesCount = likes > 0
    const showCoinsCount = projectCoinsReceived > 0

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

    return (
        <>
            <div className="flex flex-wrap items-center justify-end gap-1 text-muted-foreground">
                <button
                    type="button"
                    onClick={handleLike}
                    className="flex min-h-[36px] min-w-[36px] items-center justify-center gap-1.5 rounded-full px-2.5 transition-colors hover:bg-muted/60 hover:text-red-500 active:bg-muted/80"
                    title="点赞"
                >
                    <Heart className={`h-5 w-5 shrink-0 ${isProjectLiked ? "fill-current text-red-500" : "text-muted-foreground"}`} />
                    {showLikesCount ? (
                        <span className="text-sm font-medium tabular-nums text-muted-foreground">{likes}</span>
                    ) : null}
                </button>
                <button
                    type="button"
                    onClick={handleCollection}
                    className="flex min-h-[36px] min-w-[36px] items-center justify-center gap-1.5 rounded-full px-2.5 transition-colors hover:bg-muted/60 hover:text-amber-600 active:bg-muted/80"
                    title="收藏"
                >
                    <Bookmark className={`h-5 w-5 shrink-0 ${isProjectCollected ? "fill-current text-amber-600" : "text-muted-foreground"}`} />
                </button>
                <button
                    type="button"
                    onClick={handleTipClick}
                    className="flex min-h-[36px] min-w-[36px] items-center justify-center gap-1.5 rounded-full px-2.5 transition-colors hover:bg-muted/60 hover:text-amber-600 active:bg-muted/80"
                    title="投币支持项目"
                >
                    <CoinIcon className={`h-5 w-5 shrink-0 ${hasTippedProject ? "text-amber-600" : "text-muted-foreground"}`} />
                    {showCoinsCount ? (
                        <span className="text-sm font-medium tabular-nums text-muted-foreground">{projectCoinsReceived}</span>
                    ) : null}
                </button>
                {user && user.id !== projectOwnerId && (
                    <ReportDialog contentType="project" contentId={projectId}>
                        <button
                            type="button"
                            className="flex min-h-[36px] min-w-[36px] items-center justify-center gap-1.5 rounded-full px-2.5 transition-colors hover:bg-muted/60 hover:text-destructive active:bg-muted/80"
                            title="举报"
                        >
                            <Flag className="h-5 w-5 shrink-0 text-muted-foreground" />
                        </button>
                    </ReportDialog>
                )}
            </div>
            <TipProjectDialog
                open={showTipDialog}
                onOpenChange={setShowTipDialog}
                projectTitle={projectTitle}
                projectOwnerId={projectOwnerId}
                projectId={projectId}
            />
        </>
    )
}
