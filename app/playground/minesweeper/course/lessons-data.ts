/**
 * 扫雷解局学课程 - 每课扫雷练习关卡
 * 与 course 课时顺序一一对应；null 表示本课暂无关卡
 */
export type PracticePuzzle = {
  rows: number
  cols: number
  mines: [number, number][]  // [行, 列] 0-indexed
  revealCells: [number, number][]  // 开局已翻开的格子，数字由程序根据 mines 计算
  goal: "open" | "flag"  // 目标：点开安全格 / 标出地雷
  target: [number, number]  // 目标格子 [行, 列]
  hint: string
}

export const practicePuzzles: (PracticePuzzle | null)[] = [
  null, // 1.
  // 2. 法则一和法则二
  {
    rows: 3,
    cols: 3,
    mines: [[2, 1], [2, 2]],
    revealCells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0]],
    goal: "flag",
    target: [2, 2],
    hint: '看正中间的2，它周围只剩下2个未知格子，用"法则一"，这两个格子全都是雷！请将其标出。',
  },
  // 3. 集合包含关系（小圈被大圈完全包含，推断共有的格子里藏着那颗雷）
  {
    rows: 2,
    cols: 3,
    mines: [[0, 0]],
    revealCells: [[1, 0], [1, 1], [1, 2]],
    goal: "flag",
    target: [0, 0],
    hint: '用"画圈"眼光看一看：左边"1"的圈只管它左上方和正上方这2个格，必有1雷；右边"1"的圈管这2个格加上右上角，也只有1雷。右边的大圈把左边的小圈完全包住，且雷数相同——说明那颗雷就藏在小圈的范围里！右上角格子绝对安全，请标出左侧有雷的格。',
  },
  // 4. 排除法边11
  {
    rows: 2,
    cols: 3,
    mines: [[0, 0]],
    revealCells: [[1, 0], [1, 1], [1, 2]],
    goal: "open",
    target: [0, 2],
    hint: "排除法：右边1的势力范围完全包住了左边1的范围，且它们需要的雷数都是1。于是右边1多管辖的那个右上角格子绝对不可能有雷，安全！点开它！",
  },
  // 5. 平边 1-1-1 (两头安全)
  {
    rows: 2,
    cols: 3,
    mines: [[0, 1]],
    revealCells: [[1, 0], [1, 1], [1, 2]],
    goal: "open",
    target: [0, 0],
    hint: "平边1-1-1：左边1的势力范围被中间1完全包住，且需要的雷数都是1。因此中间1多出的右上方格子必定安全！同理用右边1推理，左上方格子也绝对安全！",
  },
  // 6. 确认法边12
  {
    rows: 2,
    cols: 3,
    mines: [[0, 0], [0, 2]],
    revealCells: [[1, 0], [1, 1], [1, 2]],
    goal: "flag",
    target: [0, 2],
    hint: "确认法：右边2比左边1刚好多了右边最上面的1格，并且也多了1颗雷。多出的那格必定是雷！",
  },
  // 7. 确认法变种平边 1-3
  {
    rows: 3,
    cols: 4,
    mines: [[0, 2], [0, 3], [1, 3]],
    revealCells: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3]],
    goal: "flag",
    target: [0, 3],
    hint: "右侧的3管辖 4 个未知格，中间的1管辖左边那 2 个未知格。3 的势力范围比 1 多出右边那一列的 2 格，也恰好多出了 2 雷 (3-1=2)。这就意味着多出来的 2 个格子必然全部塞满了雷！请标记雷。",
  },
  // 8. 1-2-1 定式（合并了原来的拆分课）
  {
    rows: 2,
    cols: 3,
    mines: [[0, 0], [0, 2]],
    revealCells: [[1, 0], [1, 1], [1, 2]],
    goal: "open",
    target: [0, 1],
    hint: "1-2-1 定式：左1说A+B=1，右1说B+C=1，中2说A+B+C=2。代入推导可知 A 和 C 是雷，中间 B 安全！点开中间那格吧。",
  },
  // 9. 长条的1
  {
    rows: 2,
    cols: 5,
    mines: [[0, 1], [0, 3]],
    revealCells: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
    goal: "flag",
    target: [0, 3],
    hint: "哪怕1被拉长了，它和旁边的2仍旧构成1-2-1定式。2的独有格只能是雷！请标出它。",
  },
]

/** 根据雷位计算某格周围雷数 */
export function countNeighborMines(
  r: number,
  c: number,
  rows: number,
  cols: number,
  mines: [number, number][]
): number {
  let n = 0
  for (const [mr, mc] of mines) {
    if (Math.abs(mr - r) <= 1 && Math.abs(mc - c) <= 1 && (mr !== r || mc !== c)) n++
  }
  return n
}
