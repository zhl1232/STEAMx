"use client"

import { useEffect, useMemo, useState } from "react"
import { Bot, CheckCircle2, Loader2, Search, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"

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
import type { ObservationIdentification, ObservationSpeciesSummary } from "@/lib/mappers/types"
import {
  formatObservationLifecycleStage,
  formatObservationSex,
  observationLifecycleStageOptions,
  observationSexOptions,
  type ObservationLifecycleStage,
  type ObservationSex,
} from "@/lib/observations/traits"
import type { ObservationSubmitTopic } from "@/lib/observations/submit-topic"

interface SpeciesOption {
  id: number
  commonName: string
  scientificName?: string | null
}

interface IdentificationResponse {
  identificationStatus: "needs_id" | "community_confirmed"
  confirmedSpecies: ObservationSpeciesSummary | null
  identifications: ObservationIdentification[]
  error?: string
}

interface ObservationIdentificationsPanelProps {
  observationId: number
  topic: ObservationSubmitTopic
  ownerId: string
  initialStatus: "needs_id" | "community_confirmed"
  initialConfirmedSpecies?: ObservationSpeciesSummary | null
  initialIdentifications: ObservationIdentification[]
}

function identificationLabel(
  identification: ObservationIdentification,
  ownerId: string,
): string {
  if (identification.source === "ai") return "AI 鉴定"
  if (identification.identifierUserId === ownerId) return "发布者"
  return identification.identifierDisplayName || "社区用户"
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

export function ObservationIdentificationsPanel({
  observationId,
  topic,
  ownerId,
  initialStatus: _initialStatus,
  initialConfirmedSpecies = null,
  initialIdentifications,
}: ObservationIdentificationsPanelProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const [confirmedSpecies, setConfirmedSpecies] = useState(initialConfirmedSpecies)
  const [identifications, setIdentifications] = useState(initialIdentifications)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SpeciesOption[]>([])
  const [selected, setSelected] = useState<SpeciesOption | null>(null)
  const [lifecycleStage, setLifecycleStage] = useState<"" | ObservationLifecycleStage>("")
  const [sex, setSex] = useState<"" | ObservationSex>("")
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
        const response = await fetch(`/api/species?q=${encodeURIComponent(normalized)}&topic=${topic}&pageSize=6`, {
          signal: controller.signal,
        })
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

  const myIdentification = useMemo(
    () => identifications.find((item) => item.source === "human" && item.identifierUserId === user?.id),
    [identifications, user?.id],
  )

  const openIdentificationSheet = () => {
    if (myIdentification) {
      setQuery(myIdentification.commonName)
      setSelected({
        id: myIdentification.speciesId,
        commonName: myIdentification.commonName,
        scientificName: myIdentification.scientificName ?? null,
      })
      setLifecycleStage(myIdentification.lifecycleStage ?? "")
      setSex(myIdentification.sex ?? "")
    } else {
      setQuery("")
      setSelected(null)
      setLifecycleStage("")
      setSex("")
      setResults([])
    }
    setSheetOpen(true)
  }

  const applyResponse = (data: IdentificationResponse) => {
    setConfirmedSpecies(data.confirmedSpecies)
    setIdentifications(data.identifications)
    setResults([])
    setQuery("")
    setSelected(null)
    setLifecycleStage("")
    setSex("")
    setSheetOpen(false)
    router.refresh()
  }

  const submitIdentification = async () => {
    if (!user) {
      promptLogin(undefined, { title: "登录后参与共同鉴定", description: "你的鉴定会计入这条观察记录的共识。" })
      return
    }
    if (!selected) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/observations/${observationId}/identifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          species_id: selected.id,
          lifecycle_stage: lifecycleStage || null,
          sex: sex || null,
        }),
      })
      const data = await response.json() as IdentificationResponse
      if (!response.ok) throw new Error(data.error || "鉴定提交失败")
      applyResponse(data)
      toast({ title: "鉴定已提交" })
    } catch (error) {
      toast({ title: "鉴定提交失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const withdrawIdentification = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/observations/${observationId}/identifications`, { method: "DELETE" })
      const data = await response.json() as IdentificationResponse
      if (!response.ok) throw new Error(data.error || "撤回失败")
      applyResponse(data)
      toast({ title: "已撤回我的鉴定" })
    } catch (error) {
      toast({ title: "撤回失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="border-t border-border/60 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">共同鉴定</h2>
        <Button type="button" tone="brand" size="sm" onClick={openIdentificationSheet}>
          参与鉴定
        </Button>
      </div>

      {confirmedSpecies ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          社区已确认：{confirmedSpecies.commonName}
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          AI 与社区鉴定会共同计入共识；发布者与 AI 一致时，仍需另一位用户参与确认。
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {identifications.map((identification) => {
          const traitSummary = formatIdentificationTraits(identification)

          return (
            <li
              key={identification.id}
              className="flex items-start gap-3 rounded-sm bg-muted/25 px-3 py-2.5"
            >
              <span className="mt-0.5 text-muted-foreground">
                {identification.source === "ai" ? <Bot className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {identificationLabel(identification, ownerId)}
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  {identification.commonName}
                  {identification.source === "ai" && identification.confidence != null
                    ? ` · ${Math.round(identification.confidence * 100)}%`
                    : ""}
                </p>
                {identification.scientificName ? (
                  <p className="mt-0.5 text-xs italic text-muted-foreground">{identification.scientificName}</p>
                ) : null}
                {traitSummary ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{traitSummary}</p>
                ) : null}
              </div>
            </li>
          )
        })}
        {identifications.length === 0 ? (
          <li className="text-sm text-muted-foreground">尚无鉴定记录，欢迎第一个参与。</li>
        ) : null}
      </ul>

      {myIdentification ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 h-auto px-0 text-muted-foreground hover:text-foreground"
          disabled={isSaving}
          onClick={() => void withdrawIdentification()}
        >
          撤回我的鉴定
        </Button>
      ) : null}

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) {
            setQuery("")
            setSelected(null)
            setLifecycleStage("")
            setSex("")
            setResults([])
          }
        }}
      >
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col rounded-t-md">
          <SheetHeader className="text-left">
            <SheetTitle>参与共同鉴定</SheetTitle>
            <SheetDescription>搜索并选择你认为的物种，提交后会计入社区共识。</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelected(null)
                }}
                placeholder="搜索物种名称"
                className="pl-9 pr-9"
              />
              {isSearching ? (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            {results.length > 0 ? (
              <div className="overflow-hidden rounded-sm border border-border/70 bg-background">
                {results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setSelected(result)
                      setQuery(result.commonName)
                      setResults([])
                    }}
                    className="block w-full border-b border-border/60 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted/40"
                  >
                    <span className="font-medium">{result.commonName}</span>
                    {result.scientificName ? (
                      <span className="ml-2 italic text-muted-foreground">{result.scientificName}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            {selected ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">生命阶段（可选）</span>
                  <select
                    value={lifecycleStage}
                    onChange={(event) => setLifecycleStage(event.target.value as "" | ObservationLifecycleStage)}
                    className="h-11 rounded-sm border border-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
                    className="h-11 rounded-sm border border-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
          </div>
          <SheetFooter className="flex-row gap-2 border-t border-border/60 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              tone="brand"
              className="flex-1"
              disabled={!selected || isSaving}
              onClick={() => void submitIdentification()}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              提交鉴定
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  )
}
