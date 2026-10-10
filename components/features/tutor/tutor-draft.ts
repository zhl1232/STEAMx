import type { TutorDraft } from './tutor-context'

export function decideTutorDraft(draft: TutorDraft, userId: string | undefined, type: string, id: string, input: string, imageCount: number): 'discard' | 'preserve' | 'prefill' {
  if (!userId || draft.userId !== userId || type !== 'project' || draft.projectId !== id) return 'discard'
  if (input.length || imageCount) return 'preserve'
  return 'prefill'
}
