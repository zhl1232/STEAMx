"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import {
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  Loader2,
  Lock,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
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
import { cn } from "@/lib/utils"

const MAX_STAGE_IMAGES = 6
const TUTOR_AVATAR = "/ai-tutor-mascot.png"

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

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  images?: string[]
  error?: boolean
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

  const [drafts, setDrafts] = useState<Record<number, StageDraft>>({})
  const [savedProgress, setSavedProgress] = useState<Record<number, StageProgress>>({})
  const [expanded, setExpanded] = useState<number>(0)
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [uploadingByStage, setUploadingByStage] = useState<Record<number, UploadingImage[]>>({})
  const [autosaveState, setAutosaveState] = useState<Record<number, "saving" | "saved" | "error">>({})
  // 用户编辑过、尚未自动保存的阶段；ref 存集合，tick 触发防抖 effect。
  const dirtyStagesRef = useRef<Set<number>>(new Set())
  const [dirtyTick, setDirtyTick] = useState(0)
  const autosaveInflightRef = useRef<Map<number, Promise<void>>>(new Map())

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatBusy, setChatBusy] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

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
      const res = await fetch(`/api/challenges/${challengeId}/stages`)
      if (cancelled) return
      const progressList: StageProgress[] = res.ok ? (await res.json()).progress ?? [] : []
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

      const firstIncomplete = stages.findIndex((_, index) => progressMap[index]?.status !== "completed")
      setExpanded(firstIncomplete === -1 ? stages.length - 1 : firstIncomplete)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [challengeId, stages, user, buildDraft])

  // Load persisted tutor conversation from the database (source of truth).
  useEffect(() => {
    if (!user) {
      setChatMessages([])
      return
    }
    let cancelled = false
    const loadChat = async () => {
      try {
        const res = await fetch(`/api/challenges/${challengeId}/coach`)
        if (!res.ok || cancelled) return
        const payload = await res.json()
        if (cancelled) return
        const loaded = (payload.messages ?? []) as Array<{ role: "user" | "assistant"; content: string; images?: string[] }>
        setChatMessages(loaded.map((m) => ({ role: m.role, content: m.content, images: m.images })))
      } catch {
        // keep local state on failure
      }
    }
    void loadChat()
    return () => {
      cancelled = true
    }
  }, [challengeId, user])

  useEffect(() => {
    const node = chatScrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [chatMessages, chatBusy, chatOpen])

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

  const sendToTutor = useCallback(async (text: string, images?: string[]) => {
    if (!ensureCanEdit()) return
    const trimmed = text.trim()
    if (!trimmed && (!images || images.length === 0)) return

    const userMessage: ChatMessage = { role: "user", content: trimmed, images: images && images.length ? images : undefined }
    setChatMessages((current) => [...current, userMessage])
    setChatInput("")
    setChatBusy(true)
    if (!chatOpen) setChatOpen(true)

    try {
      const res = await fetch(`/api/challenges/${challengeId}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageIndex: currentStep,
          content: trimmed,
          images: images ?? [],
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "AI 导师暂时不可用")
      setChatMessages((current) => [...current, { role: "assistant", content: payload.reply as string }])
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        { role: "assistant", content: error instanceof Error ? error.message : "导师暂时不可用，请稍后再试。", error: true },
      ])
    } finally {
      setChatBusy(false)
    }
  }, [challengeId, chatOpen, currentStep, ensureCanEdit])

  const reviewCurrentStep = useCallback(() => {
    const draft = drafts[currentStep] ?? buildDraft(currentStep)
    if (!draft.notes.trim() && draft.images.length === 0) {
      toast({ title: "先填写这一步的产出，再请导师看看", variant: "destructive" })
      return
    }
    const stageTitle = stages[currentStep]?.title ?? `阶段 ${currentStep + 1}`
    const text = `请看看我在「${stageTitle}」这一步的产出，给我一点改进方向：\n${draft.notes.trim() || "（先上传了图片）"}`
    void sendToTutor(text, draft.images)
  }, [drafts, currentStep, buildDraft, stages, toast, sendToTutor])

  const handleChatKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void sendToTutor(chatInput)
    }
  }

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
                            onClick={reviewCurrentStep}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--status-info-surface)/0.6)] px-3 py-1.5 text-xs font-medium text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--status-info-surface))]"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            请导师看看这步
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

      <TutorFab
        open={chatOpen}
        onToggle={() => setChatOpen((v) => !v)}
        messages={chatMessages}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={() => void sendToTutor(chatInput)}
        onQuickSend={(text) => void sendToTutor(text)}
        onKeyDown={handleChatKeyDown}
        onReview={reviewCurrentStep}
        busy={chatBusy}
        loggedIn={Boolean(user)}
        currentStageTitle={stages[currentStep]?.title ?? ""}
        quickPrompts={KIND_QUICK_PROMPTS[stages[currentStep]?.kind ?? "generic"]}
        scrollRef={chatScrollRef}
        onLogin={() =>
          promptLogin(() => undefined, {
            title: "登录后找 AI 导师",
            description: "登录后即可和 AI 导师一对一聊这道挑战。",
          })
        }
      />

      {!isActive && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          挑战未开放，阶段产出仅可查看。
        </p>
      )}
    </div>
  )
}

interface TutorFabProps {
  open: boolean
  onToggle: () => void
  messages: ChatMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onQuickSend: (text: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onReview: () => void
  busy: boolean
  loggedIn: boolean
  currentStageTitle: string
  quickPrompts: string[]
  scrollRef: RefObject<HTMLDivElement | null>
  onLogin: () => void
}

function TutorFab({
  open,
  onToggle,
  messages,
  input,
  onInputChange,
  onSend,
  onQuickSend,
  onKeyDown,
  onReview,
  busy,
  loggedIn,
  currentStageTitle,
  quickPrompts,
  scrollRef,
  onLogin,
}: TutorFabProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <>
      {open && (
        <section className="fixed right-4 z-50 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--brand-blue)/0.3)] bg-[hsl(var(--surface-raised))] shadow-[0_24px_60px_-20px_hsl(var(--surface-shadow)/0.55)] bottom-[calc(12rem+env(safe-area-inset-bottom))] md:bottom-24 md:right-6">
          <div className="flex items-center gap-3 border-b border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--status-info-surface)/0.5)] px-3.5 py-3">
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-[hsl(var(--brand-blue)/0.35)]">
              <OptimizedImage src={TUTOR_AVATAR} alt="AI 导师小思" fill variant="thumbnail" className="object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                小思 · AI 学习导师
                <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--brand-blue))]" />
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                {currentStageTitle ? `陪你完成「${currentStageTitle}」这步` : "陪你一步步完成挑战"}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-label="收起导师"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-muted))]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-[min(52vh,420px)] flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
            {messages.length === 0 && (
              <>
                <TutorBubble>
                  你好呀！我是小思 👋 这道挑战我会一路陪着你。我记得你每一步写了什么，可以帮你出主意、也会提醒你下一步。先从下面挑一个问我吧～
                </TutorBubble>
                {loggedIn && currentStageTitle && (
                  <div className="pl-9">
                    <button
                      type="button"
                      onClick={() => onQuickSend(`带我开始「${currentStageTitle}」这一步：先用一两句话说清这步的重点，再给我第一个可以马上做的小动作。`)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--brand-blue))] px-3.5 py-1.5 text-xs font-semibold text-[hsl(var(--brand-blue-foreground))] shadow-sm transition-transform hover:scale-[1.03] disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      带我开始这一步
                    </button>
                  </div>
                )}
                {loggedIn && quickPrompts.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-9">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => onQuickSend(prompt)}
                        disabled={busy}
                        className="rounded-full border border-[hsl(var(--brand-blue)/0.3)] bg-[hsl(var(--surface-raised))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--status-info-surface)/0.6)] disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {messages.map((message, i) =>
              message.role === "assistant" ? (
                <TutorBubble key={i} error={message.error}>
                  {message.content}
                </TutorBubble>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] space-y-1.5">
                    {message.content && (
                      <div className="whitespace-pre-wrap rounded-[var(--radius-sm)] rounded-tr-sm bg-[hsl(var(--brand-blue))] px-3 py-2 text-[13px] leading-6 text-[hsl(var(--brand-blue-foreground))]">
                        {message.content}
                      </div>
                    )}
                    {message.images && message.images.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {message.images.map((image, idx) => (
                          <span key={idx} className="relative h-12 w-12 overflow-hidden rounded-[var(--radius-xs)] bg-muted">
                            <OptimizedImage src={image} alt="产出图" fill variant="thumbnail" className="object-cover" />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <TutorBubble>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  小思正在思考…
                </span>
              </TutorBubble>
            )}
          </div>

          {loggedIn ? (
            <div className="space-y-2 border-t border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.7)] px-3.5 py-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="问问小思这一步怎么想…（Enter 发送）"
                  className="min-h-[40px] flex-1 resize-none text-sm"
                  disabled={busy}
                />
                <Button type="button" size="icon" onClick={onSend} disabled={busy || !input.trim()} aria-label="发送">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <button
                type="button"
                onClick={onReview}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--brand-blue))] hover:underline"
              >
                <Sparkles className="h-3.5 w-3.5" />
                让导师看看我现在这步的产出
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2 border-t border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.7)] px-3.5 py-3">
              <p className="text-xs text-muted-foreground">登录后就能和小思一对一聊这道挑战。</p>
              <Button type="button" size="sm" onClick={onLogin}>
                登录后提问
              </Button>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "收起 AI 导师" : "打开 AI 导师"}
        className={cn(
          "fixed right-4 z-50 hidden h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--surface-raised))] shadow-[0_16px_36px_-12px_hsl(var(--brand-blue)/0.6)] ring-2 ring-[hsl(var(--brand-blue)/0.4)] transition-transform hover:scale-105 active:scale-95 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:right-6 md:inline-flex",
        )}
      >
        {open ? (
          <ChevronDown className="h-6 w-6 text-[hsl(var(--brand-blue))]" />
        ) : (
          <>
            <span className="relative h-full w-full overflow-hidden rounded-full">
              <OptimizedImage src={TUTOR_AVATAR} alt="AI 导师小思" fill variant="thumbnail" className="object-cover" />
            </span>
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--brand-blue))] ring-2 ring-[hsl(var(--surface-raised))]">
              <Sparkles className="h-2.5 w-2.5 text-[hsl(var(--brand-blue-foreground))]" />
            </span>
          </>
        )}
      </button>
    </>,
    document.body,
  )
}

function TutorBubble({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-[hsl(var(--brand-blue)/0.3)]">
        <OptimizedImage src={TUTOR_AVATAR} alt="小思" fill variant="thumbnail" className="object-cover" />
      </span>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-[var(--radius-sm)] rounded-tl-sm px-3 py-2 text-[13px] leading-6",
          error
            ? "bg-[hsl(var(--status-danger-surface)/0.7)] text-[hsl(var(--status-danger))]"
            : "bg-[hsl(var(--surface-raised))] text-foreground/88",
        )}
      >
        {children}
      </div>
    </div>
  )
}
