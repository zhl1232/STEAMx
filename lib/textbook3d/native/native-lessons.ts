import type { PlantId } from "./plants"
import type { ObservationPlantId } from "./observation-plants"

export type NativeLessonId = "p1a-1-1" | "p1a-1-2"
export type SceneItemId = PlantId | ObservationPlantId
export function isNativeTextbookLesson(id: string): id is NativeLessonId {
  return id === "p1a-1-1" || id === "p1a-1-2"
}
export const isNativeTextbookPath = (path: string) =>
  path === "/textbook/p1a-1-1" || path === "/textbook/p1a-1-2"
