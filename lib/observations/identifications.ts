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
  const activeSpeciesIds = new Set(votes.map((vote) => vote.speciesId))
  if (activeSpeciesIds.size !== 1) {
    return { status: 'needs_id', confirmedSpeciesId: null }
  }

  const speciesId = votes[0]?.speciesId
  if (speciesId == null) {
    return { status: 'needs_id', confirmedSpeciesId: null }
  }

  const humanUsers = new Set(
    votes
      .filter((vote) => vote.source === 'human' && vote.identifierUserId)
      .map((vote) => vote.identifierUserId as string),
  )
  const hasAiVote = votes.some((vote) => vote.source === 'ai')
  const hasNonOwnerHumanVote = Array.from(humanUsers).some((userId) => userId !== observationOwnerId)

  if (humanUsers.size >= 2 || (hasAiVote && hasNonOwnerHumanVote)) {
    return { status: 'community_confirmed', confirmedSpeciesId: speciesId }
  }

  return { status: 'needs_id', confirmedSpeciesId: null }
}
