import type {
  ObservationIdentification,
  ObservationSpeciesSummary,
} from '@/lib/mappers/types'
import {
  getObservationSubmitTopicCopy,
  type ObservationSubmitTopic,
} from '@/lib/observations/submit-topic'

const observationDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const AI_HEADLINE_CONFIDENCE = 0.5

export interface ObservationHeadline {
  title: string
  scientificName?: string | null
}

export function getObservationDisplayTitle(
  species: Pick<ObservationSpeciesSummary, 'commonName'>[] | undefined,
): string {
  return species?.[0]?.commonName?.trim() || '待鉴定观察'
}

export function getUnknownSpeciesLabel(topic: ObservationSubmitTopic): string {
  const unit = getObservationSubmitTopicCopy(topic).subjectUnit
  if (unit.includes('鸟')) return '未知鸟类'
  if (unit.includes('昆虫')) return '未知昆虫'
  return '未知树木'
}

export function getObservationTopicLabel(topic: ObservationSubmitTopic): string {
  const copy = getObservationSubmitTopicCopy(topic)
  return `${copy.label}观察`
}

export function getObservationHeadline(
  species: ObservationSpeciesSummary[],
  identifications: ObservationIdentification[],
  identificationStatus: 'needs_id' | 'community_confirmed',
  topic: ObservationSubmitTopic,
): ObservationHeadline {
  const confirmed = species[0]
  if (identificationStatus === 'community_confirmed' && confirmed?.commonName) {
    return {
      title: confirmed.commonName,
      scientificName: confirmed.scientificName,
    }
  }
  if (confirmed?.commonName) {
    return {
      title: confirmed.commonName,
      scientificName: confirmed.scientificName,
    }
  }

  const topAi = identifications
    .filter((item) => item.source === 'ai')
    .toSorted((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]

  if (topAi && (topAi.confidence ?? 0) >= AI_HEADLINE_CONFIDENCE) {
    const pct = Math.round((topAi.confidence ?? 0) * 100)
    return {
      title: `${topAi.commonName}（AI 建议 ${pct}%）`,
      scientificName: topAi.scientificName,
    }
  }

  return { title: getUnknownSpeciesLabel(topic) }
}

export function formatObservationDateTime(iso: string): string {
  return observationDateFormatter.format(new Date(iso))
}

export function formatObservationDateKey(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}
