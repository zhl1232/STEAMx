import type { NativeLessonId, SceneItemId } from "./native-lessons"
import { TREE_PARTS } from "./tree-parts"

export type SceneLabel = {
  readonly id: string
  readonly name: string
  readonly anchor: readonly [number, number, number]
}

const NO_LABELS: readonly SceneLabel[] = []

// Coordinates are in each observation model's local frame, after the factory's
// ground normalization and before the book's fixed scale or folding transforms.
// They lie on the named geometry surfaces, including the petal instance matrix.
const OBSERVATION_LABELS = {
  leaf: [
    { id: "vein", name: "叶脉", anchor: [0.014, 1.20204, -0.27095] },
  ],
  stem: [
    { id: "root", name: "根", anchor: [0.18144, 0.04891, 0.0445] },
    { id: "stem", name: "茎", anchor: [0.00224, 1.15006, 0.04067] },
    { id: "leaf", name: "叶", anchor: [0.31879, 1.39698, -0.04842] },
  ],
  flower: [
    { id: "petal", name: "花瓣", anchor: [0.36899, 1.85726, 0.0026] },
    { id: "center", name: "花心", anchor: [0.025, 1.7907, 0.09512] },
  ],
} as const satisfies Partial<Record<SceneItemId, readonly SceneLabel[]>>

/** A lesson and its actual specimen must both match; there is no default model. */
export function getSceneLabels(lessonId: NativeLessonId, plant: SceneItemId): readonly SceneLabel[] {
  if (lessonId === "p1a-1-1") return plant === "tree" ? TREE_PARTS : NO_LABELS
  if (lessonId === "p1a-1-2") {
    switch (plant) {
      case "leaf": return OBSERVATION_LABELS.leaf
      case "stem": return OBSERVATION_LABELS.stem
      case "flower": return OBSERVATION_LABELS.flower
    }
  }
  return NO_LABELS
}
