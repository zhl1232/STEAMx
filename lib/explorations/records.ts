export type ExplorationStatus = 'active' | 'completed' | 'abandoned'
export type CompletionRecordKind = 'progress' | 'final'

export function normalizeRecordKind(value?: string | null): CompletionRecordKind {
  return value === 'progress' ? 'progress' : 'final'
}
