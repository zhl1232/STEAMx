"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart, Share2, Bookmark } from "lucide-react"
import { ConfettiButton } from "@/components/ui/confetti-button"
import { useProjects } from "@/context/project-context"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { CompleteProjectDialog } from "@/components/features/project/complete-project-dialog"

interface ProjectInteractionsProps {
    projectId: number | string
    projectTitle: string
    likes: number
}

export function ProjectInteractions({ projectId, projectTitle, likes: initialLikes }: ProjectInteractionsProps) {
    const { toggleLike, isLiked, toggleCollection, isCollected, isCompleted } = useProjects()
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const [showCompleteDialog, setShowCompleteDialog] = useState(false)

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
                        <Button variant="outline" size="icon" title="分享">
                            <Share2 className="h-4 w-4" />
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
                onSuccess={() => {
                    // 成功后的回调，ConfettiButton 会自动更新状态因为 isCompleted 会变
                }}
            />
        </>
    )
}
