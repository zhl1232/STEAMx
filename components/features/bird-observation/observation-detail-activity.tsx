"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftRight,
  Bot,
  Check,
  HelpCircle,
  Loader2,
  Search,
  Send,
  UserRound,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { buildActivityStream, type ActivityStreamItem } from "@/lib/observations/activity-stream"
import {
  computeConsensusUiState,
  CONSENSUS_RULES_SUMMARY,
} from "@/lib/observations/consensus-ui"
import type { Comment, ObservationIdentification, ObservationSpeciesSummary } from "@/lib/mappers/types"
import {
  formatObservationLifecycleStage,
  formatObservationSex,
  observationLifecycleStageOptions,
  observationSexOptions,
  type ObservationLifecycleStage,
  type ObservationSex,
} from "@/lib/observations/traits"
import type { ObservationSubmitTopic } from "@/lib/observations/submit-topic"
import {
  ObservationSpeciesCompareSheet,
  type CompareSpeciesTarget,
} from "@/components/features/bird-observation/observation-species-compare-sheet"
import { natureActionButtonClass } from "@/lib/nature/action-buttons"
import { appendNatureFrom } from "@/lib/utils/nature-navigation"
import { cn } from "@/lib/utils"

interface SpeciesOption {
  id: number
  commonName: string
  scientificName?: string | null
  slug?: string | null
}

interface IdentificationResponse {
  identificationStatus: "needs_id" | "community_confirmed"
  confirmedSpecies: ObservationSpeciesSummary | null
  identifications: ObservationIdentification[]
  error?: string
}

interface ObservationDetailActivityProps {
  observationId: number
  ownerId: string
  topic: ObservationSubmitTopic
  isPublic: boolean
  initialStatus: "needs_id" | "community_confirmed"
  initialConfirmedSpecies?: ObservationSpeciesSummary | null
  initialIdentifications: ObservationIdentification[]
  currentPath: string
  headlineTitle: string
  headlineScientificName?: string | null
  observationMediaUrls: string[]
}

function consensusMatchesHeadline(leadingCommonName: string, headlineTitle: string): boolean {
  const normalizedHeadline = headlineTitle.replace(/（AI 建议 \d+%）$/, "").trim()
  return normalizedHeadline === leadingCommonName || headlineTitle.startsWith(leadingCommonName)
}

function formatRelativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(iso).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
}

function initials(name: string | null | undefined): string {
  const trimmed = name?.trim()
  if (!trimmed) return "?"
  return trimmed.slice(0, 1).toUpperCase()
}

