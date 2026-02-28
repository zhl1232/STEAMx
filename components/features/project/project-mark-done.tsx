"use client"

import { useState } from "react"
import { ConfettiButton } from "@/components/ui/confetti-button"
import { useProjects } from "@/context/project-context"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { CompleteProjectDialog } from "@/components/features/project/complete-project-dialog"

interface ProjectMarkDoneProps {
    projectId: number | string
    projectTitle: string
}

/** 独立的「我做过这个」区块，可放在标题下或侧栏，不与底部回复栏混在一起 */
export function ProjectMarkDone({ projectId, projectTitle }: ProjectMarkDoneProps) {
    const { isCompleted } = useProjects()
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const [showCompleteDialog, setShowCompleteDialog] = useState(false)

    const isProjectCompleted = isCompleted(projectId)

    const handleCompleteClick = () => {
        if (!user) {
            promptLogin(() => setShowCompleteDialog(true), {
                title: '登录以标记完成',
                description: '登录后可记录你完成的项目，获得成就徽章'
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
                {isProjectCompleted ? "✅ 已完成" : "我做过这个！(Mark as Done)"}
            </ConfettiButton>
            <CompleteProjectDialog
                projectId={projectId}
                projectTitle={projectTitle}
                open={showCompleteDialog}
                onOpenChange={setShowCompleteDialog}
                onSuccess={() => {}}
            />
        </>
    )
}
