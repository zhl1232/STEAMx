import { describe, expect, it } from 'vitest'

import { resolveTutorSceneCapabilities } from '@/lib/ai/tutor/scene-capabilities'

describe('resolveTutorSceneCapabilities', () => {
  it('does not expose page tools when the client has not reported mounted handlers', () => {
    expect(
      resolveTutorSceneCapabilities({
        serverCapabilities: ['focusCourseLessonStep'],
      }),
    ).toEqual([])
  })

  it('only keeps capabilities exposed by both server scene and mounted client handlers', () => {
    expect(
      resolveTutorSceneCapabilities({
        serverCapabilities: ['focusCourseLessonStep', 'hintMinesweeperCell'],
        clientCapabilities: ['focusChallengeStage', 'hintMinesweeperCell'],
      }),
    ).toEqual(['hintMinesweeperCell'])
  })

  it('does not allow the client to add capabilities the server scene did not expose', () => {
    expect(
      resolveTutorSceneCapabilities({
        serverCapabilities: [],
        clientCapabilities: ['focusCourseLessonStep'],
      }),
    ).toEqual([])
  })
})
