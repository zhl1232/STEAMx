import { z } from 'zod'

import { logger } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'

const ANALYSIS_STATUS_VALUES = [
  'pending',
  'passed',
  'passed_no_identification',
  'failed_unsafe',
  'failed_low_quality',
  'failed_unrecognized',
  'error',
] as const

export type ObservationMediaAnalysisStatus = (typeof ANALYSIS_STATUS_VALUES)[number]

export type ObservationMediaAnalysisRow = Database['public']['Tables']['observation_media_analyses']['Row']
export type SpeciesRow = Database['public']['Tables']['species']['Row']

export interface ObservationSpeciesCandidate {
  speciesId: number
  commonName: string
  scientificName: string | null
  confidence: number
  reason: string | null
}

export interface ObservationMediaAnalysisResult {
  status: ObservationMediaAnalysisStatus
  modelName: string
  moderationPass: boolean
  moderationReason: string | null
  qualityPass: boolean
  qualityReason: string | null
  noteSuggestion: string | null
  speciesCandidates: ObservationSpeciesCandidate[]
  rawResponse: unknown
}

export interface ObservationMediaAnalysisResponse {
  id: number
  imageUrl: string
  status: ObservationMediaAnalysisStatus
  moderationPass: boolean | null
  moderationReason: string | null
  qualityPass: boolean | null
  qualityReason: string | null
  noteSuggestion: string | null
  speciesCandidates: ObservationSpeciesCandidate[]
}

const ProviderCandidateSchema = z.object({
  common_name: z.string().trim().min(1),
  scientific_name: z.string().trim().min(1).nullable().optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().min(1).nullable().optional(),
})

const ProviderPayloadSchema = z.object({
  moderation_pass: z.boolean(),
  moderation_reason: z.string().trim().min(1).nullable().optional(),
  quality_pass: z.boolean(),
  quality_reason: z.string().trim().min(1).nullable().optional(),
  note_suggestion: z.string().trim().min(1).nullable().optional(),
  species_candidates: z.array(ProviderCandidateSchema).max(5).default([]),
})

type ProviderPayload = z.infer<typeof ProviderPayloadSchema>

function isAnalysisStatus(value: string): value is ObservationMediaAnalysisStatus {
  return ANALYSIS_STATUS_VALUES.includes(value as ObservationMediaAnalysisStatus)
}

function normalizeAnalysisStatus(value: string): ObservationMediaAnalysisStatus {
  return isAnalysisStatus(value) ? value : 'error'
}

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, '')
}

function clipReason(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 200)
}

function clipNoteSuggestion(value: string | null | undefined): string | null {
  let trimmed = value?.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null

  trimmed = trimmed
    .replace(/^(?:这张)?(?:图片|照片|画面)(?:中|里)?(?:展示了|显示了|呈现了|拍到了|可见|可以看到)/, '我看到')
    .replace(/^(?:这张)?(?:图片|照片|画面)(?:中|里)?有/, '我看到')
    .replace(/^主体(?:是|为)/, '我看到')
    .replace(/背景为/g, '周围是')
    .replace(/背景中有/g, '周围有')

  if (!trimmed.startsWith('我')) {
    trimmed = `我看到${trimmed}`
  }

  return trimmed.slice(0, 180)
}

function extractJsonBlock(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const firstBrace = content.indexOf('{')
  const lastBrace = content.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1)
  }

  return content.trim()
}

export function parseObservationVisionPayload(content: string): ProviderPayload {
  const raw = extractJsonBlock(content)
  return ProviderPayloadSchema.parse(JSON.parse(raw))
}

export function buildSpeciesLookupMap(speciesRows: SpeciesRow[]): Map<string, SpeciesRow> {
  const map = new Map<string, SpeciesRow>()

  for (const row of speciesRows) {
    const keys = [
      row.common_name,
      row.scientific_name,
      ...(row.aliases || []),
    ]

    for (const key of keys) {
      const normalized = normalizeText(key)
      if (normalized && !map.has(normalized)) {
        map.set(normalized, row)
      }
    }
  }

  return map
}

function findSpeciesMatch(
  candidate: z.infer<typeof ProviderCandidateSchema>,
  speciesRows: SpeciesRow[],
  speciesMap: Map<string, SpeciesRow>,
): SpeciesRow | null {
  const exactKeys = [candidate.common_name, candidate.scientific_name ?? null]
    .map((value) => normalizeText(value))
    .filter(Boolean)

  for (const key of exactKeys) {
    const matched = speciesMap.get(key)
    if (matched) return matched
  }

  const candidateNames = [candidate.common_name, candidate.scientific_name ?? '']
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  for (const row of speciesRows) {
    const rowNames = [row.common_name, row.scientific_name ?? '', ...(row.aliases || [])]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)

    if (candidateNames.some((name) => rowNames.some((rowName) => rowName.includes(name) || name.includes(rowName)))) {
      return row
    }
  }

  return null
}

