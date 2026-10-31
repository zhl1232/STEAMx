/** Learning content and anchors in the tree model's local coordinates. */
export const TREE_PARTS = [
  { id: "root", name: "树根", anchor: [0.21, 0.065, 0.067] },
  { id: "trunk", name: "树干", anchor: [-0.03, 1.05, 0.08] },
  { id: "leaf", name: "树叶", anchor: [0.64, 2.72, 0.48] },
] as const
/** Arrange three labels within the model side, with a fixed gap and no overlaps. */
export function placeTreeLabels(anchors: Array<{ x: number; y: number }>, area: { left: number; right: number; top: number; bottom: number }) {
  const width = 78, height = 36, gap = 42
  const sorted = anchors.map((anchor, index) => ({ anchor, index })).sort((a, b) => a.anchor.y - b.anchor.y)
  const bottom = Math.max(area.top + (anchors.length - 1) * gap, area.bottom - height)
  const ys = sorted.map(({ anchor }, i) => Math.min(bottom - (anchors.length - 1 - i) * gap, Math.max(area.top + i * gap, anchor.y - height / 2)))
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + gap)
  return anchors.map((anchor, index) => {
    const y = ys[sorted.findIndex(item => item.index === index)]
    const x = Math.min(Math.max(area.left, area.right - width), Math.max(area.left, anchor.x + 32))
    return { x, y, endX: x + width / 2, endY: y + height / 2 }
  })
}
