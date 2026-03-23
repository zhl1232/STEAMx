type CompletionStatusRow = {
  project_id: number
  status?: string | null
  rejection_reason?: string | null
}

export function isTrackedCompletionStatus(status?: string | null) {
  return status == null || status === 'pending' || status === 'approved'
}

export function canResubmitCompletion(status?: string | null) {
  return status === 'rejected'
}

export function getTrackedCompletedProjectIds(rows: CompletionStatusRow[]) {
  const ids = new Set<number>()

  for (const row of rows) {
    if (!Number.isInteger(row.project_id) || row.project_id <= 0) continue
    if (!isTrackedCompletionStatus(row.status)) continue
    ids.add(row.project_id)
  }

  return Array.from(ids)
}

export function getLatestCompletionStatusMap(rows: CompletionStatusRow[]) {
  const statusMap = new Map<number, { status: string; rejectionReason?: string }>()

  for (const row of rows) {
    if (!Number.isInteger(row.project_id) || row.project_id <= 0) continue
    if (statusMap.has(row.project_id)) continue

    statusMap.set(row.project_id, {
      status: row.status || 'pending',
      rejectionReason: row.rejection_reason || undefined,
    })
  }

  return statusMap
}
