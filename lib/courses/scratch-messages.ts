import type { ScratchBlockCategory, ScratchBlockHintItem } from '@/lib/courses/scratch-hints'

export const SCRATCH_MESSAGE_SOURCE = 'steam-scratch-host' as const
export const SCRATCH_PARENT_SOURCE = 'steam-scratch-parent' as const

export type ScratchEditorTargetContext = {
  id: string
  name: string
  isStage?: boolean
  x?: number
  y?: number
  direction?: number
  size?: number
  visible?: boolean
  costumeName?: string
  blockCount?: number
}

export type ScratchEditorContext = {
  selectedTargetId?: string
  selectedTargetName?: string
  targets: ScratchEditorTargetContext[]
}

export type ScratchParentMessage =
  | { type: 'SCRATCH_INIT'; lessonId: number; readOnly?: boolean; playerOnly?: boolean }
  | { type: 'LOAD_PROJECT'; url: string | null }
  | { type: 'LOAD_PROJECT_BUFFER'; base64: string }
  | { type: 'SAVE_PROJECT' }
  | { type: 'RUN_PLAYER_ONLY' }
  | { type: 'OPEN_TUTORIALS' }
  | { type: 'OPEN_TUTORIAL_DECK'; deckId: string }
  | { type: 'HIGHLIGHT_BLOCK_KEYWORDS'; keywords: string[]; items?: ScratchBlockHintItem[]; category?: ScratchBlockCategory }
  | { type: 'DISMISS_BLOCK_KEYWORDS' }

export type ScratchHostMessage =
  | { type: 'SCRATCH_READY'; source: typeof SCRATCH_MESSAGE_SOURCE }
  | { type: 'PROJECT_LOADED'; ok: boolean; error?: string }
  | { type: 'PROJECT_SAVED'; ok: boolean; error?: string }
  | { type: 'PROJECT_SAVE_DATA'; base64: string; source: typeof SCRATCH_MESSAGE_SOURCE }
  | { type: 'EDITOR_CONTEXT'; context: ScratchEditorContext; source: typeof SCRATCH_MESSAGE_SOURCE }

export function isScratchHostMessage(data: unknown): data is ScratchHostMessage {
  if (!data || typeof data !== 'object') return false
  const msg = data as { type?: string; source?: string }
  return (
    msg.source === SCRATCH_MESSAGE_SOURCE &&
    (msg.type === 'SCRATCH_READY' ||
      msg.type === 'PROJECT_LOADED' ||
      msg.type === 'PROJECT_SAVED' ||
      msg.type === 'PROJECT_SAVE_DATA' ||
      msg.type === 'EDITOR_CONTEXT')
  )
}
