"use client"

import { useEffect, useMemo, useState } from "react"
import { Bot, CheckCircle2, Loader2, Search, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import type { ObservationIdentification, ObservationSpeciesSummary } from "@/lib/mappers/types"
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

export function ObservationIdentificationsPanel({
  observationId,
  topic,
  ownerId,
  initialStatus,
  initialConfirmedSpecies = null,
  initialIdentifications,
}: ObservationIdentificationsPanelProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const [status, setStatus] = useState(initialStatus)
  const [confirmedSpecies, setConfirmedSpecies] = useState(initialConfirmedSpecies)
  const [identifications, setIdentifications] = useState(initialIdentifications)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SpeciesOption[]>([])
  const [selected, setSelected] = useState<SpeciesOption | null>(null)
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

  const applyResponse = (data: IdentificationResponse) => {
    setStatus(data.identificationStatus)
    setConfirmedSpecies(data.confirmedSpecies)
    setIdentifications(data.identifications)
    setResults([])
    setQuery("")
    setSelected(null)
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
        body: JSON.stringify({ species_id: selected.id }),
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
    <section className="rounded-2xl border border-border/70 bg-muted/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">共同鉴定</h2>
        <span className={status === "community_confirmed"
          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}>
          {status === "community_confirmed" ? "已共同确认" : "待鉴定"}
        </span>
      </div>
      {confirmedSpecies ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          已确认：{confirmedSpecies.commonName}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          AI 鉴定会标明来源并计入共识。发布者和 AI 一致仍需另一位用户参与确认。
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {identifications.map((identification) => (
          <span key={identification.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs">
            {identification.source === "ai" ? <Bot className="h-3.5 w-3.5 text-primary" /> : <UserRound className="h-3.5 w-3.5 text-muted-foreground" />}
            {identification.source === "ai" ? "AI 鉴定" : identification.identifierUserId === ownerId ? "发布者鉴定" : "用户鉴定"}：
            {identification.commonName}
            {identification.source === "ai" && identification.confidence != null ? ` ${Math.round(identification.confidence * 100)}%` : ""}
          </span>
        ))}
        {identifications.length === 0 ? <span className="text-sm text-muted-foreground">尚无鉴定结果</span> : null}
      </div>
      <div className="mt-4 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelected(null) }}
            placeholder="搜索物种，提交我的鉴定"
            className="pl-9 pr-9"
          />
          {isSearching ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
        </div>
        {results.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            {results.map((result) => (
              <button key={result.id} type="button" onClick={() => { setSelected(result); setQuery(result.commonName); setResults([]) }} className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50">
                <span className="font-medium">{result.commonName}</span>
                {result.scientificName ? <span className="ml-2 italic text-muted-foreground">{result.scientificName}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" disabled={!selected || isSaving} onClick={() => void submitIdentification()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            提交鉴定
          </Button>
          {myIdentification ? <Button type="button" variant="outline" disabled={isSaving} onClick={() => void withdrawIdentification()}>撤回我的鉴定</Button> : null}
        </div>
      </div>
    </section>
  )
}
