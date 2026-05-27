import {
  calculateIdentificationConsensus,
  type IdentificationStatus,
  type IdentificationVote,
} from '@/lib/observations/identifications'
import type { ObservationIdentification, ObservationSpeciesSummary } from '@/lib/mappers/types'

export interface ConsensusUiState {
  status: IdentificationStatus
  leadingSpeciesId: number | null
  leadingCommonName: string | null
  leadingScientificName: string | null
  progress: number
  /** @deprecated Prefer confirmSlotsFilled + confirmProgressHint in UI */
  progressLabel: string
  identificationCount: number
  leadingVoteCount: number
  confirmSlotsFilled: number
  confirmSlotsRequired: number
  confirmProgressHint: string
  summary: string
  hasConflict: boolean
}

export const CONSENSUS_RULES_SUMMARY =
  '当所有有效鉴定指向同一物种时：至少 2 位用户各投一票，或 AI 鉴定 + 1 位非发布者用户认同，即可达成社群共识。发布者单独认同 AI 尚不足以确认。'

function toVotes(identifications: ObservationIdentification[]): IdentificationVote[] {
  return identifications.map((item) => ({
    speciesId: item.speciesId,
    source: item.source,
    identifierUserId: item.identifierUserId ?? null,
  }))
}

function leadingSpeciesGroup(identifications: ObservationIdentification[]) {
  const groups = new Map<number, ObservationIdentification[]>()
  for (const item of identifications) {
    const list = groups.get(item.speciesId) ?? []
    list.push(item)
    groups.set(item.speciesId, list)
  }

  let leading: ObservationIdentification[] = []
  for (const group of groups.values()) {
    if (group.length > leading.length) leading = group
  }
  return leading
}

function confirmSlotsFilledForVotes(votes: IdentificationVote[], ownerId: string): number {
  const humanUsers = new Set(
    votes
      .filter((vote) => vote.source === 'human' && vote.identifierUserId)
      .map((vote) => vote.identifierUserId as string),
  )
  const hasAi = votes.some((vote) => vote.source === 'ai')
  const hasNonOwner = Array.from(humanUsers).some((userId) => userId !== ownerId)
  return Math.min(2, Math.max(humanUsers.size, (hasAi ? 1 : 0) + (hasNonOwner ? 1 : 0)))
}

function progressForVotes(votes: IdentificationVote[], ownerId: string): number {
  const humanUsers = new Set(
    votes
      .filter((vote) => vote.source === 'human' && vote.identifierUserId)
      .map((vote) => vote.identifierUserId as string),
  )
  const hasAi = votes.some((vote) => vote.source === 'ai')
  const hasNonOwner = Array.from(humanUsers).some((userId) => userId !== ownerId)
  const humanProgress = humanUsers.size / 2
  const aiPathProgress = ((hasAi ? 1 : 0) + (hasNonOwner ? 1 : 0)) / 2
  return Math.min(1, Math.max(humanProgress, aiPathProgress))
}

export function computeConsensusUiState(
  identifications: ObservationIdentification[],
  ownerId: string,
  confirmedSpecies: ObservationSpeciesSummary | null | undefined,
  status: IdentificationStatus,
): ConsensusUiState {
  const speciesIds = new Set(identifications.map((item) => item.speciesId))
  const hasConflict = speciesIds.size > 1

  const identificationCount = identifications.length

  if (status === 'community_confirmed' && confirmedSpecies) {
    const leadingVoteCount = identifications.filter(
      (item) => item.speciesId === confirmedSpecies.speciesId,
    ).length
    return {
      status,
      leadingSpeciesId: confirmedSpecies.speciesId,
      leadingCommonName: confirmedSpecies.commonName,
      leadingScientificName: confirmedSpecies.scientificName ?? null,
      progress: 1,
      progressLabel: '2/2',
      identificationCount,
      leadingVoteCount,
      confirmSlotsFilled: 2,
      confirmSlotsRequired: 2,
      confirmProgressHint: '已满足确认条件',
      summary: '已达成社群共识',
      hasConflict: false,
    }
  }

  const leading = leadingSpeciesGroup(identifications)
  if (leading.length === 0) {
    return {
      status: 'needs_id',
      leadingSpeciesId: null,
      leadingCommonName: null,
      leadingScientificName: null,
      progress: 0,
      progressLabel: '0/2',
      identificationCount,
      leadingVoteCount: 0,
      confirmSlotsFilled: 0,
      confirmSlotsRequired: 2,
      confirmProgressHint: '距确认还差 2 票',
      summary: '等待第一条鉴定',
      hasConflict: false,
    }
  }

  const sample = leading[0]!
  const votes = toVotes(leading)
  const progress = progressForVotes(votes, ownerId)
  const consensus = calculateIdentificationConsensus(votes, ownerId)
  const confirmSlotsFilled = confirmSlotsFilledForVotes(votes, ownerId)
  const confirmSlotsRequired = 2
  const remaining = Math.max(0, confirmSlotsRequired - confirmSlotsFilled)
  const confirmProgressHint =
    progress >= 1
      ? '已满足确认条件'
      : remaining === 1
        ? '距确认还差 1 票'
        : `距确认还差 ${remaining} 票`

  return {
    status: consensus.status,
    leadingSpeciesId: sample.speciesId,
    leadingCommonName: sample.commonName,
    leadingScientificName: sample.scientificName ?? null,
    progress,
    progressLabel: `${confirmSlotsFilled}/${confirmSlotsRequired}`,
    identificationCount,
    leadingVoteCount: leading.length,
    confirmSlotsFilled,
    confirmSlotsRequired,
    confirmProgressHint,
    summary: hasConflict
      ? '鉴定存在分歧，暂未形成共识'
      : progress >= 1
        ? '已达成社群共识'
        : '初步认同，尚需更多鉴定',
    hasConflict,
  }
}
