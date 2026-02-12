"use client"

import { useState } from "react"
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
}

export function ProjectInteractions({ projectId, projectTitle, likes: initialLikes, completions = [], projectOwnerId }: ProjectInteractionsProps) {
    const { toggleLike, isLiked, toggleCollection, isCollected, isCompleted } = useProjects()
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const [showCompleteDialog, setShowCompleteDialog] = useState(false)
    const [showTipDialog, setShowTipDialog] = useState(false)

    const handleTipClick = () => {
        if (!user) {
            promptLogin(() => setShowTipDialog(true), {
                title: "投币",
                description: "登录后即可用硬币赞赏本项目的完成作品"
            })
            return
        }
        setShowTipDialog(true)
    }

    const isProjectLiked = isLiked(projectId)
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

    return (
        <>
            <div className="rounded-lg border p-3 space-y-3 md:p-4 md:space-y-4 md:sticky md:top-24 bg-background">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-2 shrink-0">
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
                            className={isProjectCollected ? "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500" : ""}
                            title="收藏"
                        >
                            <Bookmark className={`h-4 w-4 ${isProjectCollected ? "fill-current" : ""}`} />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            title="投币"
                            onClick={handleTipClick}
                        >
                            <Coins className="h-4 w-4" />
                        </Button>
                    </div>
                    <span className="font-bold text-base md:text-lg whitespace-nowrap">{initialLikes} 赞</span>
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
            />
        </>
    )
}
