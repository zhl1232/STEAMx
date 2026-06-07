export type IdentificationSource = 'human' | 'ai'
export type IdentificationStatus = 'needs_id' | 'community_confirmed'

export interface IdentificationVote {
  speciesId: number
  source: IdentificationSource
  identifierUserId: string | null
}

export interface IdentificationConsensus {
  status: IdentificationStatus
  confirmedSpeciesId: number | null
}

interface SpeciesVoteGroup {
  speciesId: number
  totalVotes: number
  humanVoteCount: number
  hasAiVote: boolean
  hasNonOwnerHumanVote: boolean
}

export interface AiCandidateVote {
  speciesId: number
  confidence: number
}

export interface AiAnalysisVoteInput {
  status: string
  speciesCandidates: AiCandidateVote[]
}

export const AI_IDENTIFICATION_CONFIDENCE_THRESHOLD = 0.8

export function selectAiIdentification(
  analyses: AiAnalysisVoteInput[],
  threshold = AI_IDENTIFICATION_CONFIDENCE_THRESHOLD,
): AiCandidateVote | null {
  const eligible = analyses
    .filter((analysis) => analysis.status === 'passed')
    .map((analysis) => [...analysis.speciesCandidates].sort((left, right) => right.confidence - left.confidence)[0] ?? null)
    .filter((candidate): candidate is AiCandidateVote => candidate != null && candidate.confidence >= threshold)

  if (eligible.length === 0) return null

  const speciesIds = new Set(eligible.map((candidate) => candidate.speciesId))
  if (speciesIds.size !== 1) return null

  return eligible.reduce((best, candidate) => (
    candidate.confidence > best.confidence ? candidate : best
  ))
}

export function calculateIdentificationConsensus(
  votes: IdentificationVote[],
  observationOwnerId: string,
): IdentificationConsensus {
  if (votes.length === 0) {
    return { status: 'needs_id', confirmedSpeciesId: null }
  }

  const groups = new Map<number, IdentificationVote[]>()
  for (const vote of votes) {
    const current = groups.get(vote.speciesId) ?? []
    current.push(vote)
    groups.set(vote.speciesId, current)
  }

  const candidates: SpeciesVoteGroup[] = Array.from(groups.entries())
    .map(([speciesId, groupVotes]) => {
      const humanUsers = new Set(
        groupVotes
          .filter((vote) => vote.source === 'human' && vote.identifierUserId)
          .map((vote) => vote.identifierUserId as string),
      )
      const hasAiVote = groupVotes.some((vote) => vote.source === 'ai')
      const hasNonOwnerHumanVote = Array.from(humanUsers).some((userId) => userId !== observationOwnerId)
      return {
        speciesId,
        totalVotes: groupVotes.length,
        humanVoteCount: humanUsers.size,
        hasAiVote,
        hasNonOwnerHumanVote,
      }
    })
    .filter((group) => group.humanVoteCount >= 2 || (group.hasAiVote && group.hasNonOwnerHumanVote))
    .sort((left, right) => (
      right.totalVotes - left.totalVotes
      || right.humanVoteCount - left.humanVoteCount
      || Number(right.hasAiVote) - Number(left.hasAiVote)
      || left.speciesId - right.speciesId
    ))

  const confirmed = candidates[0]
  if (confirmed) return { status: 'community_confirmed', confirmedSpeciesId: confirmed.speciesId }

  return { status: 'needs_id', confirmedSpeciesId: null }
}