export function mapVisionPayloadToAnalysisResult(
  payload: ProviderPayload,
  speciesRows: SpeciesRow[],
  modelName: string,
  rawResponse: unknown,
): ObservationMediaAnalysisResult {
  const speciesMap = buildSpeciesLookupMap(speciesRows)
  const matchedCandidates: ObservationSpeciesCandidate[] = []

  if (payload.moderation_pass && payload.quality_pass) {
    for (const candidate of payload.species_candidates) {
      const matched = findSpeciesMatch(candidate, speciesRows, speciesMap)
      if (!matched) continue

      if (matchedCandidates.some((item) => item.speciesId === matched.id)) continue

      matchedCandidates.push({
        speciesId: matched.id,
        commonName: matched.common_name,
        scientificName: matched.scientific_name,
        confidence: Number(candidate.confidence.toFixed(2)),
        reason: clipReason(candidate.reason),
      })
    }
  }

  let status: ObservationMediaAnalysisStatus
  if (!payload.moderation_pass) {
    status = 'failed_unsafe'
  } else if (!payload.quality_pass) {
    status = 'failed_low_quality'
  } else if (matchedCandidates.length === 0) {
    status = 'passed_no_identification'
  } else {
    status = 'passed'
  }

  return {
    status,
    modelName,
    moderationPass: payload.moderation_pass,
    moderationReason: clipReason(payload.moderation_reason),
    qualityPass: payload.quality_pass,
    qualityReason: clipReason(payload.quality_reason),
    noteSuggestion: status === 'passed' || status === 'passed_no_identification' ? clipNoteSuggestion(payload.note_suggestion) : null,
    speciesCandidates: matchedCandidates.sort((left, right) => right.confidence - left.confidence).slice(0, 3),
    rawResponse,
  }
}

export function parseStoredSpeciesCandidates(value: unknown): ObservationSpeciesCandidate[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      if (typeof row.speciesId !== 'number' || typeof row.commonName !== 'string' || typeof row.confidence !== 'number') {
        return null
      }

      return {
        speciesId: row.speciesId,
        commonName: row.commonName,
        scientificName: typeof row.scientificName === 'string' ? row.scientificName : null,
        confidence: row.confidence,
        reason: typeof row.reason === 'string' ? row.reason : null,
      }
    })
    .filter((item): item is ObservationSpeciesCandidate => Boolean(item))
}

export function mapAnalysisRowToResponse(row: ObservationMediaAnalysisRow): ObservationMediaAnalysisResponse {
  return {
    id: row.id,
    imageUrl: row.image_url,
    status: normalizeAnalysisStatus(row.status),
    moderationPass: row.moderation_pass,
    moderationReason: row.moderation_reason,
    qualityPass: row.quality_pass,
    qualityReason: row.quality_reason,
    noteSuggestion: row.note_suggestion,
    speciesCandidates: parseStoredSpeciesCandidates(row.species_candidates),
  }
}

export function isObservationAnalysisPassed(row: ObservationMediaAnalysisRow | null | undefined): boolean {
  return row?.status === 'passed' || row?.status === 'passed_no_identification'
}

/**
 * Quality and identification are advisory. Only a failed safety check should
 * prevent an observation from being submitted.
 */
export function isObservationAnalysisSafetyBlocked(
  row: Pick<ObservationMediaAnalysisRow, 'status' | 'moderation_pass'> | null | undefined,
): boolean {
  return row?.status === 'failed_unsafe' || row?.moderation_pass === false
}

export function getObservationAnalysisErrorMessage(row: ObservationMediaAnalysisRow | null | undefined): string {
  if (!row) return '图片识别未完成，请稍后重试'

  switch (row.status) {
    case 'failed_unsafe':
      return row.moderation_reason || '图片内容不适合提交观察记录，请更换照片'
    case 'failed_low_quality':
      return row.quality_reason || '图片不够清晰，请重拍后再试'
    case 'failed_unrecognized':
      return '图片来自旧版识别流程，请重新分析后再提交'
    case 'pending':
      return '图片识别仍在处理中，请稍后再提交'
    case 'error':
      return row.moderation_reason || '图片识别失败，请重新上传或稍后重试'
    default:
      return '图片识别未通过'
  }
}

export function logObservationAnalysisParseFailure(error: unknown, context?: Record<string, unknown>) {
  logger.error('Failed to parse observation vision payload', { error, ...context })
}
