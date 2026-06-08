import type { NatureTopicKey } from '@/lib/config/nature-topics'
import type { Species } from '@/lib/mappers/types'

export type SpeciesObservationStatusFilter = 'all' | 'unobserved' | 'observed'

export interface SpeciesTopicProgress {
  topic: NatureTopicKey | 'all'
  label: string
  total: number
  observedCount: number
  unobservedCount: number
  progressPercent: number
}

export interface NaturalObservationProgressSummary {
  totalObservations: number
  uniqueSpeciesCount: number
  topicProgress: SpeciesTopicProgress[]
  unobservedSpeciesPreview: Species[]
}

export function normalizeSpeciesObservationStatusFilter(
  value: string | null | undefined,
): SpeciesObservationStatusFilter {
  return value === 'observed' || value === 'unobserved' ? value : 'all'
}

export function calculateProgressPercent(observedCount: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((observedCount / total) * 100)))
}
