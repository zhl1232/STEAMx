"use client"

import { CompletionCTA } from "@/components/features/project/completion-cta"
import { ProjectDetailActions } from "@/components/features/project/project-detail-actions"
import { ProjectComments } from "@/components/features/project-comments"
import { ProjectInteractions } from "@/components/features/project-interactions"
import { ProjectShowcase } from "@/components/features/project-showcase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Comment, ProjectCompletion } from "@/lib/mappers/types"

interface MobileProjectCommunityTabsProps {
  projectId: string | number
  projectTitle: string
  projectOwnerId: string
  challengeId?: number | null
  mode: "project" | "observation"
  likes: number
  completions: ProjectCompletion[]
  showcaseCount: number
  projectCoinsReceived: number
  collectionsCount: number
  comments: Comment[]
  totalComments: number
  hasMoreComments: boolean
  likedCommentIds: Array<string | number>
}

export function MobileProjectCommunityTabs({
  projectId,
  projectTitle,
  projectOwnerId,
  challengeId,
  mode,
  likes,
  completions,
  showcaseCount,
  projectCoinsReceived,
  collectionsCount,
  comments,
  totalComments,
  hasMoreComments,
  likedCommentIds,
}: MobileProjectCommunityTabsProps) {
  return (
    <section className="surface-panel scroll-mt-24 overflow-hidden rounded-[18px] px-4 pb-5 lg:hidden" id="project-comments">
      <Tabs defaultValue="comments" className="pt-4">
        <TabsList className="grid h-10 w-full grid-cols-2 rounded-[10px] bg-muted/70 p-1">
          <TabsTrigger value="comments" className="rounded-[8px] text-sm">
            评论区 {totalComments > 0 ? totalComments : ""}
          </TabsTrigger>
          <TabsTrigger value="showcase" className="rounded-[8px] text-sm">
            玩家作品 {showcaseCount > 0 ? showcaseCount : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" forceMount className="mt-0">
          <ProjectComments
            projectId={projectId}
            initialComments={comments}
            initialTotal={totalComments}
            initialHasMore={hasMoreComments}
            initialLikedCommentIds={likedCommentIds}
            commentBoxId="project-comment-box"
            hideInlineComposerOnMobile
            preserveScrollOnSubmit
            mobileFixedComposerActionsSlot={
              <ProjectDetailActions
                projectId={projectId}
                projectTitle={projectTitle}
                mode={mode}
                variant="mobile"
                likes={likes}
                collections={collectionsCount}
              />
            }
            actionsSlot={
              <ProjectInteractions
                projectId={projectId}
                projectTitle={projectTitle}
                likes={likes}
                projectOwnerId={projectOwnerId}
                projectCoinsReceived={projectCoinsReceived}
              />
            }
          />
        </TabsContent>

        <TabsContent value="showcase" className="mt-5">
          <ProjectShowcase
            completions={completions}
            projectId={projectId}
            projectTitle={projectTitle}
            title="玩家作品"
            totalCount={showcaseCount}
            emptyActionSlot={
              <CompletionCTA
                projectId={projectId}
                projectTitle={projectTitle}
                challengeId={challengeId}
                mode={mode}
                variant="inline"
              />
            }
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}
