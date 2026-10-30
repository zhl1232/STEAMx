/** Rebuilt from the two pages of the shipped p1a-1-1 lesson; not recovered source. */
export const PLANTS = [
  { id: "tree", name: "大树", feature: "高高的，有树干", observation: "从树根往上看：树干托着树枝，树枝上长着许多叶子。", place: "例如校园里、路旁", color: "#427851" },
  { id: "grass", name: "小草", feature: "矮矮的，绿绿的", observation: "转到侧面看：细长的叶子从靠近地面的地方长出来。", place: "例如草地上", color: "#70964a" },
  { id: "flower", name: "花", feature: "有漂亮的花朵", observation: "找一找花瓣、花茎和叶子。开花的植物也会生长。", place: "例如花坛里", color: "#bc783c" },
] as const

export type PlantId = typeof PLANTS[number]["id"]
export const PLANT_IDS = PLANTS.map((plant) => plant.id)

/** Cap both DPR and total pixels, including large desktop/fullscreen surfaces. */
export function plantPixelRatio(width: number, height: number, deviceRatio: number) {
  return Math.min(Math.max(1, deviceRatio || 1), 1.5, Math.sqrt(1_500_000 / Math.max(1, width * height)))
}
