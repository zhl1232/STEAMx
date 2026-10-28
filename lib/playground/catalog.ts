export const PLAYGROUND_GROUPS = [
  { id: "create", title: "一起拼与创造", description: "从一块图形开始，聊聊你看见了什么。" },
  { id: "experiment", title: "做个小实验", description: "先猜一猜，再动手试，看看哪里和想象不同。" },
  { id: "think", title: "动脑与编程", description: "把想法说出来，一起找下一步。" },
  { id: "more", title: "更多逻辑游戏", description: "想继续挑战时，再来挑一个。" },
] as const

export type PlaygroundGroup = typeof PLAYGROUND_GROUPS[number]["id"]

export type PlaygroundDiscovery = {
  href: string
  group: PlaygroundGroup
  featured?: boolean
  age: string
  duration: string
  together: string
  afterwards: string
}

/** 当前公开玩法目录与导航的顺序。 */
export const PLAYGROUND_DISCOVERY: PlaygroundDiscovery[] = [
  { href: "/playground/nonogram", group: "create", age: "7 岁起", duration: "10–20 分钟", together: "从小棋盘开始，请孩子解释一行线索。", afterwards: "在方格纸上画图，互相编一组数字线索。" },
  { href: "/playground/balance", group: "experiment", featured: true, age: "7 岁起", duration: "10–15 分钟", together: "称之前先猜结果，称之后说说排除了谁。", afterwards: "用衣架和纸杯做个天平，比较身边的小物件。" },
  { href: "/playground/life", group: "experiment", featured: true, age: "8 岁起", duration: "10–20 分钟", together: "摆几个细胞，一起预测下一步会怎样。", afterwards: "用方格纸记录三代变化，试着只改一个格子。" },
  { href: "/playground/maze", group: "think", featured: true, age: "6 岁起", duration: "5–15 分钟", together: "让孩子指路，遇到岔路再讨论选择。", afterwards: "画一个迷宫，用箭头写下走到终点的指令。" },
  { href: "/playground/hanoi", group: "think", age: "7 岁起", duration: "10–15 分钟", together: "先用三片圆盘，每次移动前说出计划。", afterwards: "用不同大小的纸片复现，再试着增加一片。" },
  { href: "/playground/24game", group: "think", age: "8 岁起", duration: "5–10 分钟", together: "轮流提出一个算式，比较有没有别的解法。", afterwards: "拿四张扑克牌，给彼此出一道题。" },
  { href: "/playground/memory", group: "think", age: "7 岁起", duration: "5–10 分钟", together: "先翻名词，再找它的解释，说说一对概念。", afterwards: "写几组自己的名词和解释，做一套配对卡。" },
  { href: "/playground/gomoku", group: "think", age: "7 岁起", duration: "10–20 分钟", together: "偶尔暂停，请双方各说一个下一步的想法。", afterwards: "在纸上留下一个局面，一起找两种应对。" },
  { href: "/playground/minesweeper", group: "think", age: "8 岁起", duration: "10–15 分钟", together: "从入门课程开始，区分有依据的判断和猜测。", afterwards: "画下一个数字局面，说明哪些格子还不能确定。" },
  { href: "/playground/functionwars", group: "think", age: "11 岁起", duration: "15–25 分钟", together: "每次只改一个参数，先猜弹道会怎么变。", afterwards: "在纸上画出两条轨迹，标出改变的参数。" },
  { href: "/playground/sudoku", group: "more", age: "8 岁起", duration: "10–20 分钟", together: "从简单难度开始，说出一个数字被排除的原因。", afterwards: "在纸上留下候选数，解释下一步的依据。" },
  { href: "/playground/nqueens", group: "more", age: "9 岁起", duration: "10–20 分钟", together: "先试四皇后，遇到冲突就一起退回一步。", afterwards: "在方格纸上摆棋子，画出互相攻击的方向。" },
]

export const PLAYGROUND_DISCOVERY_BY_HREF = new Map(PLAYGROUND_DISCOVERY.map((game) => [game.href, game]))

/** 首页分类卡展示当前公开目录数量。 */
export const PLAYGROUND_MINI_GAMES_COUNT = PLAYGROUND_DISCOVERY.length
