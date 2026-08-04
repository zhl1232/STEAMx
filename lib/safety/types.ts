export type SafetyActionType =
  | 'warning'
  | 'interaction_restriction'
  | 'account_suspension'
  | 'account_ban'

export type SafetyActionStatus = 'active' | 'expired' | 'revoked'
export type ModerationState = 'pending' | 'approved' | 'rejected' | 'hidden'
export type ModerationRisk = 'low' | 'medium' | 'high'

export type ModerationDecision = {
  state: ModerationState
  riskLevel: ModerationRisk
  category: string | null
  reason: string | null
  modelName: string
}

export type ContentSnapshot = {
  authorId: string | null
  text: string | null
  metadata: Record<string, unknown>
}
