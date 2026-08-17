import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/metadata";

const PLAYGROUND_METADATA = {
  "/playground/minesweeper": {
    title: "扫雷",
    description: "在线玩扫雷，用数字线索和确定性推理找出安全格与地雷。",
    keywords: ["扫雷", "逻辑推理", "在线小游戏", "数学思维"],
  },
  "/playground/minesweeper/course": {
    title: "扫雷解局学",
    description: "从数字线索、排除法和经典定式入门扫雷，边学规则边练习解局。",
    keywords: ["扫雷教程", "扫雷入门", "逻辑推理", "概率思维"],
  },
  "/playground/gomoku": {
    title: "五子棋",
    description: "在线玩五子棋，练习连五、攻防布局与博弈策略。",
    keywords: ["五子棋", "在线五子棋", "博弈论", "策略游戏"],
  },
  "/playground/life": {
    title: "生命游戏",
    description: "探索康威生命游戏，用元胞自动机挑战稳定结构、振荡器与涌现任务。",
    keywords: ["生命游戏", "康威生命游戏", "元胞自动机", "算法"],
  },
  "/playground/2048": {
    title: "2048",
    description: "在线玩 2048，合并数字方块，练习规划、贪心策略与空间管理。",
    keywords: ["2048", "数字游戏", "数学思维", "逻辑游戏"],
  },
  "/playground/24game": {
    title: "24 点",
    description: "在线挑战 24 点，用四则运算和组合思维把四张牌算出 24。",
    keywords: ["24点", "四则运算", "心算", "数学游戏"],
  },
  "/playground/hanoi": {
    title: "汉诺塔",
    description: "在线玩汉诺塔，理解递归、分治和最少步数的算法思维。",
    keywords: ["汉诺塔", "递归", "算法思维", "数学游戏"],
  },
  "/playground/sudoku": {
    title: "数独",
    description: "在线玩数独，用行、列和宫的候选数排除法完成九宫格。",
    keywords: ["数独", "在线数独", "约束满足", "逻辑推理"],
  },
  "/playground/nqueens": {
    title: "N 皇后",
    description: "在线挑战 N 皇后问题，理解回溯搜索、冲突检测与剪枝。",
    keywords: ["N皇后", "回溯算法", "算法可视化", "棋盘问题"],
  },
  "/playground/fifteen": {
    title: "数字华容道",
    description: "在线玩数字华容道，滑动方块复原顺序，练习空间规划与可解性。",
    keywords: ["数字华容道", "15数码", "滑块游戏", "空间规划"],
  },
  "/playground/memory": {
    title: "记忆翻牌",
    description: "在线玩记忆翻牌，寻找相同图案，训练工作记忆与图案联想。",
    keywords: ["记忆翻牌", "记忆游戏", "在线小游戏", "图案联想"],
  },
  "/playground/quickmath": {
    title: "速算闪电战",
    description: "在 60 秒内完成更多四则运算，挑战心算速度与连续答题能力。",
    keywords: ["速算", "心算游戏", "四则运算", "数学训练"],
  },
  "/playground/maze": {
    title: "迷宫探险",
    description: "探索五档迷雾迷宫，练习路径记忆，并用 BFS、DFS 和 A* 复盘路线。",
    keywords: ["迷宫游戏", "BFS", "DFS", "A*算法", "路径规划"],
  },
  "/playground/tangram": {
    title: "七巧板",
    description: "在线玩七巧板，用几何拼合和空间想象完成目标剪影。",
    keywords: ["七巧板", "几何游戏", "空间想象", "在线益智游戏"],
  },
  "/playground/nonogram": {
    title: "数织",
    description: "在线挑战数织，根据行列数字线索填出隐藏图案。",
    keywords: ["数织", "Nonogram", "逻辑填图", "像素谜题"],
  },
  "/playground/ballsort": {
    title: "球排序",
    description: "在线玩球排序，把同色球放入同一试管，练习状态空间与规划。",
    keywords: ["球排序", "颜色排序", "状态空间", "益智游戏"],
  },
  "/playground/balance": {
    title: "天平称重",
    description: "用有限次称量找出假币，练习三分法和科学推理。",
    keywords: ["天平称重", "假币问题", "三分法", "科学推理"],
  },
  "/playground/symmetry": {
    title: "像素对称",
    description: "观察半边图案并补出镜像，练习坐标对应、对称与空间想象。",
    keywords: ["像素对称", "镜像", "坐标", "空间想象"],
  },
  "/playground/functionwars": {
    title: "函数战争",
    description: "用函数图像和坐标变换控制弹道，在游戏中理解数学函数。",
    keywords: ["函数战争", "函数图像", "坐标变换", "数学游戏"],
  },
} as const;

export type PlaygroundMetadataPath = keyof typeof PLAYGROUND_METADATA;

export function buildPlaygroundMetadata(path: PlaygroundMetadataPath): Metadata {
  const page = PLAYGROUND_METADATA[path];

  return buildPageMetadata({
    title: page.title,
    description: page.description,
    path,
    keywords: [...page.keywords],
  });
}
