import type { StageAiFeedback } from '@/lib/mappers/types'

export type StageArtifactSnapshot = {
  notes: string | null
  images: string[]
  dataSummary: string | null
  checked: number[]
  videoUrl: string | null
}

function normalizeText(value: string | null | undefined) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : null
}

function normalizeStringArray(value: string[] | null | undefined) {
  return Array.from(new Set((value ?? []).filter((item): item is string => typeof item === 'string' && item.length > 0)))
}

function normalizeChecked(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is number => Number.isInteger(item) && item >= 0))).sort((a, b) => a - b)
}

export function getStageDataSummary(data: Record<string, unknown> | null | undefined) {
  return typeof data?.summary === 'string' ? data.summary.trim() : ''
}

export function buildStageArtifactSnapshot(input: {
  notes?: string | null
  images?: string[] | null
  data?: Record<string, unknown> | null
  videoUrl?: string | null
}): StageArtifactSnapshot {
  return {
    notes: normalizeText(input.notes),
    images: normalizeStringArray(input.images),
    dataSummary: normalizeText(getStageDataSummary(input.data)),
    checked: normalizeChecked(input.data?.checked),
    videoUrl: normalizeText(input.videoUrl),
  }
}

export function areStageArtifactSnapshotsEqual(a: StageArtifactSnapshot, b: StageArtifactSnapshot) {
  return (
    a.notes === b.notes &&
    a.dataSummary === b.dataSummary &&
    a.videoUrl === b.videoUrl &&
    a.images.length === b.images.length &&
    a.images.every((item, index) => item === b.images[index]) &&
    a.checked.length === b.checked.length &&
    a.checked.every((item, index) => item === b.checked[index])
  )
}

export function shouldKeepStageFeedback(input: {
  existingFeedback?: StageAiFeedback | null
  previous: StageArtifactSnapshot
  next: StageArtifactSnapshot
}) {
  return Boolean(input.existingFeedback) && areStageArtifactSnapshotsEqual(input.previous, input.next)
}