function formatIdentificationTraits(identification: ObservationIdentification): string | null {
  const lifecycleStageLabel = formatObservationLifecycleStage(identification.lifecycleStage)
  const sexLabel = formatObservationSex(identification.sex)
  const parts = [
    lifecycleStageLabel ? `生命阶段：${lifecycleStageLabel}` : null,
    sexLabel ? `性别：${sexLabel}` : null,
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(" · ") : null
}

export function ObservationDetailActivity({
  observationId,
  ownerId,
  topic,
  isPublic,
  initialStatus,
  initialConfirmedSpecies = null,
  initialIdentifications,
  currentPath,
  headlineTitle,
  headlineScientificName = null,
  observationMediaUrls,
}: ObservationDetailActivityProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()

  const [identifications, setIdentifications] = useState(initialIdentifications)
  const [confirmedSpecies, setConfirmedSpecies] = useState(initialConfirmedSpecies)
  const [status, setStatus] = useState(initialStatus)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentDraft, setCommentDraft] = useState("")
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false)
  const [idSheetOpen, setIdSheetOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SpeciesOption[]>([])
  const [selected, setSelected] = useState<SpeciesOption | null>(null)
  const [lifecycleStage, setLifecycleStage] = useState<"" | ObservationLifecycleStage>("")
  const [sex, setSex] = useState<"" | ObservationSex>("")
  const [isSearching, setIsSearching] = useState(false)
  const [isSavingId, setIsSavingId] = useState(false)
  const [agreeingSpeciesId, setAgreeingSpeciesId] = useState<number | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareTarget, setCompareTarget] = useState<CompareSpeciesTarget | null>(null)

  const consensus = useMemo(
    () => computeConsensusUiState(identifications, ownerId, confirmedSpecies, status),
    [identifications, ownerId, confirmedSpecies, status],
  )

  const hideConsensusSpeciesTitle =
    consensus.leadingCommonName != null &&
    consensusMatchesHeadline(consensus.leadingCommonName, headlineTitle)

  const stream = useMemo(
    () => buildActivityStream(identifications, comments),
    [identifications, comments],
  )

  const myIdentification = useMemo(
    () => identifications.find((item) => item.source === "human" && item.identifierUserId === user?.id),
    [identifications, user?.id],
  )
  const identificationActionLabel = myIdentification
    ? "修改鉴定"
    : status === "community_confirmed"
      ? "补充鉴定"
      : "建议鉴定"

  const applyIdentificationResponse = useCallback((data: IdentificationResponse) => {
    setStatus(data.identificationStatus)
    setConfirmedSpecies(data.confirmedSpecies)
    setIdentifications(data.identifications)
    setQuery("")
    setSelected(null)
    setLifecycleStage("")
    setSex("")
    setResults([])
    setIdSheetOpen(false)
    router.refresh()
  }, [router])

  const loadComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/observations/${observationId}/comments`)
      if (!response.ok) return
      const data = await response.json()
      setComments(data.comments || [])
    } finally {
      setCommentsLoading(false)
    }
  }, [observationId])

  useEffect(() => {
    void loadComments()
  }, [loadComments])

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(
          `/api/species?q=${encodeURIComponent(normalized)}&topic=${topic}&pageSize=8`,
          { signal: controller.signal },
        )
        const body = await response.json() as { species?: SpeciesOption[] }
        if (response.ok) setResults(body.species || [])
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, 200)
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [query, topic])

  const submitIdentification = async (
    speciesId: number,
    traits: { lifecycleStage?: ObservationLifecycleStage | ""; sex?: ObservationSex | "" } = {},
  ) => {
    if (!user) {
      promptLogin(undefined, {
        title: "登录后参与鉴定",
        description: "你的鉴定会计入这条观察记录的共识。",
      })
      return
    }
    setIsSavingId(true)
    try {
      const response = await fetch(`/api/observations/${observationId}/identifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          species_id: speciesId,
          lifecycle_stage: traits.lifecycleStage || null,
          sex: traits.sex || null,
        }),
      })
      const data = await response.json() as IdentificationResponse
      if (!response.ok) throw new Error(data.error || "鉴定提交失败")
      applyIdentificationResponse(data)
      toast({ title: "鉴定已提交" })
    } catch (error) {
      toast({
        title: "鉴定提交失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsSavingId(false)
      setAgreeingSpeciesId(null)
    }
  }

  const agreeWithSpecies = async (speciesId: number) => {
    if (myIdentification?.speciesId === speciesId) return
    setAgreeingSpeciesId(speciesId)
    await submitIdentification(speciesId)
  }

  const openIdentificationSheet = () => {
    if (myIdentification) {
      setQuery(myIdentification.commonName)
      setSelected({
        id: myIdentification.speciesId,
        commonName: myIdentification.commonName,
        scientificName: myIdentification.scientificName ?? null,
        slug: myIdentification.speciesSlug ?? null,
      })
      setLifecycleStage(myIdentification.lifecycleStage ?? "")
      setSex(myIdentification.sex ?? "")
    } else {
      setQuery("")
      setSelected(null)
      setResults([])
      setLifecycleStage("")
      setSex("")
    }
    setIdSheetOpen(true)
  }

  const withdrawIdentification = async () => {
    if (!user) {
      promptLogin(undefined, { title: "登录后管理鉴定" })
      return
    }
    setIsSavingId(true)
    try {
      const response = await fetch(`/api/observations/${observationId}/identifications`, { method: "DELETE" })
      const data = await response.json() as IdentificationResponse
      if (!response.ok) throw new Error(data.error || "撤回失败")
      applyIdentificationResponse(data)
      toast({ title: "已撤回我的鉴定" })
    } catch (error) {
      toast({
        title: "撤回失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsSavingId(false)
    }
  }

  const submitComment = async () => {
    if (!user) {
      promptLogin(undefined, { title: "登录后参与讨论", description: "登录后即可发表评论。" })
      return
    }
    const trimmed = commentDraft.trim()
    if (!trimmed) return
    setIsCommentSubmitting(true)
    try {
      const response = await fetch(`/api/observations/${observationId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "评论失败")
      setComments((prev) => [...prev, data.comment as Comment])
      setCommentDraft("")
      toast({ title: "评论已发布" })
    } catch (error) {
      toast({
        title: "评论失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsCommentSubmitting(false)
    }
  }

  const speciesHref = (slug: string | null | undefined) =>
    slug ? appendNatureFrom(`/nature/species/${slug}`, currentPath) : null

  const openCompare = (identification: ObservationIdentification) => {
    if (!identification.speciesSlug) return
    setCompareTarget({
      slug: identification.speciesSlug,
      commonName: identification.commonName,
      scientificName: identification.scientificName,
    })
    setCompareOpen(true)
  }

  const compareSpeciesPageHref = compareTarget?.slug ? speciesHref(compareTarget.slug) : null

  return (
    <>
      <div className="space-y-8 border-t border-border/60 pt-6">
        <section aria-label="社群共识">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">社群共识</h2>
              <p className="mt-1 text-sm text-muted-foreground">{consensus.summary}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              aria-label="共识规则说明"
              aria-expanded={rulesOpen}
              onClick={() => setRulesOpen((open) => !open)}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          {rulesOpen ? (
            <p className="mt-3 rounded-sm bg-muted/35 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              {CONSENSUS_RULES_SUMMARY}
            </p>
          ) : null}

          {consensus.leadingCommonName ? (
            <div className={cn("mt-4", hideConsensusSpeciesTitle ? "mt-3" : "")}>
              {hideConsensusSpeciesTitle ? null : (
                <div className="mb-3">
                  <p className="text-base font-medium text-foreground">{consensus.leadingCommonName}</p>
                  {consensus.leadingScientificName &&
                  consensus.leadingScientificName !== headlineScientificName ? (
                    <p className="mt-0.5 text-sm italic text-muted-foreground">{consensus.leadingScientificName}</p>
                  ) : null}
                </div>
              )}
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>累计鉴定 {consensus.identificationCount}</span>
                  <span>
                    当前领先：<span className="font-medium text-foreground/90">{consensus.leadingCommonName}</span>
                  </span>
                </div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">确认进度</span>
                  <span className="tabular-nums font-medium text-foreground/90">
                    {consensus.confirmSlotsFilled}/{consensus.confirmSlotsRequired}
                    <span className="ml-1.5 font-normal text-muted-foreground">{consensus.confirmProgressHint}</span>
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      consensus.progress >= 1
                        ? "bg-[hsl(var(--nature-accent))]"
                        : "bg-amber-500/80",
                    )}
                    style={{ width: `${Math.round(consensus.progress * 100)}%` }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-0 border-l border-dashed border-foreground/25"
                    style={{ left: "66.666%" }}
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">尚无鉴定，欢迎成为第一个提出建议的人。</p>
          )}
        </section>

        <section aria-label="动态">
          <h2 className="text-base font-semibold text-foreground">动态</h2>
          {commentsLoading && stream.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">加载中…</p>
          ) : stream.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">暂无鉴定与讨论，在底部输入分析或提交鉴定建议。</p>
          ) : (
            <ol className="mt-5 space-y-0">
              {stream.map((item, index) => (
                <ActivityTimelineItem
                  key={item.id}
                  item={item}
                  ownerId={ownerId}
                  isLast={index === stream.length - 1}
                  mySpeciesId={myIdentification?.speciesId ?? null}
                  agreeingSpeciesId={agreeingSpeciesId}
                  onAgree={agreeWithSpecies}
                  onCompare={openCompare}
                />
              ))}
            </ol>
          )}
        </section>
      </div>

      {(isPublic || user?.id === ownerId) ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/95 shadow-[0_-2px_10px_rgba(15,23,42,0.05)] backdrop-blur supports-[backdrop-filter]:bg-background/90 dark:shadow-[0_-2px_12px_rgba(0,0,0,0.28)]">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5">
            <form
              className="relative min-w-0 flex-1"
              onSubmit={(event) => {
                event.preventDefault()
                void submitComment()
              }}
            >
              <label htmlFor="observation-activity-comment" className="sr-only">
                写下你的分析或评论
              </label>
              <textarea
                id="observation-activity-comment"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                rows={1}
                placeholder="写下你的分析或评论…"
                className="max-h-24 min-h-10 w-full resize-none rounded-full border-0 bg-muted/70 py-2.5 pl-4 pr-11 text-sm leading-6 shadow-inner placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--nature-accent)/0.35)] focus-visible:ring-offset-0"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void submitComment()
                  }
                }}
              />
              <button
                type="submit"
                disabled={!commentDraft.trim() || isCommentSubmitting}
                aria-label="发送评论"
                className={cn(
                  "absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors",
                  "disabled:cursor-not-allowed disabled:text-muted-foreground/35",
                  commentDraft.trim() && !isCommentSubmitting
                    ? "text-[hsl(var(--nature-accent))] hover:bg-[hsl(var(--nature-accent-soft)/0.65)]"
                    : "text-muted-foreground/45",
                )}
              >
                {isCommentSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
            <Button
              type="button"
              className={cn(
                natureActionButtonClass("primary"),
                "h-10 shrink-0 whitespace-nowrap px-4 text-sm shadow-sm",
              )}
              onClick={openIdentificationSheet}
            >
              {identificationActionLabel}
            </Button>
          </div>
        </div>
      ) : null}

      <ObservationSpeciesCompareSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        observationMediaUrls={observationMediaUrls}
        observationAlt={headlineTitle}
        target={compareTarget}
        speciesPageHref={compareSpeciesPageHref}
      />

      <Sheet
        open={idSheetOpen}
        onOpenChange={(open) => {
          setIdSheetOpen(open)
          if (!open) {
            setQuery("")
            setSelected(null)
            setResults([])
            setLifecycleStage("")
            setSex("")
          }
        }}
      >
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 rounded-t-md p-0">
          <SheetHeader className="space-y-1.5 border-b border-border/60 px-5 pb-4 pt-5 text-left">
            <SheetTitle className="text-lg">{identificationActionLabel}</SheetTitle>
            <SheetDescription className="text-sm leading-relaxed">
              {myIdentification
                ? "搜索并选择其他物种以更新；若不再参与，可撤回当前鉴定。"
                : status === "community_confirmed"
                  ? "可以继续认同当前共识，也可以选择其他物种提交不同鉴定。"
                : "搜索中文名或学名，从物种库中选择后提交。"}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {selected ? (
              <div className="flex items-start gap-3 rounded-sm border border-[hsl(var(--nature-accent)/0.35)] bg-[hsl(var(--nature-accent-soft)/0.5)] px-3.5 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--nature-accent))] text-[hsl(var(--nature-accent-foreground))]">
                  <Check className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[hsl(var(--nature-accent))]">已选择</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">{selected.commonName}</p>
                  {selected.scientificName ? (
                    <p className="mt-0.5 text-xs italic text-muted-foreground">{selected.scientificName}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {selected ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">生命阶段（可选）</span>
                  <select
                    value={lifecycleStage}
                    onChange={(event) => setLifecycleStage(event.target.value as "" | ObservationLifecycleStage)}
                    className="h-11 rounded-sm border border-border/70 bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--nature-accent)/0.35)]"
                  >
                    <option value="">未注明</option>
                    {observationLifecycleStageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">性别（可选）</span>
                  <select
                    value={sex}
                    onChange={(event) => setSex(event.target.value as "" | ObservationSex)}
                    className="h-11 rounded-sm border border-border/70 bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--nature-accent)/0.35)]"
                  >
                    <option value="">未注明</option>
                    {observationSexOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelected(null)
                }}
                placeholder="搜索物种名称或学名"
                className="h-11 rounded-sm border-border/70 bg-muted/25 pl-10 pr-10 text-sm focus-visible:bg-background"
                autoFocus
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>
            </div>

            {query.trim().length > 0 && query.trim().length < 2 ? (
              <p className="px-1 text-xs text-muted-foreground">至少输入 2 个字开始搜索</p>
            ) : null}

            {results.length > 0 ? (
              <ul className="overflow-hidden rounded-sm border border-border/70 bg-background shadow-sm" role="listbox">
                {results.map((result) => {
                  const isActive = selected?.id === result.id
                  return (
                    <li key={result.id} role="option" aria-selected={isActive}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(result)
                          setQuery(result.commonName)
                          setResults([])
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 border-b border-border/50 px-3.5 py-3 text-left text-sm transition-colors last:border-b-0",
                          isActive
                            ? "bg-[hsl(var(--nature-accent-soft)/0.6)]"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-foreground">{result.commonName}</span>
                          {result.scientificName ? (
                            <span className="mt-0.5 block text-xs italic text-muted-foreground">
                              {result.scientificName}
                            </span>
                          ) : null}
                        </span>
                        {isActive ? (
                          <Check className="h-4 w-4 shrink-0 text-[hsl(var(--nature-accent))]" />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            {!isSearching && query.trim().length >= 2 && results.length === 0 ? (
              <p className="rounded-sm bg-muted/30 px-3 py-2.5 text-center text-sm text-muted-foreground">
                未找到匹配物种，请换个关键词
              </p>
            ) : null}
          </div>

          <SheetFooter className="flex-col gap-3 border-t border-border/60 bg-muted/15 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
            {myIdentification ? (
              <button
                type="button"
                className="text-center text-sm text-destructive/90 transition-colors hover:text-destructive disabled:opacity-50"
                disabled={isSavingId}
                onClick={() => void withdrawIdentification()}
              >
                撤回我的鉴定
              </button>
            ) : null}
            <div className="flex w-full gap-2.5">
              <Button
                type="button"
                variant="outline"
                shape="pill"
                className="h-11 flex-1"
                onClick={() => setIdSheetOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                tone="nature"
                shape="pill"
                className="h-11 flex-1"
                disabled={!selected || isSavingId}
                onClick={() => selected && void submitIdentification(selected.id, { lifecycleStage, sex })}
              >
                {isSavingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {myIdentification ? "更新鉴定" : "提交鉴定"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

function ActivityTimelineItem({
  item,
  ownerId,
  isLast,
  mySpeciesId,
  agreeingSpeciesId,
  onAgree,
  onCompare,
}: {
  item: ActivityStreamItem
  ownerId: string
  isLast: boolean
  mySpeciesId: number | null
  agreeingSpeciesId: number | null
  onAgree: (speciesId: number) => void
  onCompare: (identification: ObservationIdentification) => void
}) {
  if (item.kind === "comment") {
    const { comment } = item
    return (
      <li className="relative flex gap-3 pb-6 pl-1">
        {!isLast ? <span className="absolute bottom-0 left-[18px] top-11 w-px bg-border/60" aria-hidden /> : null}
        <Avatar className="h-9 w-9 shrink-0 ring-4 ring-background">
          <AvatarFallback className="text-xs">{initials(comment.author)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-foreground">{comment.author}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.created_at ?? comment.date)}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-foreground/90">{comment.content}</p>
        </div>
      </li>
    )
  }

  const { identification } = item
  const isAi = identification.source === "ai"
  const isOwner = identification.identifierUserId === ownerId
  const canCompare = Boolean(identification.speciesSlug)
  const alreadyAgreed = mySpeciesId === identification.speciesId
  const isAgreeing = agreeingSpeciesId === identification.speciesId
  const traitSummary = formatIdentificationTraits(identification)

  return (
    <li className="relative flex gap-3 pb-6 pl-1">
      {!isLast ? <span className="absolute bottom-0 left-[18px] top-11 w-px bg-border/60" aria-hidden /> : null}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
          isAi ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {isAi ? <Bot className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">
            {isAi ? "AI 助手" : identification.identifierDisplayName || (isOwner ? "发布者" : "社区用户")}
          </span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(identification.createdAt)}</span>
        </div>
        <p className="mt-1.5 text-sm leading-6 text-foreground">
          {isAi ? "建议为" : isOwner ? "鉴定为" : "认同"}
          {" "}
          <span className="font-semibold">{identification.commonName}</span>
          {identification.scientificName ? (
            <span className="ml-1 italic text-muted-foreground">({identification.scientificName})</span>
          ) : null}
          {isAi && identification.confidence != null ? (
            <span className="ml-1 text-muted-foreground">· {Math.round(identification.confidence * 100)}%</span>
          ) : null}
        </p>
        {traitSummary ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{traitSummary}</p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            shape="pill"
            className={cn(
              "h-8 gap-1 border px-3 text-xs shadow-sm transition-colors",
              alreadyAgreed
                ? "border-emerald-200/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-border/80 bg-muted/50 hover:bg-muted",
            )}
            disabled={alreadyAgreed || isAgreeing}
            onClick={() => void onAgree(identification.speciesId)}
          >
            {isAgreeing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {alreadyAgreed ? "已认同" : "同意"}
          </Button>
          {canCompare ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              shape="pill"
              className="h-8 gap-1 border border-border/80 bg-muted/50 px-3 text-xs shadow-sm hover:bg-muted"
              onClick={() => onCompare(identification)}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              比较
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}
