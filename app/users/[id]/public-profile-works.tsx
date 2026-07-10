"use client"

import { useState } from "react"

import { WorkCardGrid } from "@/components/features/works/work-card-grid"
import { Button } from "@/components/ui/button"
import type { Work } from "@/lib/mappers/types"

export function PublicProfileWorks({
  userId,
  initialWorks,
  initialHasMore,
}: {
  userId: string
  initialWorks: Work[]
  initialHasMore: boolean
}) {
  const [works, setWorks] = useState(initialWorks)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMore = async () => {
    setLoading(true)
    setError(null)
    try {
      const page = Math.floor(works.length / 12)
      const response = await fetch(`/api/users/${userId}/works?page=${page}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "加载失败")
      setWorks((current) => [...current, ...((payload?.works as Work[]) || [])])
      setHasMore(Boolean(payload?.hasMore))
    } catch {
      setError("更多作品暂时无法加载，请稍后重试。")
    } finally {
      setLoading(false)
    }
  }

  if (works.length === 0) {
    return <p className="surface-subtle px-5 py-10 text-center text-sm text-muted-foreground">还没有公开作品。</p>
  }

  return (
    <div className="space-y-6">
      <WorkCardGrid works={works} />
      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loading}>
            {loading ? "加载中" : "加载更多作品"}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
