"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Lightbulb,
  Loader2,
  Lock,
  Save,
  Sparkles,
  Target,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { logger } from "@/lib/logger"
import type {
  ChallengeStage,
  ChallengeStageKind,
  StageProgress,
  StageProgressStatus,
} from "@/lib/mappers/types"
import type { ChallengePersonalPlanStep, ChallengeWorkspace } from "@/lib/pbl/challenge-workspace"
import type { StageCoachAction, StageCoachActionResult } from "@/lib/pbl/stage-coach-actions"
import { cn } from "@/lib/utils"

const MAX_STAGE_IMAGES = 6

const KIND_LABEL: Record<ChallengeStageKind, string> = {
  observe: "观察调研",
  design: "方案设计",
  build_test: "制作测试",
  iterate: "迭代反思",
  generic: "推进",
}

const KIND_DATA_LABEL: Partial<Record<ChallengeStageKind, { label: string; placeholder: string }>> = {
  build_test: { label: "关键数据 / 测试结果", placeholder: "例如：承重 200g 通过，轻推 3 次不倒；遮阳面积约 10×10cm。" },
  iterate: { label: "改了什么 / 取舍说明", placeholder: "例如：把屋顶缩小、底座加宽，牺牲一点遮阳换更稳。" },
}

const KIND_QUICK_PROMPTS: Record<ChallengeStageKind, string[]> = {
  observe: ["这一步该从哪里开始观察？", "我应该记录哪些信息？"],
  design: ["怎么比较两个方案的好坏？", "再帮我想几个结构思路"],
  build_test: ["这一步该测哪些数据？", "测试怎么做才更科学？"],
  iterate: ["取舍说明该怎么写？", "怎么对比改进前后？"],
  generic: ["这一步该从哪开始？", "帮我理一下思路"],
}

const COACH_ACTION_META: Array<{
  action: StageCoachAction
  label: string
  description: string
}> = [
  { action: "breakdown", label: "帮我拆题", description: "把这步拆成小问题" },
  { action: "hint", label: "给我提示", description: "不直接给答案" },
  { action: "summary", label: "整理这步", description: "归纳已有证据" },
]

function hasReviewableDraft(draft: StageDraft) {
  return draft.notes.trim().length > 0 || draft.images.length > 0 || draft.dataSummary.trim().length > 0 || draft.checked.length > 0
}

interface UploadingImage {
  id: string
  preview: string
  progress: number
  error?: string
}

interface StageDraft {
  notes: string
  images: string[]
  dataSummary: string
  checked: number[]
  status: StageProgressStatus
}

interface StageWorkspaceProps {
  challengeId: number
  stages: ChallengeStage[]
  isActive: boolean
}

function statusMeta(status: StageProgressStatus) {
  if (status === "completed") return { label: "已完成", tone: "success" as const }
  if (status === "in_progress") return { label: "进行中", tone: "info" as const }
  return { label: "未开始", tone: "muted" as const }
}

