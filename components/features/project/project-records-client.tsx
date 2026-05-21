"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Sprout } from "lucide-react"

import { CompleteProjectDialog } from "@/components/features/project/complete-project-dialog"
import { ExplorationRecordFeedCard } from "@/components/features/project/exploration-record-feed-card"
import { RecordTypePickerSheet } from "@/components/features/project/record-type-picker-sheet"
import { MobilePageHeader } from "@/components/ui/mobile-page-header"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { useProjects } from "@/lib/context/project-context"
import { useSyncProjectInteractions } from "@/hooks/use-sync-project-interactions"
import { ExplorationRecordGroupCard } from "@/components/features/project/exploration-record-group"
import { groupCompletionsByExplorer } from "@/lib/project/group-exploration-records"
import type { CompletionLikeMeta } from "@/lib/api/explore-data"
import { explorationRecordDomId } from "@/lib/project/exploration-record-links"
import { RECORD_TYPE_OPTIONS, matchesRecordTypeFilter } from "@/lib/project/exploration-record-meta"
import { cn } from "@/lib/utils"
import type { Comment, ProjectCompletion } from "@/lib/mappers/types"

type FeedTab = "latest" | "featured"
type DialogMode = "progress" | "final"

interface ProjectRecordsClientProps {
  projectId: string | number
  projectTitle: string
  challengeId?: number | null
  mode: "project" | "observation"
  completions: ProjectCompletion[]
  totalRecordsCount: number
  initialSort: FeedTab
  highlightCompletionId?: number | null
  likesMeta: Record<number, CompletionLikeMeta>
}

