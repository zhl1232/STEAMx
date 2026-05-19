'use client'

import { useEffect, useMemo } from 'react'

import { useProjects } from '@/lib/context/project-context'

function normalizeProjectIds(projectIds: (string | number)[]): number[] {
  const ids = new Set<number>()
  for (const projectId of projectIds) {
    const parsed = typeof projectId === 'number' ? projectId : Number(projectId)
    if (Number.isInteger(parsed) && parsed > 0) {
      ids.add(parsed)
    }
  }
  return Array.from(ids)
}

/** 按当前页面可见项目 ID 批量同步点赞/收藏/完成/探索状态 */
export function useSyncProjectInteractions(projectIds: (string | number)[]) {
  const { syncProjectInteractions } = useProjects()
  const normalizedKey = useMemo(() => normalizeProjectIds(projectIds).sort((a, b) => a - b).join(','), [projectIds])

  useEffect(() => {
    const ids = normalizedKey ? normalizedKey.split(',').map((id) => Number(id)) : []
    if (ids.length === 0) return
    void syncProjectInteractions(ids)
  }, [normalizedKey, syncProjectInteractions])
}