export function StageWorkspace({ challengeId, stages, isActive }: StageWorkspaceProps) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  // 只解构稳定的回调，避免把整个 context 对象放进 effect 依赖造成循环。
  const { setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext()

  const [drafts, setDrafts] = useState<Record<number, StageDraft>>({})
  const [savedProgress, setSavedProgress] = useState<Record<number, StageProgress>>({})
  const [expanded, setExpanded] = useState<number>(0)
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [uploadingByStage, setUploadingByStage] = useState<Record<number, UploadingImage[]>>({})
  const [autosaveState, setAutosaveState] = useState<Record<number, "saving" | "saved" | "error">>({})
  const [workspace, setWorkspace] = useState<ChallengeWorkspace | null>(null)
  const [projectGoalDraft, setProjectGoalDraft] = useState("")
  const [workspaceSaving, setWorkspaceSaving] = useState(false)
  const [reviewingIndex, setReviewingIndex] = useState<number | null>(null)
  const [coachActionResults, setCoachActionResults] = useState<Record<number, Partial<Record<StageCoachAction, StageCoachActionResult>>>>({})
  const [runningCoachAction, setRunningCoachAction] = useState<{ stageIndex: number; action: StageCoachAction } | null>(null)
  // 用户编辑过、尚未自动保存的阶段；ref 存集合，tick 触发防抖 effect。
  const dirtyStagesRef = useRef<Set<number>>(new Set())
  const [dirtyTick, setDirtyTick] = useState(0)
  const autosaveInflightRef = useRef<Map<number, Promise<void>>>(new Map())

  const buildDraft = useCallback(
    (index: number, progress?: StageProgress): StageDraft => ({
      notes: progress?.notes ?? "",
      images: progress?.images ?? [],
      dataSummary: typeof progress?.data?.summary === "string" ? (progress.data.summary as string) : "",
      checked: Array.isArray(progress?.data?.checked) ? (progress?.data?.checked as number[]) : [],
      status: progress?.status ?? "not_started",
    }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setSavedProgress({})
      setWorkspace(null)
      setProjectGoalDraft("")
      setDrafts(() => {
        const next: Record<number, StageDraft> = {}
        stages.forEach((_, index) => {
          next[index] = buildDraft(index)
        })
        return next
      })
      return
    }

    const load = async () => {
      const [res, workspaceRes] = await Promise.all([
        fetch(`/api/challenges/${challengeId}/stages`),
        fetch(`/api/challenges/${challengeId}/workspace`),
      ])
      if (cancelled) return
      const progressList: StageProgress[] = res.ok ? (await res.json()).progress ?? [] : []
      const workspacePayload = workspaceRes.ok ? await workspaceRes.json().catch(() => ({})) : {}
      const nextWorkspace = (workspacePayload.workspace ?? null) as ChallengeWorkspace | null
      const progressMap: Record<number, StageProgress> = {}
      progressList.forEach((item) => {
        progressMap[item.stageIndex] = item
      })

      const draftMap: Record<number, StageDraft> = {}
      stages.forEach((_, index) => {
        draftMap[index] = buildDraft(index, progressMap[index])
      })

      setSavedProgress(progressMap)
      setDrafts(draftMap)
      setWorkspace(nextWorkspace)
      setProjectGoalDraft(nextWorkspace?.projectGoal ?? "")

      const firstIncomplete = stages.findIndex((_, index) => progressMap[index]?.status !== "completed")
      setExpanded(firstIncomplete === -1 ? stages.length - 1 : firstIncomplete)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [challengeId, stages, user, buildDraft])

  const completedCount = useMemo(
    () => stages.filter((_, index) => (savedProgress[index]?.status ?? "not_started") === "completed").length,
    [stages, savedProgress],
  )

  // 第一个未完成的阶段即"当前步"；它之后的阶段锁定，逐步解锁。
  const currentStep = useMemo(() => {
    const firstIncomplete = stages.findIndex((_, i) => (savedProgress[i]?.status ?? "not_started") !== "completed")
    return firstIncomplete === -1 ? stages.length - 1 : firstIncomplete
  }, [stages, savedProgress])

  const isUnlocked = useCallback(
    (index: number) => (savedProgress[index]?.status ?? "not_started") === "completed" || index <= currentStep,
    [savedProgress, currentStep],
  )

  const personalPlanStepByIndex = useMemo(() => {
    const map = new Map<number, ChallengePersonalPlanStep>()
    workspace?.personalPlan?.steps.forEach((step) => {
      map.set(step.stageIndex, step)
    })
    return map
  }, [workspace])

  const currentPersonalPlanStep = personalPlanStepByIndex.get(currentStep)

  // 最新草稿放 ref，让 getReviewPayload 始终读到最新值，又不必把 drafts 加进依赖（每次按键都会变）。
  const draftsRef = useRef(drafts)
  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    const stage = stages[currentStep]
    const stageKind = stage?.kind ?? "generic"
    const quickPrompts = currentPersonalPlanStep
      ? ["这一步怎么贴合我的项目方向？", ...KIND_QUICK_PROMPTS[stageKind]]
      : KIND_QUICK_PROMPTS[stageKind]
    setTutorOverride({
      stageIndex: currentStep,
      stageTitle: stage?.title,
      subtitle: workspace?.projectGoal
        ? `围绕「${workspace.projectGoal}」推进这步`
        : stage?.title
          ? `陪你完成「${stage.title}」这步`
          : undefined,
      quickPrompts,
      getReviewPayload: () => {
        const draft = draftsRef.current[currentStep]
        if (!draft || (!draft.notes.trim() && draft.images.length === 0)) return null
        const stageTitle = stage?.title ?? `阶段 ${currentStep + 1}`
        const goalText = workspace?.projectGoal ? `我的项目方向：${workspace.projectGoal}\n` : ""
        const planText = currentPersonalPlanStep ? `本步重点：${currentPersonalPlanStep.focus}\n` : ""
        return {
          text: `${goalText}${planText}请看看我在「${stageTitle}」这一步的产出，给我一点改进方向：\n${draft.notes.trim() || "（先上传了图片）"}`,
          images: draft.images,
        }
      },
    })
    return () => clearTutorOverride()
  }, [
    setTutorOverride,
    clearTutorOverride,
    currentStep,
    stages,
    workspace?.projectGoal,
    currentPersonalPlanStep,
  ])

  const ensureCanEdit = useCallback(() => {
    if (!user) {
      promptLogin(() => undefined, {
        title: "登录后记录过程",
        description: "登录后就能逐步记录产出，还能找 AI 导师答疑。",
      })
      return false
    }
    if (!isActive) {
      toast({ title: "挑战未开放，阶段产出仅可查看", variant: "destructive" })
      return false
    }
    return true
  }, [user, isActive, promptLogin, toast])

  const setDraftField = useCallback(<K extends keyof StageDraft>(index: number, key: K, value: StageDraft[K]) => {
    setDrafts((current) => ({
      ...current,
      [index]: { ...(current[index] ?? buildDraft(index)), [key]: value },
    }))
  }, [buildDraft])

  const markDirty = useCallback((index: number) => {
    dirtyStagesRef.current.add(index)
    setDirtyTick((tick) => tick + 1)
  }, [])

  const editDraftField = useCallback(<K extends keyof StageDraft>(index: number, key: K, value: StageDraft[K]) => {
    setDraftField(index, key, value)
    markDirty(index)
  }, [setDraftField, markDirty])

  const buildStagePayload = useCallback((index: number, status: StageProgressStatus) => {
    const draft = drafts[index] ?? buildDraft(index)
    const stage = stages[index]
    const hasDataField = stage.kind ? Boolean(KIND_DATA_LABEL[stage.kind]) : false
    const hasChecklist = (stage.checklist?.length ?? 0) > 0

    const dataPayload: Record<string, unknown> = {}
    if (hasDataField && draft.dataSummary.trim()) dataPayload.summary = draft.dataSummary.trim()
    if (hasChecklist) dataPayload.checked = draft.checked

    return {
      status,
      notes: draft.notes.trim() || null,
      images: draft.images,
      data: Object.keys(dataPayload).length > 0 ? dataPayload : null,
    }
  }, [drafts, stages, buildDraft])

  const handleUpload = useCallback(async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (selected.length === 0) return
    if (!ensureCanEdit()) return

    const draft = drafts[index] ?? buildDraft(index)
    const remaining = MAX_STAGE_IMAGES - (draft.images.length + (uploadingByStage[index]?.length ?? 0))
    const batch = selected.filter((file) => file.type.startsWith("image/")).slice(0, Math.max(0, remaining))
    if (batch.length === 0) {
      toast({ title: `每个阶段最多 ${MAX_STAGE_IMAGES} 张图片`, variant: "destructive" })
      return
    }

    const { uploadFileSecureWithProgress } = await import("@/lib/utils/upload")

    const items: UploadingImage[] = batch.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      preview: URL.createObjectURL(file),
      progress: 0,
    }))
    setUploadingByStage((current) => ({ ...current, [index]: [...(current[index] ?? []), ...items] }))

    await Promise.all(
      batch.map(async (file, i) => {
        const item = items[i]
        const url = await uploadFileSecureWithProgress(
          file,
          "project-completions",
          (loaded, total) => {
            const progress = Math.round((loaded / total) * 100)
            setUploadingByStage((current) => ({
              ...current,
              [index]: (current[index] ?? []).map((entry) => (entry.id === item.id ? { ...entry, progress } : entry)),
            }))
          },
          "challenge-submissions",
        )

        if (url) {
          setDrafts((current) => {
            const base = current[index] ?? buildDraft(index)
            return { ...current, [index]: { ...base, images: [...base.images, url] } }
          })
          markDirty(index)
          setUploadingByStage((current) => ({
            ...current,
            [index]: (current[index] ?? []).filter((entry) => entry.id !== item.id),
          }))
          URL.revokeObjectURL(item.preview)
        } else {
          setUploadingByStage((current) => ({
            ...current,
            [index]: (current[index] ?? []).map((entry) => (entry.id === item.id ? { ...entry, error: "上传失败" } : entry)),
          }))
          toast({ title: "图片上传失败", description: "请确认网络或稍后重试。", variant: "destructive" })
        }
      }),
    )
  }, [drafts, uploadingByStage, buildDraft, toast, ensureCanEdit, markDirty])

  const toggleCheck = useCallback((index: number, itemIndex: number) => {
    setDrafts((current) => {
      const base = current[index] ?? buildDraft(index)
      const set = new Set(base.checked)
      if (set.has(itemIndex)) set.delete(itemIndex)
      else set.add(itemIndex)
      return { ...current, [index]: { ...base, checked: Array.from(set).sort((a, b) => a - b) } }
    })
    markDirty(index)
  }, [buildDraft, markDirty])

  const removeImage = useCallback((index: number, imageIndex: number) => {
    setDrafts((current) => {
      const base = current[index] ?? buildDraft(index)
      return { ...current, [index]: { ...base, images: base.images.filter((_, i) => i !== imageIndex) } }
    })
    markDirty(index)
  }, [buildDraft, markDirty])

  // 自动保存：编辑停顿 1.5s 后把脏阶段以当前状态落库（已完成的保持已完成）。
  useEffect(() => {
    if (!user || !isActive) return
    if (dirtyStagesRef.current.size === 0) return

    const timer = setTimeout(() => {
      const indexes = Array.from(dirtyStagesRef.current)
      dirtyStagesRef.current.clear()

      indexes.forEach((index) => {
        // 手动「完成这步」进行中时跳过，避免状态互相覆盖。
        if (savingIndex === index) return
        const status: StageProgressStatus =
          (savedProgress[index]?.status ?? "not_started") === "completed" ? "completed" : "in_progress"

        const run = (async () => {
          setAutosaveState((current) => ({ ...current, [index]: "saving" }))
          try {
            const res = await fetch(`/api/challenges/${challengeId}/stages/${index}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildStagePayload(index, status)),
            })
            const payload = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(payload?.error || "保存失败")
            const progress = payload.progress as StageProgress | null
            if (progress) setSavedProgress((current) => ({ ...current, [index]: progress }))
            setAutosaveState((current) => ({ ...current, [index]: "saved" }))
          } catch (error) {
            logger.error("Stage autosave failed", { error })
            // 标回脏，下次编辑会重试。
            dirtyStagesRef.current.add(index)
            setAutosaveState((current) => ({ ...current, [index]: "error" }))
          }
        })()
        autosaveInflightRef.current.set(
          index,
          run.finally(() => autosaveInflightRef.current.delete(index)),
        )
      })
    }, 1500)

    return () => clearTimeout(timer)
  }, [dirtyTick, drafts, user, isActive, savedProgress, savingIndex, challengeId, buildStagePayload])

  const saveStage = useCallback(async (index: number, nextStatus: StageProgressStatus) => {
    if (!ensureCanEdit()) return

    setSavingIndex(index)
    try {
      // 等待该阶段在途的自动保存结束，避免旧请求把状态改回去。
      dirtyStagesRef.current.delete(index)
      const inflight = autosaveInflightRef.current.get(index)
      if (inflight) await inflight

      const res = await fetch(`/api/challenges/${challengeId}/stages/${index}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildStagePayload(index, nextStatus)),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "保存失败")

      const progress = payload.progress as StageProgress | null
      if (progress) {
        setSavedProgress((current) => ({ ...current, [index]: progress }))
        setDraftField(index, "status", progress.status)
      }
      if (nextStatus === "completed") {
        toast({ title: "本阶段已完成，下一步解锁啦" })
        const nextIndex = index + 1
        if (nextIndex < stages.length) setExpanded(nextIndex)
      }
    } catch (error) {
      logger.error("Stage progress save failed", { error })
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSavingIndex(null)
    }
  }, [challengeId, stages, ensureCanEdit, buildStagePayload, setDraftField, toast])

  const reviewStage = useCallback(async (index: number) => {
    if (!ensureCanEdit()) return
    const draft = drafts[index] ?? buildDraft(index)
    if (!hasReviewableDraft(draft)) {
      toast({ title: "先填写这一步的产出，再请导师看看", variant: "destructive" })
      return
    }

    setReviewingIndex(index)
    try {
      dirtyStagesRef.current.delete(index)
      const inflight = autosaveInflightRef.current.get(index)
      if (inflight) await inflight

      const res = await fetch(`/api/challenges/${challengeId}/stages/${index}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildStagePayload(index, draft.status)),
      })
      const payload = await res.json().catch(() => ({}))

      const progress = payload.progress as StageProgress | null
      if (progress) {
        setSavedProgress((current) => ({ ...current, [index]: progress }))
        setDraftField(index, "status", progress.status)
      }
      if (!res.ok) throw new Error(payload?.error || "导师反馈失败")
      setAutosaveState((current) => ({ ...current, [index]: "saved" }))
      toast({ title: "导师反馈已生成" })
    } catch (error) {
      logger.error("Stage review failed", { error })
      toast({
        title: "导师反馈失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setReviewingIndex(null)
    }
  }, [
    drafts,
    buildDraft,
    toast,
    ensureCanEdit,
    challengeId,
    buildStagePayload,
    setDraftField,
  ])

  const runCoachAction = useCallback(async (index: number, action: StageCoachAction) => {
    if (!ensureCanEdit()) return

    const draft = drafts[index] ?? buildDraft(index)
    setRunningCoachAction({ stageIndex: index, action })
    try {
      dirtyStagesRef.current.delete(index)
      const inflight = autosaveInflightRef.current.get(index)
      if (inflight) await inflight

      const nextStatus: StageProgressStatus =
        (savedProgress[index]?.status ?? "not_started") === "completed" ? "completed" : "in_progress"
      const res = await fetch(`/api/challenges/${challengeId}/stages/${index}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildStagePayload(index, nextStatus), action }),
      })
      const payload = await res.json().catch(() => ({}))

      const progress = payload.progress as StageProgress | null
      if (progress) {
        setSavedProgress((current) => ({ ...current, [index]: progress }))
        setDraftField(index, "status", progress.status)
      }
      if (!res.ok) throw new Error(payload?.error || "导师工具失败")

      const result = payload.result as StageCoachActionResult | null
      if (result) {
        setCoachActionResults((current) => ({
          ...current,
          [index]: { ...(current[index] ?? {}), [action]: result },
        }))
      }
      setAutosaveState((current) => ({ ...current, [index]: "saved" }))
      if (!hasReviewableDraft(draft) && action === "summary") {
        toast({ title: "已整理当前阶段", description: "材料还少时，导师会优先提示缺什么证据。" })
      }
    } catch (error) {
      logger.error("Stage coach action failed", { error })
      toast({
        title: "导师工具失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setRunningCoachAction(null)
    }
  }, [
    drafts,
    buildDraft,
    savedProgress,
    ensureCanEdit,
    challengeId,
    buildStagePayload,
    setDraftField,
    toast,
  ])

  const saveProjectGoal = useCallback(async () => {
    if (!ensureCanEdit()) return

    setWorkspaceSaving(true)
    try {
      const normalizedGoal = projectGoalDraft.trim()
      const res = await fetch(`/api/challenges/${challengeId}/workspace`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_goal: normalizedGoal || null }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "保存失败")

      const nextWorkspace = (payload.workspace ?? null) as ChallengeWorkspace | null
      setWorkspace(nextWorkspace)
      setProjectGoalDraft(nextWorkspace?.projectGoal ?? "")
      toast({
        title: nextWorkspace ? "项目方向已保存" : "项目方向已清空",
        description: nextWorkspace ? "每个阶段已生成更贴合你目标的提示。" : undefined,
      })
    } catch (error) {
      logger.error("Challenge workspace save failed", { error })
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setWorkspaceSaving(false)
    }
  }, [challengeId, ensureCanEdit, projectGoalDraft, toast])

  if (!stages || stages.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">阶段引导</h3>
          <p className="mt-1 text-xs text-muted-foreground">一步一步推进：产出会自动保存，完成当前这步解锁下一步。</p>
        </div>
        <span className="shrink-0 rounded-full bg-[hsl(var(--surface-muted)/0.7)] px-3 py-1 text-xs font-semibold tabular-nums">
          {completedCount}/{stages.length} 完成
        </span>
      </div>

      {user ? (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--status-info-surface)/0.32)] p-3.5">
          <div className="flex items-start gap-2.5">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-blue))]" />
            <div className="min-w-0 flex-1">
              <Label htmlFor="pbl-project-goal" className="text-sm font-semibold">
                我的项目方向
              </Label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                用一句话写下你想做成什么，工作台会把每一步提示调整到这个方向上。
              </p>
            </div>
          </div>
          <Textarea
            id="pbl-project-goal"
            value={projectGoalDraft}
            onChange={(event) => setProjectGoalDraft(event.target.value)}
            maxLength={160}
            placeholder="例如：做一个适合操场午休区的小型遮阳模型。"
            disabled={!isActive || workspaceSaving}
            className="min-h-[68px] bg-background/82 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-[11px] text-muted-foreground">
              {projectGoalDraft.trim().length}/160
              {workspace?.personalPlan ? ` · 已生成 ${workspace.personalPlan.steps.length} 个阶段提示` : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void saveProjectGoal()}
              disabled={!isActive || workspaceSaving}
            >
              {workspaceSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              保存方向
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2.5 rounded-[var(--radius-md)] border border-dashed border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-muted)/0.45)] p-3.5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">登录后保存你的项目方向</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">保存后，每个阶段会出现更贴合你目标的推进提示。</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              promptLogin(() => undefined, {
                title: "登录后设置项目方向",
                description: "登录后就能保存目标并生成个人化阶段提示。",
              })
            }
          >
            登录后设置
          </Button>
        </div>
      )}

      <div className="space-y-2.5">
        {stages.map((stage, index) => {
          const draft = drafts[index] ?? buildDraft(index)
          const saved = savedProgress[index]
          const status = saved?.status ?? "not_started"
          const meta = statusMeta(status)
          const unlocked = isUnlocked(index)
          if (!unlocked) return null
          const isOpen = expanded === index
          const uploading = uploadingByStage[index] ?? []
          const totalImages = draft.images.length + uploading.length
          const kind = stage.kind ?? "generic"
          const dataField = stage.kind ? KIND_DATA_LABEL[stage.kind] : undefined
          const personalStep = personalPlanStepByIndex.get(index)
          const actionResults = coachActionResults[index] ?? {}

          return (
            <div
              key={index}
              className={cn(
                "rounded-[var(--radius-md)] border bg-[hsl(var(--surface-muted)/0.5)] transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300",
                isOpen ? "border-[hsl(var(--brand-blue)/0.4)]" : "border-transparent",
              )}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? -1 : index)}
                className="flex w-full items-center gap-3.5 px-3.5 py-3.5 text-left"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[13px] font-bold tabular-nums",
                    status === "completed"
                      ? "bg-[hsl(var(--brand-green)/0.16)] text-[hsl(var(--brand-green))]"
                      : isOpen
                        ? "bg-[hsl(var(--brand-blue))] text-[hsl(var(--brand-blue-foreground))]"
                        : "bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]",
                  )}
                >
                  {status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold tracking-tight">{stage.title}</h4>
                    <span className="rounded-full bg-[hsl(var(--surface-raised))] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {KIND_LABEL[kind]}
                    </span>
                  </div>
                  {!isOpen && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{stage.description}</p>
                  )}
                </div>

                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    meta.tone === "success" && "bg-[hsl(var(--status-success-surface)/0.7)] text-[hsl(var(--brand-green))]",
                    meta.tone === "info" && "bg-[hsl(var(--status-info-surface)/0.7)] text-[hsl(var(--brand-blue))]",
                    meta.tone === "muted" && "bg-[hsl(var(--surface-raised))] text-muted-foreground",
                  )}
                >
                  {meta.label}
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>

              {isOpen && (
                <div className="space-y-4 border-t border-[hsl(var(--surface-border)/0.5)] px-3.5 py-4">
                  <p className="text-sm leading-6 text-foreground/85">{stage.description}</p>

                  {stage.hint && (
                    <details className="group rounded-[var(--radius-sm)] bg-[hsl(var(--brand-amber)/0.1)] px-3 py-2">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-[hsl(var(--brand-amber))]">
                        <Lightbulb className="h-3.5 w-3.5" />
                        看一个提示
                      </summary>
                      <p className="mt-2 text-[13px] leading-6 text-foreground/80">{stage.hint}</p>
                    </details>
                  )}

                  {personalStep && (
                    <div className="space-y-2 rounded-[var(--radius-sm)] border border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--status-info-surface)/0.28)] p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--brand-blue))]">
                        <Sparkles className="h-3.5 w-3.5" />
                        个人化计划
                      </div>
                      <div className="space-y-1.5 text-[13px] leading-6 text-foreground/82">
                        <p><span className="font-semibold text-foreground">本步重点：</span>{personalStep.focus}</p>
                        <p><span className="font-semibold text-foreground">证据提醒：</span>{personalStep.evidencePrompt}</p>
                        <p><span className="font-semibold text-foreground">完成判断：</span>{personalStep.checkpointPrompt}</p>
                      </div>
                    </div>
                  )}

                  {!user ? (
                    <div className="flex flex-col items-start gap-2.5 rounded-[var(--radius-sm)] bg-[hsl(var(--surface-raised)/0.7)] p-3.5">
                      <p className="text-sm font-medium">登录后即可记录这一步的产出，并找 AI 导师答疑。</p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          promptLogin(() => undefined, {
                            title: "登录后记录过程",
                            description: "登录后就能逐步记录产出。",
                          })
                        }
                      >
                        登录后记录
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label className="text-[13px] font-semibold">我的产出</Label>
                      <Textarea
                        value={draft.notes}
                        onChange={(e) => editDraftField(index, "notes", e.target.value)}
                        placeholder="记录这一步你做了什么、看到了什么、得到什么结果。"
                        className="min-h-[96px] text-sm"
                        disabled={!isActive}
                      />

                      {dataField && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{dataField.label}</Label>
                          <Textarea
                            value={draft.dataSummary}
                            onChange={(e) => editDraftField(index, "dataSummary", e.target.value)}
                            placeholder={dataField.placeholder}
                            className="min-h-[64px] text-sm"
                            disabled={!isActive}
                          />
                        </div>
                      )}

                      {stage.checklist && stage.checklist.length > 0 && (
                        <div className="space-y-2 rounded-[var(--radius-sm)] bg-[hsl(var(--surface-raised)/0.7)] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-semibold">完成清单</Label>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{draft.checked.length}/{stage.checklist.length}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">做到这些就算这步做好了（怎么做由你决定）。</p>
                          <div className="space-y-1.5">
                            {stage.checklist.map((item, itemIndex) => {
                              const done = draft.checked.includes(itemIndex)
                              return (
                                <label key={itemIndex} className="flex cursor-pointer items-start gap-2 text-[13px] leading-6">
                                  <Checkbox
                                    checked={done}
                                    onCheckedChange={() => toggleCheck(index, itemIndex)}
                                    disabled={!isActive}
                                    className="mt-0.5"
                                  />
                                  <span className={done ? "text-muted-foreground line-through" : "text-foreground/85"}>{item}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 rounded-[var(--radius-sm)] border border-[hsl(var(--surface-border)/0.7)] bg-[hsl(var(--surface-raised)/0.58)] p-3">
                        <div className="flex items-start gap-2">
                          <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--brand-blue))]" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold">导师工具</p>
                            <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                              用结构化动作推进这一步，结果只作为参考。
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {COACH_ACTION_META.map((item) => {
                            const isRunning = runningCoachAction?.stageIndex === index && runningCoachAction.action === item.action
                            return (
                              <button
                                key={item.action}
                                type="button"
                                onClick={() => void runCoachAction(index, item.action)}
                                disabled={!isActive || Boolean(runningCoachAction)}
                                className="rounded-[var(--radius-xs)] border border-[hsl(var(--surface-border)/0.72)] bg-background/72 px-2.5 py-2 text-left transition-colors hover:border-[hsl(var(--brand-blue)/0.42)] hover:bg-[hsl(var(--status-info-surface)/0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="flex items-center gap-1.5 text-[12px] font-semibold">
                                  {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--brand-blue))]" />}
                                  {isRunning ? "处理中" : item.label}
                                </span>
                                <span className="mt-1 block text-[11px] text-muted-foreground">{item.description}</span>
                              </button>
                            )
                          })}
                        </div>
                        {Object.keys(actionResults).length > 0 && (
                          <div className="space-y-2 pt-1">
                            {COACH_ACTION_META.map((item) => {
                              const result = actionResults[item.action]
                              if (!result) return null
                              return (
                                <div key={item.action} className="rounded-[var(--radius-xs)] bg-[hsl(var(--status-info-surface)/0.28)] p-2.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-[12px] font-semibold text-[hsl(var(--brand-blue))]">{result.title}</p>
                                    {result.generatedAt && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {new Date(result.generatedAt).toLocaleTimeString("zh-CN", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    )}
                                  </div>
                                  <ul className="mt-1.5 space-y-1 text-[12px] leading-5 text-foreground/78">
                                    {result.bullets.map((bullet, bulletIndex) => (
                                      <li key={`${item.action}-${bulletIndex}`} className="flex gap-1.5">
                                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--brand-blue))] opacity-45" />
                                        <span>{bullet}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <p className="mt-1.5 text-[11px] font-medium text-foreground/70">{result.followUp}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">图片 {draft.images.length}/{MAX_STAGE_IMAGES}</span>
                        {isActive && totalImages < MAX_STAGE_IMAGES ? (
                          <Button asChild variant="outline" size="sm">
                            <label className="cursor-pointer">
                              <Upload className="mr-1.5 h-3.5 w-3.5" />
                              上传图片
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                multiple
                                className="hidden"
                                onChange={(e) => handleUpload(index, e)}
                              />
                            </label>
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" disabled>
                            <Upload className="mr-1.5 h-3.5 w-3.5" />
                            上传图片
                          </Button>
                        )}
                      </div>

                      {(draft.images.length > 0 || uploading.length > 0) && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {draft.images.map((image, imageIndex) => (
                            <div key={`${image}-${imageIndex}`} className="relative aspect-square overflow-hidden rounded-[var(--radius-xs)] bg-muted">
                              <OptimizedImage src={image} alt={`阶段图 ${imageIndex + 1}`} fill variant="thumbnail" className="object-cover" />
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => removeImage(index, imageIndex)}
                                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          {uploading.map((item) => (
                            <div key={item.id} className="relative aspect-square overflow-hidden rounded-[var(--radius-xs)] bg-muted">
                              <OptimizedImage src={item.preview} alt="上传中" fill variant="thumbnail" className="object-cover opacity-70" />
                              {item.error ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--status-danger)/0.7)] px-1 text-center text-[11px] font-medium text-white">
                                  {item.error}
                                </div>
                              ) : (
                                <div className="absolute inset-x-1 bottom-1">
                                  <Progress value={item.progress} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {saved?.aiFeedback && (
                        <div className="space-y-3 rounded-[var(--radius-sm)] border border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.72)] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--brand-blue))]">
                              <Sparkles className="h-3.5 w-3.5" />
                              导师反馈
                            </div>
                            {saved.aiFeedback.generatedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(saved.aiFeedback.generatedAt).toLocaleString("zh-CN", {
                                  month: "numeric",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            {[
                              { label: "做得好", items: saved.aiFeedback.strengths, tone: "text-[hsl(var(--brand-green))]" },
                              { label: "还缺", items: saved.aiFeedback.gaps, tone: "text-[hsl(var(--brand-amber))]" },
                              { label: "下一步", items: saved.aiFeedback.nextActions, tone: "text-[hsl(var(--brand-blue))]" },
                            ].map((section) => (
                              <div key={section.label} className="space-y-1.5">
                                <p className={cn("text-[11px] font-semibold", section.tone)}>{section.label}</p>
                                {section.items.length > 0 ? (
                                  <ul className="space-y-1 text-[12px] leading-5 text-foreground/78">
                                    {section.items.map((item, itemIndex) => (
                                      <li key={`${section.label}-${itemIndex}`} className="flex gap-1.5">
                                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-45" />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[12px] leading-5 text-muted-foreground">暂无</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isActive && (
                        <div className="flex flex-wrap items-center gap-2.5">
                          {status === "completed" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--brand-green))]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              已完成
                            </span>
                          ) : (
                            <Button type="button" size="sm" tone="success" onClick={() => void saveStage(index, "completed")} disabled={savingIndex === index}>
                              {savingIndex === index ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                              完成这步
                            </Button>
                          )}
                          <span className="text-[11px] text-muted-foreground" aria-live="polite">
                            {autosaveState[index] === "saving"
                              ? "保存中…"
                              : autosaveState[index] === "saved"
                                ? "已自动保存"
                                : autosaveState[index] === "error"
                                  ? "自动保存失败，继续编辑会重试"
                                  : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => void reviewStage(index)}
                            disabled={reviewingIndex === index}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--status-info-surface)/0.6)] px-3 py-1.5 text-xs font-medium text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--status-info-surface))] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {reviewingIndex === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            {reviewingIndex === index ? "导师查看中" : saved?.aiFeedback ? "重新查看这步" : "请导师看看这步"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {stages.length - 1 > currentStep && (
          <p className="flex items-center gap-2 px-3.5 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            还有 {stages.length - 1 - currentStep} 步，完成当前这步后解锁
          </p>
        )}
      </div>

      {!isActive && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          挑战未开放，阶段产出仅可查看。
        </p>
      )}
    </div>
  )
}
