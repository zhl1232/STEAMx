"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ListFilter, Sprout } from "lucide-react"

import { CompleteProjectDialog } from "@/components/features/project/complete-project-dialog"
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
import { JourneyRecordTimeline } from "@/components/features/project/journey-record-timeline"
import {
  filterExplorationRecordGroups,
  groupCompletionsByExploration,
} from "@/lib/project/group-exploration-records"
import { explorationRecordDomId } from "@/lib/project/exploration-record-links"
import { RECORD_TYPE_OPTIONS, matchesRecordTypeFilter } from "@/lib/project/exploration-record-meta"
import type { ProjectCompletion } from "@/lib/mappers/types"
import type { JourneyRecord } from "@/lib/journeys/types"

type DialogMode = "progress" | "final"

interface ProjectRecordsClientProps {
  projectId: string | number
  projectTitle: string
  challengeId?: number | null
  mode: "project" | "observation"
  completions: ProjectCompletion[]
  totalRecordsCount: number
  highlightCompletionId?: number | null
  journeyId?: number | null
  journeyStatus?: string | null
}

export function ProjectRecordsClient({
  projectId,
  projectTitle,
  challengeId,
  mode,
  completions,
  totalRecordsCount,
  highlightCompletionId = null,
  journeyId = null,
  journeyStatus = null,
}: ProjectRecordsClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { isCompleted, isExploring, startExploration } = useProjects()
  useSyncProjectInteractions([projectId])
  const backHref = `/project/${projectId}`
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("progress")
  const [selectedRecordType, setSelectedRecordType] = useState<string | undefined>()
  const [journeyRecords, setJourneyRecords] = useState<JourneyRecord[]>([])
  const [currentJourneyId, setCurrentJourneyId] = useState<number | null>(journeyId)
  const [currentJourneyStatus, setCurrentJourneyStatus] = useState<string | null>(journeyStatus)
  const currentJourneyIdRef = useRef<number | null>(journeyId)
  const journeyRequestRef = useRef(0)

  const applyJourneyState = useCallback((nextId: number | null, nextStatus: string | null, nextRecords: JourneyRecord[]) => {
    currentJourneyIdRef.current = nextId
    setCurrentJourneyId(nextId)
    setCurrentJourneyStatus(nextStatus)
    setJourneyRecords(nextRecords)
  }, [])

  const loadJourneyRecords = useCallback(async (
    preferredJourneyId = currentJourneyIdRef.current,
    signal?: AbortSignal,
  ) => {
    const requestId = ++journeyRequestRef.current
    const isCurrentRequest = () => !signal?.aborted && journeyRequestRef.current === requestId

    if (!user?.id) {
      if (isCurrentRequest()) applyJourneyState(null, null, [])
      return
    }

    try {
      const journeyListResponse = await fetch(
        `/api/journeys?source_type=project&source_id=${projectId}&status=all`,
        { cache: "no-store", signal },
      )
      const journeyListPayload = journeyListResponse.ok
        ? await journeyListResponse.json().catch(() => ({}))
        : {}
      if (!isCurrentRequest()) return

      const journeys = Array.isArray(journeyListPayload.journeys) ? journeyListPayload.journeys : []
      const activeJourney = journeys.find((item: { status?: string }) => item.status === "active")
      const preferredJourney = journeys.find((item: { id?: number }) => item.id === preferredJourneyId)
      const nextJourney = activeJourney ?? preferredJourney ?? journeys[0] ?? null
      const nextJourneyId = typeof nextJourney?.id === "number" ? nextJourney.id : null
      if (!nextJourneyId) {
        applyJourneyState(null, null, [])
        return
      }

      const response = await fetch(`/api/journeys/${nextJourneyId}?limit=100`, {
        cache: "no-store",
        signal,
      })
      if (!response.ok || !isCurrentRequest()) return
      const payload = await response.json().catch(() => ({}))
      if (!isCurrentRequest()) return
      applyJourneyState(
        nextJourneyId,
        typeof payload.journey?.status === "string" ? payload.journey.status : null,
        (payload.records ?? []) as JourneyRecord[],
      )
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      if (!isCurrentRequest()) return
      throw error
    }
  }, [applyJourneyState, projectId, user?.id])

  useEffect(() => {
    const controller = new AbortController()
    void loadJourneyRecords(journeyId, controller.signal).catch(() => {
      // The page can still render the legacy feed if the Journey read fails.
    })
    return () => {
      controller.abort()
      journeyRequestRef.current += 1
    }
  }, [journeyId, loadJourneyRecords])

  const legacyCompleted = isCompleted(projectId)
  const exploring = isExploring(projectId)
  const journeyActive = currentJourneyStatus === "active" || (currentJourneyStatus === null && exploring)
  const journeyCompleted = currentJourneyStatus === "completed" || (currentJourneyStatus === null && legacyCompleted && !exploring)

  const filtered = useMemo(() => {
    return completions.filter((item) => matchesRecordTypeFilter(item, typeFilter))
  }, [completions, typeFilter])

  const grouped = useMemo(() => {
    const allGroups = groupCompletionsByExploration(completions)
    return filterExplorationRecordGroups(allGroups, typeFilter)
  }, [completions, typeFilter])

  const hasOwnProgress = useMemo(() => {
    if (!user?.id) return journeyRecords.some((record) => record.record_kind === "progress")
    return journeyRecords.some((record) => record.record_kind === "progress") || completions.some(
      (item) => item.userId === user.id && item.recordKind === "progress",
    )
  }, [completions, journeyRecords, user?.id])

  const hasRejectedFinal = journeyRecords.some(
    (record) => record.record_kind === "final" && record.status === "rejected",
  )

  const handleJourneyVisibilityChange = async (record: JourneyRecord, visibility: "private" | "public") => {
    if (!currentJourneyId) return
    // Invalidate an in-flight read before applying this user action; an older
    // response must not put the record back into its previous visibility.
    journeyRequestRef.current += 1
    const response = await fetch(`/api/journeys/${currentJourneyId}/records/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || "公开状态更新失败")
    const nextRecord = payload.record as JourneyRecord
    setJourneyRecords((current) => current.map((item) => item.id === record.id ? nextRecord : item))
    if (record.record_kind === "final") setCurrentJourneyStatus("active")
    toast({
      title: visibility === "public" ? "已提交公开审核" : "已切回私密记录",
      description: visibility === "public" ? "审核通过后，其他人才能看到这一步。" : "这一步只对你自己可见。",
    })
  }

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
    if (journeyActive) return
    await startExploration(projectId)
    await loadJourneyRecords()
  }

  const showExplorationError = () => {
    toast({
      title: "无法开始我的项目",
      description: "请检查网络后重试，或返回项目详情页再试",
      variant: "destructive",
    })
  }

  const openRecordFlow = async () => {
    if (mode === "observation") {
      window.location.href = "/nature/submit"
      return
    }
    if (journeyCompleted) return
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
    if (!journeyActive || (!hasOwnProgress && !hasRejectedFinal)) return
    setDialogMode("final")
    setSelectedRecordType(undefined)
    setDialogOpen(true)
  }

  const handleStartExploration = async () => {
    if (!user) {
      promptLogin(() => void handleStartExploration(), {
        title: "登录以开始我的项目",
        description: "登录后即可记录探索过程并提交作品",
      })
      return
    }
    if (journeyActive) return
    try {
      await startExploration(projectId)
      await loadJourneyRecords()
      toast({ title: "已开始我的项目", description: "点击「记录」写下第一条探索记录" })
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
        className="border-b border-[hsl(var(--surface-border)/0.7)] bg-[hsl(var(--app-canvas)/0.96)] backdrop-blur-md"
        rightSlot={
          mode === "project" && journeyActive ? (
            <Button
              type="button"
              size="sm"
              tone="success"
              onClick={() => void openRecordFlow()}
              className="h-8 px-3 text-xs font-bold"
            >
              + 记录
            </Button>
          ) : null
        }
      />
      <h1 className="sr-only">{projectTitle}的探索记录</h1>

      <RecordsPageContent>
        <RecordsFilterRow>
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
              <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">筛选记录</p>
              <p className="hidden text-[11px] text-muted-foreground sm:block">按类型浏览探索内容</p>
            </div>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              aria-label="按记录类型筛选"
              className="control-field h-8 w-[116px] shrink-0 rounded-full bg-[hsl(var(--surface-raised)/0.88)] px-3 text-xs shadow-none"
            >
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
        </RecordsFilterRow>

        {mode === "project" ? (
          <section className="exploration-cta-banner">
            <span className="exploration-cta-icon">
              <Sprout className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {!journeyActive
                  ? "开始我的项目"
                  : hasRejectedFinal
                    ? "修改被拒绝的最终作品"
                    : hasOwnProgress
                      ? "继续记录我的项目"
                      : "记录我的项目过程"}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {!journeyActive
                  ? "开始后可拍照、写心得，沉淀自己的制作时间线"
                  : hasRejectedFinal
                    ? "根据审核意见修改后重新提交，原来的过程记录会保留"
                    : "拍照、写心得，让每一步成长都被看见"}
              </p>
              {journeyActive && !hasOwnProgress && !hasRejectedFinal ? (
                <p className="mt-1 text-[11px] text-muted-foreground">先留下过程，再总结最终作品</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              {!journeyActive ? (
                <Button
                  type="button"
                  size="sm"
                  tone="success"
                  onClick={() => void handleStartExploration()}
                >
                  开始我的项目
                </Button>
              ) : hasOwnProgress || hasRejectedFinal ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void openFinalDialog()}
                  className="text-xs"
                >
                  {hasRejectedFinal ? "修改后重提" : "总结最终作品"}
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        <JourneyRecordTimeline
          records={journeyRecords}
          onVisibilityChange={handleJourneyVisibilityChange}
        />

        {totalRecordsCount > completions.length ? (
          <p className="mb-3 text-xs leading-5 text-muted-foreground">
            当前展示最近 {completions.length} 条公开记录，共 {totalRecordsCount} 条；卡片中的步数按当前列表统计。
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <RecordsEmptyState
            totalRecordsCount={totalRecordsCount}
            hasLoadedRecords={completions.length > 0}
            typeFilterActive={typeFilter !== "all"}
          />
        ) : (
          <RecordsFeedList
            groups={grouped}
            highlightedId={highlightedId}
            currentUserId={user?.id}
            isPartial={totalRecordsCount > completions.length}
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
          onSuccess={(result) => {
            // A newly submitted final is pending (or a private draft), so its
            // public work page does not exist yet. Keep the user on the
            // Journey timeline until moderation has approved it.
            if (result.recordKind === "final" && result.status === "approved") {
              router.push(`/works/${result.id}?share=1`)
              return
            }
            void loadJourneyRecords()
            router.refresh()
          }}
        />
      ) : null}
    </RecordsPageShell>
  )
}

function RecordsPageShell({ children }: { children: React.ReactNode }) {
  return <div className="relative min-h-dvh bg-[hsl(var(--app-canvas))] pb-12">{children}</div>
}

function RecordsPageContent({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-lg px-4 pt-3 md:max-w-2xl">{children}</div>
}

function RecordsFilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex min-h-11 items-center justify-between gap-3 rounded-md bg-[hsl(var(--surface-raised)/0.36)] px-2 py-1">
      {children}
    </div>
  )
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


function RecordsFeedList({
  groups,
  highlightedId,
  currentUserId,
  isPartial,
}: {
  groups: ReturnType<typeof groupCompletionsByExploration>
  highlightedId: number | null
  currentUserId?: string
  isPartial: boolean
}) {
  return (
    <div className="space-y-5 pb-2">
      {groups.map((group) => (
        <ExplorationRecordGroupCard
          key={group.key}
          group={group}
          highlighted={group.posts.some((post) => post.id === highlightedId)}
          currentUserId={currentUserId}
          isPartial={isPartial}
        />
      ))}
    </div>
  )
}