export function ProjectRecordsClient({
  projectId,
  projectTitle,
  challengeId,
  mode,
  completions,
  totalRecordsCount,
  initialSort,
  highlightCompletionId = null,
  likesMeta,
}: ProjectRecordsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const [isPending, startTransition] = useTransition()
  const { isCompleted, isExploring, startExploration } = useProjects()
  useSyncProjectInteractions([projectId])
  const backHref = `/project/${projectId}`
  const tab: FeedTab = searchParams.get("sort") === "featured" ? "featured" : initialSort
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("progress")
  const [selectedRecordType, setSelectedRecordType] = useState<string | undefined>()

  const completed = isCompleted(projectId)
  const exploring = isExploring(projectId)

  const filtered = useMemo(() => {
    return completions.filter((item) => matchesRecordTypeFilter(item, typeFilter))
  }, [completions, typeFilter])

  const grouped = useMemo(() => groupCompletionsByExplorer(filtered), [filtered])

  const completionIdsWithComments = useMemo(
    () =>
      filtered
        .filter((item) => (item.commentsCount ?? 0) > 0)
        .map((item) => item.id),
    [filtered],
  )

  const { data: commentPreviews = {} } = useQuery({
    queryKey: ["completion_comments", "preview", completionIdsWithComments.join(",")],
    queryFn: async () => {
      if (completionIdsWithComments.length === 0) {
        return {} as Record<string, Comment[]>
      }
      const params = new URLSearchParams({ ids: completionIdsWithComments.join(",") })
      const response = await fetch(`/api/completions/comments/preview?${params.toString()}`)
      if (!response.ok) {
        return {} as Record<string, Comment[]>
      }
      const payload = await response.json()
      return ((payload?.previews as Record<string, Comment[]>) || {}) as Record<string, Comment[]>
    },
    enabled: completionIdsWithComments.length > 0,
    staleTime: 30_000,
  })

  const hasOwnProgress = useMemo(() => {
    if (!user?.id) return false
    return completions.some(
      (item) => item.userId === user.id && item.recordKind === "progress",
    )
  }, [completions, user?.id])

  const setTab = useCallback(
    (next: FeedTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === "latest") {
        params.delete("sort")
      } else {
        params.set("sort", next)
      }
      startTransition(() => {
        router.replace(`/project/${projectId}/records?${params.toString()}`, { scroll: false })
      })
    },
    [projectId, router, searchParams],
  )

  useEffect(() => {
    if (!highlightCompletionId) return
    const exists = completions.some((item) => item.id === highlightCompletionId)
    if (!exists) return
    const visible = filtered.some((item) => item.id === highlightCompletionId)
    if (!visible) {
      setTypeFilter("all")
      if (tab !== "latest") setTab("latest")
    }
  }, [highlightCompletionId, completions, filtered, tab, setTab])

  useEffect(() => {
    if (!highlightCompletionId) return
    if (!filtered.some((item) => item.id === highlightCompletionId)) return

    const scrollToHighlight = () => {
      const element = document.getElementById(explorationRecordDomId(highlightCompletionId))
      if (!element) return false
      element.scrollIntoView({ behavior: "smooth", block: "center" })
      setHighlightedId(highlightCompletionId)
      return true
    }

    if (scrollToHighlight()) {
      const timer = window.setTimeout(() => setHighlightedId(null), 2500)
      return () => window.clearTimeout(timer)
    }

    const retry = window.setTimeout(() => {
      if (scrollToHighlight()) {
        window.setTimeout(() => setHighlightedId(null), 2500)
      }
    }, 120)
    return () => window.clearTimeout(retry)
  }, [highlightCompletionId, filtered])

  const ensureExploration = async () => {
    if (exploring || completed) return
    await startExploration(projectId)
  }

  const showExplorationError = () => {
    toast({
      title: "无法开始探索",
      description: "请检查网络后重试，或返回项目详情页再试",
      variant: "destructive",
    })
  }

  const openRecordFlow = async () => {
    if (mode === "observation") {
      window.location.href = "/nature/submit"
      return
    }
    if (completed) return
    try {
      await ensureExploration()
    } catch {
      showExplorationError()
      return
    }
    setDialogMode("progress")
    setPickerOpen(true)
  }

  const openFinalDialog = async () => {
    if (!hasOwnProgress) return
    try {
      await ensureExploration()
    } catch {
      showExplorationError()
      return
    }
    setDialogMode("final")
    setSelectedRecordType(undefined)
    setDialogOpen(true)
  }

  const handleStartExploration = async () => {
    if (!user) {
      promptLogin(() => void handleStartExploration(), {
        title: "登录以开始探索",
        description: "登录后即可记录探索过程并提交作品",
      })
      return
    }
    if (exploring || completed) return
    try {
      await startExploration(projectId)
      toast({ title: "已开始探索", description: "点击右上角「+ 记录」写下第一条过程记录" })
    } catch {
      showExplorationError()
    }
  }

  const headerTitle = (
    <span className="truncate text-base font-semibold">
      探索记录
      <span className="font-normal text-muted-foreground"> · {projectTitle}</span>
    </span>
  )

  return (
    <RecordsPageShell>
      <MobilePageHeader
        title={headerTitle}
        fallbackHref={backHref}
        className="sticky top-0 z-30 border-b border-[hsl(var(--surface-border)/0.7)] bg-[hsl(var(--app-canvas)/0.96)] backdrop-blur-md"
        rightSlot={
          !completed && mode === "project" && exploring ? (
            <Button
              type="button"
              size="sm"
              tone="success"
              shape="pill"
              onClick={() => void openRecordFlow()}
              className="h-8 px-3 text-xs font-bold"
            >
              + 记录
            </Button>
          ) : null
        }
      />

      <RecordsPageContent>
        <RecordsTabsRow>
          <div className="segmented-control shrink-0">
            <FeedTabButton active={tab === "latest"} disabled={isPending} onClick={() => setTab("latest")}>
              最新
            </FeedTabButton>
            <FeedTabButton active={tab === "featured"} disabled={isPending} onClick={() => setTab("featured")}>
              精选
            </FeedTabButton>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="control-field ml-auto h-8 w-[108px] rounded-full text-xs shadow-sm">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {RECORD_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </RecordsTabsRow>

        {!completed && mode === "project" ? (
          <section className="exploration-cta-banner">
            <span className="exploration-cta-icon">
              <Sprout className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {!exploring
                  ? "开始探索这个项目"
                  : hasOwnProgress
                    ? "继续记录探索过程"
                    : "记录你的探索过程"}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {!exploring
                  ? "探索后可拍照、写心得，沉淀你的制作时间线"
                  : "拍照、写心得，让每一步成长都被看见"}
              </p>
              {exploring && !hasOwnProgress ? (
                <p className="mt-1 text-[11px] text-muted-foreground">先写过程记录，再提交作品</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              {!exploring ? (
                <Button
                  type="button"
                  size="sm"
                  tone="success"
                  shape="pill"
                  onClick={() => void handleStartExploration()}
                >
                  开始探索
                </Button>
              ) : hasOwnProgress ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  shape="pill"
                  onClick={() => void openFinalDialog()}
                  className="text-xs"
                >
                  提交作品
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {isPending ? (
          <div className="py-8 text-center text-sm text-muted-foreground">加载中…</div>
        ) : filtered.length === 0 ? (
          <RecordsEmptyState
            totalRecordsCount={totalRecordsCount}
            hasLoadedRecords={completions.length > 0}
            typeFilterActive={typeFilter !== "all"}
          />
        ) : (
          <RecordsFeedList
            groups={grouped}
            highlightedId={highlightedId}
            likesMeta={likesMeta}
            commentPreviews={commentPreviews}
          />
        )}
      </RecordsPageContent>

      <RecordTypePickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(recordType) => {
          setSelectedRecordType(recordType)
          setDialogMode("progress")
          setDialogOpen(true)
        }}
      />

      {mode === "project" ? (
        <CompleteProjectDialog
          projectId={projectId}
          projectTitle={projectTitle}
          challengeId={challengeId}
          mode={dialogMode}
          recordType={selectedRecordType}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </RecordsPageShell>
  )
}

function RecordsPageShell({ children }: { children: React.ReactNode }) {
  return <div className="relative min-h-[100dvh] bg-[hsl(var(--app-canvas))] pb-12">{children}</div>
}

function RecordsPageContent({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-lg px-4 pt-3 md:max-w-2xl">{children}</div>
}

function RecordsTabsRow({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 flex items-center gap-2">{children}</div>
}

function RecordsEmptyState({
  totalRecordsCount,
  hasLoadedRecords,
  typeFilterActive,
}: {
  totalRecordsCount: number
  hasLoadedRecords: boolean
  typeFilterActive: boolean
}) {
  let description = "成为第一个记录探索过程的人"
  if (typeFilterActive && (hasLoadedRecords || totalRecordsCount > 0)) {
    description = "当前类型下暂无记录，试试切换类型"
  } else if (hasLoadedRecords || totalRecordsCount > 0) {
    description = "当前列表暂无记录"
  }

  const title =
    typeFilterActive || hasLoadedRecords || totalRecordsCount > 0
      ? "暂无匹配记录"
      : "还没有探索记录"

  return (
    <div className="app-empty-state">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}


function FeedTabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "segmented-option px-4 py-1.5 text-sm",
        active && "segmented-option-active",
        disabled && "opacity-60",
      )}
    >
      {children}
    </button>
  )
}

function RecordsFeedList({
  groups,
  highlightedId,
  likesMeta,
  commentPreviews,
}: {
  groups: ReturnType<typeof groupCompletionsByExplorer>
  highlightedId: number | null
  likesMeta: Record<number, CompletionLikeMeta>
  commentPreviews: Record<string, Comment[]>
}) {
  return (
    <div className="space-y-3">
      {groups.map((group) =>
        group.posts.length === 1 ? (
          <ExplorationRecordFeedCard
            key={group.posts[0].id}
            completion={group.posts[0]}
            highlighted={highlightedId === group.posts[0].id}
            initialLikeMeta={likesMeta[group.posts[0].id]}
            commentPreviews={commentPreviews[String(group.posts[0].id)]}
          />
        ) : (
          <ExplorationRecordGroupCard
            key={group.userId}
            group={group}
            highlightedId={highlightedId}
            likesMeta={likesMeta}
            commentPreviews={commentPreviews}
          />
        ),
      )}
    </div>
  )
}
