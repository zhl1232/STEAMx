"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ConfettiButton } from "@/components/ui/confetti-button"
import { useProjects } from '@/lib/context/project-context'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { CompleteProjectDialog } from "@/components/features/project/complete-project-dialog"

interface ProjectMarkDoneProps {
    projectId: number | string
    projectTitle: string
    challengeId?: number | null
}

/** 独立的「上传我的作品」区块，可放在标题下或侧栏，不与底部回复栏混在一起 */
export function ProjectMarkDone({ projectId, projectTitle, challengeId }: ProjectMarkDoneProps) {
    const router = useRouter()
    const { isCompleted } = useProjects()
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const [showCompleteDialog, setShowCompleteDialog] = useState(false)

    const isProjectCompleted = isCompleted(projectId)

    const handleCompleteClick = () => {
        if (!user) {
            promptLogin(() => setShowCompleteDialog(true), {
                title: '登录以上传作品',
                description: '登录后可上传你的作品，获得 XP 和成就徽章'
            })
            return
        }
        if (isProjectCompleted) return
        setShowCompleteDialog(true)
    }

    return (
        <>
            <ConfettiButton
                className="w-full"
                isCompleted={isProjectCompleted}
                onClick={handleCompleteClick}
                disabled={isProjectCompleted}
            >
                {isProjectCompleted ? "✅ 已完成" : "上传我的作品"}
            </ConfettiButton>
            <CompleteProjectDialog
                projectId={projectId}
                projectTitle={projectTitle}
                challengeId={challengeId}
                open={showCompleteDialog}
                onOpenChange={setShowCompleteDialog}
                onSuccess={() => router.refresh()}
            />
        </>
    )
}
