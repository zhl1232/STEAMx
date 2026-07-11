export const TUTOR_SCENE_CAPABILITIES = [
  'focusChallengeStage',
  'focusCourseLessonStep',
  'hintMinesweeperCell',
  'speciesAudio',
] as const

export type TutorSceneCapability = (typeof TUTOR_SCENE_CAPABILITIES)[number]

export function hasTutorSceneCapability(
  capabilities: TutorSceneCapability[] | undefined,
  capability: TutorSceneCapability,
) {
  return capabilities?.includes(capability) ?? false
}

export function resolveTutorSceneCapabilities(input: {
  serverCapabilities?: TutorSceneCapability[]
  clientCapabilities?: TutorSceneCapability[]
}) {
  const serverCapabilities = input.serverCapabilities ?? []
  if (serverCapabilities.length === 0) return []
  if (!input.clientCapabilities) return []

  const clientCapabilitySet = new Set(input.clientCapabilities)
  return serverCapabilities.filter((capability) => clientCapabilitySet.has(capability))
}
